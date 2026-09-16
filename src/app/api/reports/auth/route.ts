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

      // EXCLUSIVELY CHECK report_users TABLE ONLY
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

        if (repRes.rows.length === 0) {
          return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
        }

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
        // Retain strictly unique Router IDs (anchoring permissions to permanent hardware ID)
        allowedCamps = Array.from(new Set(allowedCamps.map(s => String(s).trim()).filter(Boolean)));

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
      } catch (e) {
        console.error("Error authenticating report_users:", e);
        return NextResponse.json({ error: "Authentication error" }, { status: 500 });
      }
    }

    if (action === "check-session") {
      const cleanUsername = String(username || "").trim();
      if (!cleanUsername) return NextResponse.json({ valid: false, error: "No user provided" }, { status: 400 });

      // EXCLUSIVELY CHECK report_users TABLE ONLY
      try {
        const repRes = await db.execute({
          sql: `
            SELECT ru.id, ru.status, ru.allowed_camp_ids, c.status as company_status, c.suspended_reason
            FROM report_users ru
            LEFT JOIN companies c ON ru.company_id = c.id
            WHERE LOWER(ru.username) = LOWER(?)
            LIMIT 1
          `,
          args: [cleanUsername],
        });

        if (repRes.rows.length === 0) {
          return NextResponse.json({ valid: false, error: "User account deleted or not found", isDeleted: true }, { status: 401 });
        }

        const row = repRes.rows[0];
        if (Number(row.status ?? 1) === 0) {
          return NextResponse.json({
            valid: false,
            error: "Your account has been paused by the administrator. Access is disabled until resumed.",
            isPaused: true,
            isDeleted: true,
          }, { status: 403 });
        }
        if (row.company_status !== undefined && Number(row.company_status) === 0) {
          const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
          return NextResponse.json({ valid: false, error: reason, isSuspended: true }, { status: 403 });
        }

        let allowedCamps: string[] = [];
        if (row.allowed_camp_ids) {
          try {
            allowedCamps = JSON.parse(String(row.allowed_camp_ids));
          } catch {
            allowedCamps = [String(row.allowed_camp_ids)];
          }
        }
        allowedCamps = Array.from(new Set(allowedCamps.map(s => String(s).trim()).filter(Boolean)));

        return NextResponse.json({ valid: true, allowedCamps });
      } catch (e) {
        console.error("Error checking report_users in check-session:", e);
        return NextResponse.json({ valid: false, error: "Session validation error" }, { status: 500 });
      }
    }

    if (action === "change-password") {
      // EXCLUSIVELY CHANGE PASSWORD IN report_users TABLE ONLY
      const repUser = (await db.execute({
        sql: "SELECT id, password FROM report_users WHERE LOWER(username) = LOWER(?) LIMIT 1",
        args: [username],
      })).rows[0] as any;

      if (!repUser || !verifyPassword(currentPassword, String(repUser.password || ""))) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      const hashedNew = hashPassword(newPassword);
      await db.execute({
        sql: "UPDATE report_users SET password = ? WHERE id = ?",
        args: [hashedNew, Number(repUser.id)],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication error" }, { status: 500 });
  }
}
