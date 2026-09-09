import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain || !password) return false;

  // 1. Verify scrypt hash (scrypt:salt:key)
  if (storedHashOrPlain.startsWith("scrypt:")) {
    try {
      const parts = storedHashOrPlain.split(":");
      if (parts.length !== 3) return false;
      const [, salt, key] = parts;
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const keyBuffer = Buffer.from(key, "hex");
      return crypto.timingSafeEqual(derivedKey, keyBuffer);
    } catch {
      return false;
    }
  }

  // 2. Verify sha256 with salt (sha256:salt:hash)
  if (storedHashOrPlain.startsWith("sha256:")) {
    try {
      const parts = storedHashOrPlain.split(":");
      if (parts.length === 3) {
        const [, salt, hash] = parts;
        const testHash = crypto.createHash("sha256").update(salt + password).digest("hex");
        return testHash === hash;
      }
    } catch {
      return false;
    }
  }

  // 3. Verify plain sha256 hash (64 hex characters)
  if (/^[a-f0-9]{64}$/i.test(storedHashOrPlain)) {
    const directSha256 = crypto.createHash("sha256").update(password).digest("hex");
    if (directSha256.toLowerCase() === storedHashOrPlain.toLowerCase()) return true;
  }

  // 4. Backwards-compatible legacy check for old plain-text entries
  return password === storedHashOrPlain;
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { action, username, password, currentPassword, newPassword } = await request.json();

    if (action === "login") {
      const cleanUsername = String(username || "").trim();
      const cleanPassword = String(password || "").trim();

      // 1. Check Super Admin Hardcoded / DB Master user
      if (cleanUsername.toLowerCase() === "admin" && cleanPassword === "admin123") {
        return NextResponse.json({
          success: true,
          userType: "superadmin",
          username: "admin",
          displayName: "Super Administrator",
          companyId: null,
          companyName: null,
          allowedCamps: [],
        });
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
          const isPasswordValid = verifyPassword(cleanPassword, String(row.password || ""));
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          const resolvedCompanyId = row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null);
          const compName = String(row.resolved_company_name || row.company_name || "");

          return NextResponse.json({
            success: true,
            userType: "company_admin",
            id: Number(row.id),
            username: String(row.username),
            displayName: compName ? `${compName} Admin` : "Company Admin",
            companyId: resolvedCompanyId,
            companyName: compName,
            allowedCamps: [],
          });
        }
      } catch (e) {
        console.warn("Notice checking company_admins:", e);
      }

      // 3. Check report_users table
      try {
        const repRes = await db.execute({
          sql: `
            SELECT ru.id, ru.username, ru.password, ru.display_name, ru.company_id, ru.company_name, 
                   ru.allowed_camp_ids, ru.allowed_router_ids, ru.status,
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

          const isPasswordValid = verifyPassword(cleanPassword, String(row.password || ""));
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (Number(row.status ?? 1) === 0) {
            return NextResponse.json({ error: "Your account is disabled. Please contact administrator." }, { status: 403 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          let allowedCamps: string[] = [];
          if (row.allowed_camp_ids) {
            try {
              allowedCamps = JSON.parse(String(row.allowed_camp_ids));
            } catch {
              allowedCamps = [String(row.allowed_camp_ids)];
            }
          }

          return NextResponse.json({
            success: true,
            userType: "report_user",
            id: Number(row.id),
            username: String(row.username),
            displayName: String(row.display_name || row.username),
            companyId: row.company_id ? Number(row.company_id) : null,
            companyName: String(row.resolved_company_name || row.company_name || ""),
            allowedCamps,
          });
        }
      } catch (e) {
        console.warn("Notice checking report_users:", e);
      }

      // 4. Check sales_persons table
      try {
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
          const isPasswordValid = verifyPassword(cleanPassword, String(row.password || ""));
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason, isSuspended: true }, { status: 403 });
          }

          let allowedCamps: string[] = [];
          if (row.allowed_camps) {
            try {
              allowedCamps = JSON.parse(String(row.allowed_camps));
            } catch {
              allowedCamps = [String(row.allowed_camps)];
            }
          }

          return NextResponse.json({
            success: true,
            userType: "report_user",
            id: Number(row.id),
            username: String(row.username),
            displayName: String(row.display_name || row.username),
            companyId: row.company_id ? Number(row.company_id) : null,
            companyName: String(row.resolved_company_name || ""),
            allowedCamps,
          });
        }
      } catch (e) {
        console.warn("Notice checking sales_persons:", e);
      }

      // 5. Check legacy users table
      const userRes = await db.execute({
        sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
        args: [cleanUsername],
      });

      if (userRes.rows.length > 0) {
        const user = userRes.rows[0] as any;
        const isUserPasswordValid = verifyPassword(cleanPassword, String(user.password || ""));

        if (isUserPasswordValid) {
          return NextResponse.json({
            success: true,
            userType: "superadmin",
            username: String(user.username),
            displayName: "Super Administrator",
            companyId: null,
            companyName: null,
            allowedCamps: [],
          });
        }
      }

      return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
    }

    if (action === "check-session") {
      const cleanUsername = String(username || "").trim();
      if (!cleanUsername) return NextResponse.json({ valid: false, error: "No user provided" }, { status: 400 });

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
            return NextResponse.json({ valid: false, error: "Your account has been disabled. Logging out...", isDeleted: true }, { status: 403 });
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

      // 4. Check superadmin users table
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
      const user = (await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] })).rows[0] as any;
      if (!user || !verifyPassword(currentPassword, String(user.password || ""))) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      await db.execute({ sql: "UPDATE users SET password = ? WHERE username = ?", args: [newPassword, username] });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication error" }, { status: 500 });
  }
}
