import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const user = url.searchParams.get("user");
    const camp = url.searchParams.get("camp");

    let conditions = ["v.is_used = 1", "v.sold_by IS NOT NULL", "v.sold_by != ''"];
    let params: any[] = [];

    if (user && user !== "all" && user !== "") {
      conditions.push("v.sold_by = ?");
      params.push(user);
    }
    if (camp && camp !== "all" && camp !== "") {
      conditions.push("v.router_id = ?");
      params.push(camp);
    }
    if (search && search.trim() !== "") {
      conditions.push("(v.sold_by LIKE ? OR v.router_id LIKE ?)");
      const likeParam = `%${search.trim()}%`;
      params.push(likeParam, likeParam);
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT 
        v.sold_by as userName,
        v.router_id as campName,
        COUNT(*) as salesCount,
        SUM(COALESCE(p.price, 0)) as salesAmount
      FROM vouchers v
      LEFT JOIN sales_pricing p ON v.validity_days = p.validity_days
      WHERE ${whereClause}
      GROUP BY v.sold_by, v.router_id
      ORDER BY salesAmount DESC
    `;

    const rows = (await db.execute({ sql: sql, args: [...params] })).rows as unknown as {
      userName: string;
      campName: string;
      salesCount: number;
      salesAmount: number;
    }[];

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load user-sale reports" },
      { status: 500 }
    );
  }
}
