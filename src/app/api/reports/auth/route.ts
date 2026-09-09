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

      // 1. Check report_users table first
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

          // Check password with multi-format support (scrypt, sha256, plain)
          const isPasswordValid = verifyPassword(cleanPassword, String(row.password || ""));
          if (!isPasswordValid) {
            return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
          }

          if (Number(row.status ?? 1) === 0) {
            return NextResponse.json({ error: "Your account is disabled. Please contact administrator." }, { status: 403 });
          }

          if (row.company_status !== undefined && Number(row.company_status) === 0) {
            const reason = row.suspended_reason ? String(row.suspended_reason) : "Account suspended due to company dues.";
            return NextResponse.json({ error: reason }, { status: 403 });
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

      // 2. Check legacy / superadmin users table
      const userRes = await db.execute({
        sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
        args: [cleanUsername],
      });

      if (userRes.rows.length > 0) {
        const user = userRes.rows[0] as any;
        const isSuperAdminPasswordValid = verifyPassword(cleanPassword, String(user.password || ""));

        if (isSuperAdminPasswordValid) {
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
