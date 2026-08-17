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
      ORDER BY v.validity_days ASC, generated DESC
    `;

    const allParams = [...soldParams, ...params];
    const rows = (await db.execute({ sql: sql, args: [...allParams] })).rows as unknown as {
      validity: number;
      hotspot: string;
      generated: number;
      sold: number;
      remaining: number;
    }[];

    // Group rows by validity profile name (e.g. "15-Days")
    const grouped: Record<string, typeof rows> = {};
    rows.forEach(row => {
      const profileName = `${row.validity}-Days`;
      if (!grouped[profileName]) {
        grouped[profileName] = [];
      }
      grouped[profileName].push(row);
    });

    // Handle sort_by order if provided
    let sortedProfiles = Object.keys(grouped);
    if (sortBy === "validityProfile asc") {
      sortedProfiles.sort((a, b) => parseInt(a) - parseInt(b));
    } else if (sortBy === "validityProfile desc") {
      sortedProfiles.sort((a, b) => parseInt(b) - parseInt(a));
    } else {
      // Default order: numeric sort ascending
      sortedProfiles.sort((a, b) => parseInt(a) - parseInt(b));
    }

    const finalGrouped: Record<string, typeof rows> = {};
    sortedProfiles.forEach(key => {
      finalGrouped[key] = grouped[key];
    });

    return NextResponse.json({
      success: true,
      data: finalGrouped,
      profiles: sortedProfiles
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load validity reports" },
      { status: 500 }
    );
  }
}
