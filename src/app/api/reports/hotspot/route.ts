import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sortBy");

    let whereConditions = ["v.router_id IS NOT NULL", "v.router_id != ''"];
    let params: any[] = [];

    if (search && search.trim() !== "") {
      whereConditions.push("v.router_id LIKE ?");
      params.push(`%${search.trim()}%`);
    }

    const whereClause = whereConditions.join(" AND ");

    // We build the sold date conditions dynamically
    let soldDateCondition = "";
    let soldParams: any[] = [];
    if (startDate) {
      soldDateCondition += " AND v.used_at >= ?";
      soldParams.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      soldDateCondition += " AND v.used_at <= ?";
      soldParams.push(`${endDate} 23:59:59`);
    }

    const sql = `
      SELECT 
        v.validity_days as validity,
        v.router_id as hotspot,
        COUNT(*) as generated,
        SUM(CASE WHEN v.status = 'redeemed' ${soldDateCondition} THEN 1 ELSE 0 END) as sold,
        SUM(CASE WHEN v.status = 'available' THEN 1 ELSE 0 END) as remaining
      FROM vouchers v
      WHERE ${whereClause}
      GROUP BY v.validity_days, v.router_id
      ORDER BY v.router_id ASC, generated DESC
    `;

    const allParams = [...soldParams, ...params];
    const rows = (await db.execute({ sql: sql, args: [...allParams] })).rows as unknown as {
      validity: number;
      hotspot: string;
      generated: number;
      sold: number;
      remaining: number;
    }[];

    // Group rows by hotspot name (e.g. "APM-DXB-camp-1")
    const grouped: Record<string, typeof rows> = {};
    rows.forEach(row => {
      const key = row.hotspot;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });

    // Handle sort_by order if provided
    let sortedHotspots = Object.keys(grouped);
    if (sortBy === "hotspotName asc") {
      sortedHotspots.sort((a, b) => a.localeCompare(b));
    } else if (sortBy === "hotspotName desc") {
      sortedHotspots.sort((a, b) => b.localeCompare(a));
    } else {
      sortedHotspots.sort((a, b) => a.localeCompare(b));
    }

    const finalGrouped: Record<string, typeof rows> = {};
    sortedHotspots.forEach(key => {
      finalGrouped[key] = grouped[key];
    });

    return NextResponse.json({
      success: true,
      data: finalGrouped,
      hotspots: sortedHotspots
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load hotspot reports" },
      { status: 500 }
    );
  }
}
