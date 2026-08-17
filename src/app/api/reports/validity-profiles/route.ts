import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy");

    let query = "SELECT * FROM validity_profiles";
    let params: any[] = [];
    if (search && search.trim() !== "") {
      query += " WHERE name LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    if (sortBy === "name") {
      query += " ORDER BY name ASC";
    } else {
      query += " ORDER BY id ASC";
    }

    const rows = (await db.execute({ sql: query, args: [...params] })).rows as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load validity profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { id, name, action } = await request.json();

    if (action === "delete") {
      await db.execute({ sql: "DELETE FROM validity_profiles WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
    }

    if (id) {
      await db.execute({ sql: "UPDATE validity_profiles SET name = ? WHERE id = ?", args: [name.trim(), id] });
    } else {
      await db.execute({ sql: "INSERT INTO validity_profiles (name) VALUES (?)", args: [name.trim()] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save validity profile" }, { status: 500 });
  }
}
