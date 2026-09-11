import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { verifyPassword, hashPassword, needsRehash, signJwt } from "@/lib/auth-crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { action, username, password, currentPassword, newPassword } = await request.json();

    if (action === "login") {
      const cleanUsername = String(username || "").trim();
      const cleanPassword = String(password || "").trim();

      if (!cleanUsername || !cleanPassword) {
        return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
      }

      // CRITICAL PAUSE CHECK: If user is paused in report_users, deny immediately
      try {
        const checkReportPaused = await db.execute({
          sql: "SELECT status FROM report_users WHERE LOWER(username) = LOWER(?) LIMIT 1",
          args: [cleanUsername],
        });
        if (checkReportPaused.rows.length > 0 && Number(checkReportPaused.rows[0].status ?? 1) === 0) {
          return NextResponse.json({
            error: "Your account is paused by the administrator. Access is disabled until resumed.",
            isPaused: true,
          }, { status: 403 });
        }
      } catch (e) {
        console.warn("Notice checking paused report_users:", e);
      }

      // 1. Check super_admins table
      try {
        const superRes = await db.execute({
          sql: "SELECT id, username, display_name, password FROM super_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
          args: [cleanUsername],
        });

        if (superRes.rows.length > 0) {
          const row = superRes.rows[0];
          const storedPassword = String(row.password || "");
          const isPasswordValid = verifyPassword(cleanPassword, storedPassword);
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (needsRehash(storedPassword)) {
            try {
              const secureHash = hashPassword(cleanPassword);
              await db.execute({
                sql: "UPDATE super_admins SET password = ? WHERE id = ?",
                args: [secureHash, Number(row.id)],
              });
            } catch (rehashErr) {
              console.warn("Failed to upgrade super admin password hash:", rehashErr);
            }
          }

          const user = {
            id: Number(row.id),
            userType: "superadmin" as const,
            username: String(row.username),
            displayName: String(row.display_name || "Super Administrator"),
            companyId: null,
            companyName: null,
            allowedCamps: [] as string[],
          };

          const token = signJwt({
            sub: user.username,
            userId: user.id,
            displayName: user.displayName,
            role: "superadmin",
            userType: "superadmin",
            companyId: null,
            companyName: null,
            allowedCamps: [],
          });

          return NextResponse.json({
            success: true,
            ...user,
            token,
          });
        }
      } catch (e) {
        console.warn("Notice checking super_admins:", e);
      }

      // 2. Check company_admins table
      try {
        const adminRes = await db.execute({
          sql: `
            SELECT ca.id, ca.username, ca.password, ca.company_name, ca.company_id, ca.role,
                   c.id as resolved_company_id, c.name as resolved_company_name,
                   COALESCE(c.status, 1) as company_status,
                   c.suspended_reason
            FROM company_admins ca
            LEFT JOIN companies c ON (ca.company_id IS NOT NULL AND c.id = ca.company_id) OR (ca.company_name IS NOT NULL AND LOWER(c.name) = LOWER(ca.company_name))
            WHERE LOWER(ca.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (adminRes.rows.length > 0) {
          const row = adminRes.rows[0];
          const storedPassword = String(row.password || "");
          const isPasswordValid = verifyPassword(cleanPassword, storedPassword);
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          if (needsRehash(storedPassword)) {
            try {
              const secureHash = hashPassword(cleanPassword);
              await db.execute({
                sql: "UPDATE company_admins SET password = ? WHERE id = ?",
                args: [secureHash, Number(row.id)],
              });
            } catch (err) {
              console.warn("Failed to upgrade password hash:", err);
            }
          }

          const resolvedCompanyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
          const compName = String(row.resolved_company_name || row.company_name || "");

          const user = {
            id: Number(row.id),
            username: String(row.username),
            displayName: compName ? `${compName} Admin` : "Company Admin",
            userType: "company_admin" as const,
            companyId: resolvedCompanyId,
            companyName: compName,
            allowedCamps: [] as string[],
          };

          const token = signJwt({
            sub: user.username,
            userId: user.id,
            displayName: user.displayName,
            role: "company_admin",
            userType: "company_admin",
            companyId: user.companyId,
            companyName: user.companyName,
            allowedCamps: [],
          });

          return NextResponse.json({
            success: true,
            ...user,
            token,
          });
        }
      } catch (e) {
        console.warn("Notice checking company_admins:", e);
      }

      // 3. Check report_users table
      try {
        const repRes = await db.execute({
          sql: `
            SELECT ru.id, ru.username, ru.password, ru.display_name, ru.company_id,
                   ru.allowed_camp_ids, ru.status,
                   c.name as resolved_company_name,
                   COALESCE(c.status, 1) as company_status,
                   c.suspended_reason
            FROM report_users ru
            LEFT JOIN companies c ON ru.company_id = c.id
            WHERE LOWER(ru.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (repRes.rows.length > 0) {
          const row = repRes.rows[0];

          // IMMEDIATE PAUSE CHECK: Block login immediately if account is paused
          if (Number(row.status ?? 1) === 0) {
            return NextResponse.json({
              error: "Your account is paused by the administrator. Access is disabled until resumed.",
              isPaused: true,
            }, { status: 403 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          const storedPassword = String(row.password || "");
          const isPasswordValid = verifyPassword(cleanPassword, storedPassword);
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (needsRehash(storedPassword)) {
            try {
              const secureHash = hashPassword(cleanPassword);
              await db.execute({
                sql: "UPDATE report_users SET password = ? WHERE id = ?",
                args: [secureHash, Number(row.id)],
              });
            } catch (err) {
              console.warn("Failed to upgrade password hash:", err);
            }
          }

          let allowedCamps: string[] = [];
          if (row.allowed_camp_ids) {
            try {
              allowedCamps = JSON.parse(String(row.allowed_camp_ids));
            } catch {
              allowedCamps = [String(row.allowed_camp_ids)];
            }
          }

          const user = {
            id: Number(row.id),
            username: String(row.username),
            displayName: String(row.display_name || row.username),
            userType: "report_user" as const,
            companyId: row.company_id ? Number(row.company_id) : null,
            companyName: String(row.resolved_company_name || ""),
            allowedCamps,
          };

          const token = signJwt({
            sub: user.username,
            userId: user.id,
            displayName: user.displayName,
            role: "report_user",
            userType: "report_user",
            companyId: user.companyId,
            companyName: user.companyName,
            allowedCamps: user.allowedCamps,
          });

          return NextResponse.json({
            success: true,
            ...user,
            token,
          });
        }
      } catch (e) {
        console.warn("Notice checking report_users:", e);
      }

      // 4. Check sales_persons table
      try {
        // Enforce pause: if user also exists as a report_user and is paused, never allow login
        const checkReportPaused = await db.execute({
          sql: "SELECT status FROM report_users WHERE LOWER(username) = LOWER(?) LIMIT 1",
          args: [cleanUsername],
        });
        if (checkReportPaused.rows.length > 0 && Number(checkReportPaused.rows[0].status ?? 1) === 0) {
          return NextResponse.json({
            error: "Your account is paused by the administrator. Access is disabled until resumed.",
            isPaused: true,
          }, { status: 403 });
        }
        const spRes = await db.execute({
          sql: `
            SELECT sp.id, sp.username, sp.password, sp.display_name, sp.company_id, sp.allowed_camps,
                   c.name as resolved_company_name,
                   COALESCE(c.status, 1) as company_status,
                   c.suspended_reason
            FROM sales_persons sp
            LEFT JOIN companies c ON sp.company_id = c.id
            WHERE LOWER(sp.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (spRes.rows.length > 0) {
          const row = spRes.rows[0];
          const storedPassword = String(row.password || "");
          const isPasswordValid = verifyPassword(cleanPassword, storedPassword);
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          if (needsRehash(storedPassword)) {
            try {
              const secureHash = hashPassword(cleanPassword);
              await db.execute({
                sql: "UPDATE sales_persons SET password = ? WHERE id = ?",
                args: [secureHash, Number(row.id)],
              });
            } catch (err) {
              console.warn("Failed to upgrade password hash:", err);
            }
          }

          let allowedCamps: string[] = [];
          if (row.allowed_camps) {
            try {
              allowedCamps = JSON.parse(String(row.allowed_camps));
            } catch {
              allowedCamps = [String(row.allowed_camps)];
            }
          }

          const user = {
            id: Number(row.id),
            username: String(row.username),
            displayName: String(row.display_name || row.username),
            userType: "report_user" as const,
            companyId: row.company_id ? Number(row.company_id) : null,
            companyName: String(row.resolved_company_name || ""),
            allowedCamps,
          };

          const token = signJwt({
            sub: user.username,
            userId: user.id,
            displayName: user.displayName,
            role: "salesperson",
            userType: "report_user",
            companyId: user.companyId,
            companyName: user.companyName,
            allowedCamps: user.allowedCamps,
          });

          return NextResponse.json({
            success: true,
            ...user,
            token,
          });
        }
      } catch (e) {
        console.warn("Notice checking sales_persons:", e);
      }

      return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
    }

    if (action === "check-session") {
      const cleanUsername = String(username || "").trim();
      if (!cleanUsername) return NextResponse.json({ valid: false, error: "No user provided" }, { status: 400 });

      // CRITICAL PAUSE CHECK: If user is paused in report_users, invalidate session immediately
      try {
        const checkReportPaused = await db.execute({
          sql: "SELECT status FROM report_users WHERE LOWER(username) = LOWER(?) LIMIT 1",
          args: [cleanUsername],
        });
        if (checkReportPaused.rows.length > 0 && Number(checkReportPaused.rows[0].status ?? 1) === 0) {
          return NextResponse.json({
            valid: false,
            error: "Your account has been paused by the administrator. Access is disabled until resumed.",
            isPaused: true,
            isDeleted: true,
          }, { status: 403 });
        }
      } catch (e) {
        console.warn("Notice checking paused report_users in check-session:", e);
      }

      // 1. Check company_admins
      try {
        const adminRes = await db.execute({
          sql: `
            SELECT ca.id, c.status as company_status, c.suspended_reason
            FROM company_admins ca
            LEFT JOIN companies c ON (ca.company_id IS NOT NULL AND c.id = ca.company_id) OR (ca.company_name IS NOT NULL AND LOWER(c.name) = LOWER(ca.company_name))
            WHERE LOWER(ca.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (adminRes.rows.length > 0) {
          const row = adminRes.rows[0];
          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ valid: false, error: reason, isSuspended: true }, { status: 403 });
          }
          return NextResponse.json({ valid: true });
        }
      } catch (e) {
        console.warn("Error checking company_admins in check-session:", e);
      }

      // 2. Check report_users
      try {
        const repRes = await db.execute({
          sql: `
            SELECT ru.id, ru.status, c.status as company_status, c.suspended_reason
            FROM report_users ru
            LEFT JOIN companies c ON ru.company_id = c.id
            WHERE LOWER(ru.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (repRes.rows.length > 0) {
          const row = repRes.rows[0];
          if (Number(row.status ?? 1) === 0) {
            return NextResponse.json({
              valid: false,
              error: "Your account has been paused by the administrator. You have been logged out.",
              isPaused: true,
              isDeleted: true,
            }, { status: 403 });
          }
          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ valid: false, error: reason, isSuspended: true }, { status: 403 });
          }
          return NextResponse.json({ valid: true });
        }
      } catch (e) {
        console.warn("Error checking report_users in check-session:", e);
      }

      // 3. Check sales_persons
      try {
        const checkReportPaused = await db.execute({
          sql: "SELECT status FROM report_users WHERE LOWER(username) = LOWER(?) LIMIT 1",
          args: [cleanUsername],
        });
        if (checkReportPaused.rows.length > 0 && Number(checkReportPaused.rows[0].status ?? 1) === 0) {
          return NextResponse.json({
            valid: false,
            error: "Your account has been paused by the administrator. You have been logged out.",
            isPaused: true,
            isDeleted: true,
          }, { status: 403 });
        }

        const spRes = await db.execute({
          sql: `
            SELECT sp.id, c.status as company_status, c.suspended_reason
            FROM sales_persons sp
            LEFT JOIN companies c ON sp.company_id = c.id
            WHERE LOWER(sp.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (spRes.rows.length > 0) {
          const row = spRes.rows[0];
          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ valid: false, error: reason, isSuspended: true }, { status: 403 });
          }
          return NextResponse.json({ valid: true });
        }
      } catch (e) {
        console.warn("Error checking sales_persons in check-session:", e);
      }

      // 4. Check super_admins table
      const superRes = await db.execute({
        sql: "SELECT id FROM super_admins WHERE LOWER(username) = LOWER(?) LIMIT 1",
        args: [cleanUsername],
      });
      if (superRes.rows.length > 0) {
        return NextResponse.json({ valid: true });
      }

      // 5. Fallback check legacy users table
      const userRes = await db.execute({
        sql: "SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
        args: [cleanUsername],
      });
      if (userRes.rows.length > 0) {
        return NextResponse.json({ valid: true });
      }

      return NextResponse.json({ valid: false, error: "User account deleted or not found", isDeleted: true }, { status: 401 });
    }

    if (action === "change-password") {
      const superUser = (await db.execute({ sql: "SELECT * FROM super_admins WHERE username = ?", args: [username] })).rows[0] as any;
      if (superUser) {
        if (!verifyPassword(currentPassword, String(superUser.password || ""))) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
        }
        const hashedNew = hashPassword(newPassword);
        await db.execute({ sql: "UPDATE super_admins SET password = ? WHERE username = ?", args: [hashedNew, username] });
        return NextResponse.json({ success: true });
      }

      const user = (await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] })).rows[0] as any;
      if (!user || !verifyPassword(currentPassword, String(user.password || ""))) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      const hashedNew = hashPassword(newPassword);
      await db.execute({ sql: "UPDATE users SET password = ? WHERE username = ?", args: [hashedNew, username] });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication error" }, { status: 500 });
  }
}
