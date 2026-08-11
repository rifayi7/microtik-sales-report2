import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const search = url.searchParams.get("search");

    let conditions = ["v.is_used = 1", "v.router_id IS NOT NULL", "v.router_id != ''"];
    let params: any[] = [];

    if (startDate) {
      conditions.push("v.used_at >= ?");
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push("v.used_at <= ?");
      params.push(`${endDate} 23:59:59`);
    }
    if (search && search.trim() !== "") {
      conditions.push("v.router_id LIKE ?");
      params.push(`%${search.trim()}%`);
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT 
        v.router_id as campName,
        COUNT(*) as salesCount,
        SUM(COALESCE(p.price, 0)) as totalAmount
      FROM vouchers v
      LEFT JOIN sales_pricing p ON v.validity_days = p.validity_days
      WHERE ${whereClause}
      GROUP BY v.router_id
      ORDER BY totalAmount DESC
    `;

    const rows = db.prepare(sql).all(...params) as unknown as {
      campName: string;
      salesCount: number;
      totalAmount: number;
    }[];

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load payment camp reports" },
      { status: 500 }
    );
  }
}
