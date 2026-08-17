import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
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

    const rows = (await db.execute({ sql: query, args: [...params] })).rows as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load camp validity pricing" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { id, camp_name, validity_name, company_name, price, status, action } = await request.json();

    if (action === "delete") {
      await db.execute({ sql: "DELETE FROM camp_validity_pricing WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      await db.execute({ sql: "UPDATE camp_validity_pricing SET status = ? WHERE id = ?", args: [status, id] });
      return NextResponse.json({ success: true });
    }

    if (!camp_name || !validity_name) {
      return NextResponse.json({ error: "Camp and Validity profile are required" }, { status: 400 });
    }

    if (id) {
      await db.execute({ sql: `
        UPDATE camp_validity_pricing 
        SET camp_name = ?, validity_name = ?, company_name = ?, price = ?
        WHERE id = ?
      `, args: [camp_name, validity_name, company_name || null, price || 0, id] });
    } else {
      await db.execute({ sql: `
        INSERT INTO camp_validity_pricing (camp_name, validity_name, company_name, price, status) 
        VALUES (?, ?, ?, ?, 1)
      `, args: [camp_name, validity_name, company_name || null, price || 0] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save camp validity pricing" }, { status: 500 });
  }
}
