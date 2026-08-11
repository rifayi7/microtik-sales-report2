import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { action, username, password, currentPassword, newPassword } = await request.json();

    if (action === "login") {
      const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
      if (user) {
        return NextResponse.json({ success: true, username: user.username });
      }
      return NextResponse.json({ error: "Invalid username or password" }, { status: 400 });
    }

    if (action === "change-password") {
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      if (!user || user.password !== currentPassword) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication error" }, { status: 500 });
  }
}
