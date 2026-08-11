import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const company = url.searchParams.get("company");
    const sortBy = url.searchParams.get("sortBy");

    let query = "SELECT * FROM camps";
    let conditions: string[] = [];
    let params: any[] = [];

    if (search && search.trim() !== "") {
      conditions.push("(name LIKE ? OR hotspot_name LIKE ?)");
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam);
    }

    if (company && company !== "all" && company !== "") {
      conditions.push("company_name = ?");
      params.push(company);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    if (sortBy === "ASC") {
      query += " ORDER BY name ASC";
    } else if (sortBy === "DESC") {
      query += " ORDER BY name DESC";
    } else {
      query += " ORDER BY id ASC";
    }

    const rows = db.prepare(query).all(...params) as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load camps" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { id, name, company_name, hotspot_name, strength, action } = await request.json();

    if (action === "delete") {
      db.prepare("DELETE FROM camps WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Camp name is required" }, { status: 400 });
    }

    if (id) {
      db.prepare(`
        UPDATE camps 
        SET name = ?, company_name = ?, hotspot_name = ?, strength = ? 
        WHERE id = ?
      `).run(name.trim(), company_name || null, hotspot_name || null, strength || 500, id);
    } else {
      db.prepare(`
        INSERT INTO camps (name, company_name, hotspot_name, strength) 
        VALUES (?, ?, ?, ?)
      `).run(name.trim(), company_name || null, hotspot_name || null, strength || 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save camp" }, { status: 500 });
  }
}
