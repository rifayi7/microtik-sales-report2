import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { buildWhereClauseAsync } from "@/lib/query-builder";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const company = url.searchParams.get("company");
    const sortBy = url.searchParams.get("sortBy");

    const { effectiveAllowedCamps, effectiveCompanyId, isReportUserRestricted } = await buildWhereClauseAsync(url.searchParams, request);

    if (isReportUserRestricted && effectiveAllowedCamps.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch from camps table
    let campsRows: any[] = [];
    try {
      const campResult = await db.execute("SELECT * FROM camps");
      campsRows = campResult.rows as any[];
    } catch (e) {
      campsRows = [];
    }

    // Fetch from routers table to resolve router hardware IDs (e.g. router-1455-8497074D0F40 -> CAMP6)
    let routerRows: any[] = [];
    try {
      const routerResult = await db.execute(`
        SELECT r.id, 
               COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(r.hotspotName, ''), r.id) as name,
               COALESCE(NULLIF(r.hotspotName, ''), NULLIF(r.sessionName, ''), NULLIF(r.camp, ''), r.id) as hotspot_name,
               c.name as company_name,
               r.company_id
        FROM routers r
        LEFT JOIN companies c ON r.company_id = c.id
        WHERE (r.is_active = 1 OR r.is_active IS NULL)
      `);
      routerRows = routerResult.rows as any[];
    } catch (e) {
      routerRows = [];
    }

    // Combine and deduplicate strictly by Router ID (Primary Hardware Identity)
    const combinedMap = new Map<string, any>();
    for (const r of routerRows) {
      const key = String(r.id).toLowerCase();
      combinedMap.set(key, {
        id: r.id,
        name: r.name,
        hotspot_name: r.hotspot_name,
        company_name: r.company_name,
        company_id: r.company_id,
      });
    }
    for (const c of campsRows) {
      const key = String(c.id || c.name).toLowerCase();
      if (!combinedMap.has(key)) {
        combinedMap.set(key, c);
      }
    }

    let allCamps = Array.from(combinedMap.values());

    // Filter by allowed camps if report user
    if (isReportUserRestricted && effectiveAllowedCamps.length > 0) {
      const lowerAllowed = new Set(effectiveAllowedCamps.map(a => a.toLowerCase().trim()));
      allCamps = allCamps.filter(c => {
        const idStr = String(c.id || "").toLowerCase().trim();
        const nameStr = String(c.name || "").toLowerCase().trim();
        const hotspotStr = String(c.hotspot_name || "").toLowerCase().trim();
        return lowerAllowed.has(idStr) || lowerAllowed.has(nameStr) || lowerAllowed.has(hotspotStr);
      });
    }

    // Filter by company ID if tenant is scoped
    if (effectiveCompanyId) {
      allCamps = allCamps.filter(c => !c.company_id || Number(c.company_id) === Number(effectiveCompanyId));
    }

    if (company && company !== "all" && company !== "") {
      const lowerComp = company.toLowerCase();
      allCamps = allCamps.filter(c => String(c.company_name || "").toLowerCase() === lowerComp);
    }

    if (search && search.trim() !== "") {
      const q = search.trim().toLowerCase();
      allCamps = allCamps.filter(c => 
        String(c.name || "").toLowerCase().includes(q) || 
        String(c.hotspot_name || "").toLowerCase().includes(q) ||
        String(c.id || "").toLowerCase().includes(q)
      );
    }

    if (sortBy === "ASC") {
      allCamps.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sortBy === "DESC") {
      allCamps.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
    } else {
      allCamps.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }

    return NextResponse.json({ success: true, data: allCamps });
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
      const campNameTrimmed = name.trim();
      const compNameTrimmed = company_name ? String(company_name).trim() : null;

      await db.execute({ sql: `
        INSERT INTO camps (name, company_name, hotspot_name, strength) 
        VALUES (?, ?, ?, ?)
      `, args: [campNameTrimmed, compNameTrimmed, hotspot_name || null, strength || 500] });

      // Auto-seed default 15-Days (16 AED) & 30-Days (32 AED) validity pricing plans for the new camp
      try {
        let compId: number | null = null;
        if (compNameTrimmed) {
          const compRow = await db.execute({
            sql: "SELECT id FROM companies WHERE name = ? COLLATE NOCASE LIMIT 1",
            args: [compNameTrimmed],
          });
          if (compRow.rows.length > 0 && compRow.rows[0].id) {
            compId = Number(compRow.rows[0].id);
          }
        }

        await db.batch([
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (company_id, router_id, validity, price, unit, status) VALUES (?, ?, ?, ?, ?, ?)",
            args: [compId, campNameTrimmed, 15, 16, 0.5, 1],
          },
          {
            sql: "INSERT OR IGNORE INTO camp_validity_pricing (company_id, router_id, validity, price, unit, status) VALUES (?, ?, ?, ?, ?, ?)",
            args: [compId, campNameTrimmed, 30, 32, 1.0, 1],
          },
        ], "write");
      } catch (seedErr) {
        console.warn("Could not auto-seed camp_validity_pricing:", seedErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save camp" }, { status: 500 });
  }
}
