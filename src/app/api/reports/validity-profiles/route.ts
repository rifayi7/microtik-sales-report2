import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDB();
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

    const rows = db.prepare(query).all(...params) as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load validity profiles" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { id, name, action } = await request.json();

    if (action === "delete") {
      db.prepare("DELETE FROM validity_profiles WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
    }

    if (id) {
      db.prepare("UPDATE validity_profiles SET name = ? WHERE id = ?").run(name.trim(), id);
    } else {
      db.prepare("INSERT INTO validity_profiles (name) VALUES (?)").run(name.trim());
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save validity profile" }, { status: 500 });
  }
}
