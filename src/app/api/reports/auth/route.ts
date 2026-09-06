import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

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
                   c.name as resolved_company_name
            FROM report_users ru
            LEFT JOIN companies c ON ru.company_id = c.id
            WHERE LOWER(ru.username) = LOWER(?) AND ru.password = ?
            LIMIT 1
          `,
          args: [cleanUsername, cleanPassword],
        });

        if (repRes.rows.length > 0) {
          const row = repRes.rows[0];
          if (Number(row.status ?? 1) === 0) {
            return NextResponse.json({ error: "Your account is disabled. Please contact administrator." }, { status: 403 });
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
      const user = (await db.execute({
        sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ? LIMIT 1",
        args: [cleanUsername, cleanPassword],
      })).rows[0] as any;

      if (user) {
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

      return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
    }

    if (action === "change-password") {
      const user = (await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] })).rows[0] as any;
      if (!user || user.password !== currentPassword) {
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
