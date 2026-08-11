import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const camp = url.searchParams.get("camp");
    const sortBy = url.searchParams.get("sortBy");

    let query = "SELECT * FROM camp_validity_pricing";
    let conditions: string[] = [];
    let params: any[] = [];

    if (search && search.trim() !== "") {
      conditions.push("(camp_name LIKE ? OR validity_name LIKE ?)");
      const paramVal = `%${search.trim()}%`;
      params.push(paramVal, paramVal);
    }

    if (camp && camp !== "all" && camp !== "") {
      conditions.push("camp_name = ?");
      params.push(camp);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    if (sortBy === "camps.campName ASC") {
      query += " ORDER BY camp_name ASC";
    } else if (sortBy === "camps.campName DESC") {
      query += " ORDER BY camp_name DESC";
    } else if (sortBy === "vp.profileValidityName ASC") {
      query += " ORDER BY validity_name ASC";
    } else if (sortBy === "vp.profileValidityName DESC") {
      query += " ORDER BY validity_name DESC";
    } else {
      query += " ORDER BY id ASC";
    }

    const rows = db.prepare(query).all(...params) as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load camp validity pricing" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { id, camp_name, validity_name, company_name, price, status, action } = await request.json();

    if (action === "delete") {
      db.prepare("DELETE FROM camp_validity_pricing WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      db.prepare("UPDATE camp_validity_pricing SET status = ? WHERE id = ?").run(status, id);
      return NextResponse.json({ success: true });
    }

    if (!camp_name || !validity_name) {
      return NextResponse.json({ error: "Camp and Validity profile are required" }, { status: 400 });
    }

    if (id) {
      db.prepare(`
        UPDATE camp_validity_pricing 
        SET camp_name = ?, validity_name = ?, company_name = ?, price = ?
        WHERE id = ?
      `).run(camp_name, validity_name, company_name || null, price || 0, id);
    } else {
      db.prepare(`
        INSERT INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) 
        VALUES (?, ?, ?, ?, 1)
      `).run(camp_name, validity_name, company_name || null, price || 0);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save camp validity pricing" }, { status: 500 });
  }
}
