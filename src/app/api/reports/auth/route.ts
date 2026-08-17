import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { action, username, password, currentPassword, newPassword } = await request.json();

    if (action === "login") {
      const user = (await db.execute({ sql: "SELECT * FROM users WHERE username = ? AND password = ?", args: [username, password] })).rows[0] as any;
      if (user) {
        return NextResponse.json({ success: true, username: user.username });
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
