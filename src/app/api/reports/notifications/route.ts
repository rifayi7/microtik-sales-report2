import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy");

    let query = "SELECT * FROM notifications";
    let params: any[] = [];
    if (search && search.trim() !== "") {
      query += " WHERE (camp_name LIKE ? OR user_name LIKE ? OR category LIKE ? OR message LIKE ?)";
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (sortBy === "n.id DESC") {
      query += " ORDER BY id DESC";
    } else {
      query += " ORDER BY id ASC";
    }

    const rows = (await db.execute({ sql: query, args: [...params] })).rows as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load notifications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { id, camp_name, user_name, category, message, is_read, action } = await request.json();

    if (action === "delete") {
      await db.execute({ sql: "DELETE FROM notifications WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      await db.execute({ sql: "UPDATE notifications SET is_read = ? WHERE id = ?", args: [is_read, id] });
      return NextResponse.json({ success: true });
    }

    if (!camp_name || !user_name || !message) {
      return NextResponse.json({ error: "Camp name, User and Message are required" }, { status: 400 });
    }

    if (id) {
      await db.execute({ sql: `
        UPDATE notifications 
        SET camp_name = ?, user_name = ?, category = ?, message = ?
        WHERE id = ?
      `, args: [camp_name, user_name, category || "General", message, id] });
    } else {
      await db.execute({ sql: `
        INSERT INTO notifications (camp_name, user_name, category, message, is_read) 
        VALUES (?, ?, ?, ?, 0)
      `, args: [camp_name, user_name, category || "General", message] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save notification" }, { status: 500 });
  }
}
