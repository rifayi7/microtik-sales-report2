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

    let query = `
      SELECT 
        cvp.id, 
        cvp.company_id, 
        cvp.router_id, 
        cvp.validity, 
        cvp.price, 
        COALESCE(cvp.unit, 1.0) as unit, 
        cvp.status,
        COALESCE(r.sessionName, r.camp, c_camps.name, cvp.router_id) as camp_name,
        COALESCE(c.name, c_camps.company_name) as company_name
      FROM camp_validity_pricing cvp
      LEFT JOIN routers r ON cvp.router_id = r.id
      LEFT JOIN camps c_camps ON (cvp.router_id = c_camps.name OR cvp.router_id = c_camps.hotspot_name)
      LEFT JOIN companies c ON cvp.company_id = c.id
    `;
    let conditions: string[] = [];
    let params: any[] = [];

    if (search && search.trim() !== "") {
      conditions.push("(r.sessionName LIKE ? OR c_camps.name LIKE ? OR CAST(cvp.validity AS TEXT) LIKE ?)");
      const paramVal = `%${search.trim()}%`;
      params.push(paramVal, paramVal, paramVal);
    }

    if (camp && camp !== "all" && camp !== "") {
      conditions.push("(r.sessionName = ? OR c_camps.name = ? OR cvp.router_id = ?)");
      params.push(camp, camp, camp);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    if (sortBy === "camps.campName ASC") {
      query += " ORDER BY camp_name ASC";
    } else if (sortBy === "camps.campName DESC") {
      query += " ORDER BY camp_name DESC";
    } else if (sortBy === "vp.profileValidityName ASC") {
      query += " ORDER BY cvp.validity ASC";
    } else if (sortBy === "vp.profileValidityName DESC") {
      query += " ORDER BY cvp.validity DESC";
    } else {
      query += " ORDER BY cvp.id ASC";
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
    const { id, router_id, camp_name, validity, price, unit, status, action } = await request.json();

    if (action === "delete") {
      await db.execute({ sql: "DELETE FROM camp_validity_pricing WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    if (action === "toggle") {
      await db.execute({ sql: "UPDATE camp_validity_pricing SET status = ? WHERE id = ?", args: [status, id] });
      return NextResponse.json({ success: true });
    }

    const targetRouter = router_id || camp_name;
    const validityDays = Number(String(validity).replace(/\D/g, "")) || Number(validity) || 30;

    if (!targetRouter || !validityDays) {
      return NextResponse.json({ error: "Camp/Router and Validity (days) are required" }, { status: 400 });
    }

    const defaultUnit = validityDays === 15 ? 0.5 : (validityDays === 7 ? 0.25 : 1.0);
    const parsedUnit = unit !== undefined && unit !== null && !isNaN(Number(unit)) ? Number(unit) : defaultUnit;

    if (id) {
      await db.execute({ sql: `
        UPDATE camp_validity_pricing 
        SET router_id = ?, validity = ?, price = ?, unit = ?
        WHERE id = ?
      `, args: [targetRouter, validityDays, Number(price) || 0, parsedUnit, id] });
    } else {
      await db.execute({ sql: `
        INSERT INTO camp_validity_pricing (router_id, validity, price, unit, status) 
        VALUES (?, ?, ?, ?, 1)
      `, args: [targetRouter, validityDays, Number(price) || 0, parsedUnit] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save camp validity pricing" }, { status: 500 });
  }
}
