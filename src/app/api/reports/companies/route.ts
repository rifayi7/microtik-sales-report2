import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy");

    let query = "SELECT * FROM companies";
    let params: any[] = [];
    if (search && search.trim() !== "") {
      query += " WHERE name LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    if (sortBy === "name.asc") {
      query += " ORDER BY name ASC";
    } else if (sortBy === "name.desc") {
      query += " ORDER BY name DESC";
    } else {
      query += " ORDER BY id ASC";
    }

    const rows = db.prepare(query).all(...params) as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load companies" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { id, name, action } = await request.json();

    if (action === "delete") {
      db.prepare("DELETE FROM companies WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    if (id) {
      db.prepare("UPDATE companies SET name = ? WHERE id = ?").run(name.trim(), id);
    } else {
      db.prepare("INSERT INTO companies (name) VALUES (?)").run(name.trim());
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save company" }, { status: 500 });
  }
}
