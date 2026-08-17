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
    const camp = url.searchParams.get("camp");

    let conditions = ["v.is_used = 1", "v.sold_by IS NOT NULL", "v.sold_by != ''"];
    let params: any[] = [];

    if (startDate) {
      conditions.push("v.used_at >= ?");
      params.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      conditions.push("v.used_at <= ?");
      params.push(`${endDate} 23:59:59`);
    }
    if (camp && camp !== "all" && camp !== "") {
      conditions.push("v.router_id = ?");
      params.push(camp);
    }
    if (search && search.trim() !== "") {
      conditions.push("(v.sold_by LIKE ? OR CAST(v.price AS TEXT) LIKE ?)");
      const likeParam = `%${search.trim()}%`;
      params.push(likeParam, likeParam);
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT 
        v.sold_by as userName,
        COUNT(*) as salesCount,
        SUM(COALESCE(p.price, 0)) as totalAmount
      FROM vouchers v
      LEFT JOIN sales_pricing p ON v.validity_days = p.validity_days
      WHERE ${whereClause}
      GROUP BY v.sold_by
      ORDER BY totalAmount DESC
    `;

    const rows = (await db.execute({ sql: sql, args: [...params] })).rows as unknown as {
      userName: string;
      salesCount: number;
      totalAmount: number;
    }[];

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load payment user reports" },
      { status: 500 }
    );
  }
}
