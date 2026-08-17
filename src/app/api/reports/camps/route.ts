import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
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

    const rows = (await db.execute({ sql: query, args: [...params] })).rows as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load camps" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { id, name, company_name, hotspot_name, strength, action } = await request.json();

    if (action === "delete") {
      await db.execute({ sql: "DELETE FROM camps WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Camp name is required" }, { status: 400 });
    }

    if (id) {
      await db.execute({ sql: `
        UPDATE camps 
        SET name = ?, company_name = ?, hotspot_name = ?, strength = ? 
        WHERE id = ?
      `, args: [name.trim(), company_name || null, hotspot_name || null, strength || 500, id] });
    } else {
      await db.execute({ sql: `
        INSERT INTO camps (name, company_name, hotspot_name, strength) 
        VALUES (?, ?, ?, ?)
      `, args: [name.trim(), company_name || null, hotspot_name || null, strength || 500] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save camp" }, { status: 500 });
  }
}
