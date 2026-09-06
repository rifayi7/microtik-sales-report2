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

    let conditions = ["v.status = 'redeemed'", "v.sold_by IS NOT NULL", "v.sold_by != ''"];
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
        COALESCE(NULLIF(sp.display_name, ''), NULLIF(sp.username, ''), NULLIF(v.sold_by, '')) as userName,
        COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(c.name, ''), NULLIF(v.router_id, '')) as campName,
        COUNT(*) as salesCount,
        SUM(COALESCE(v.price_charged, 0)) as salesAmount
      FROM vouchers v
      LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
      LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name OR r.camp = c.name)
      LEFT JOIN sales_persons sp ON (v.sales_person_id = sp.id OR v.sold_by = sp.username OR v.sold_by = sp.display_name)
      WHERE ${whereClause}
      GROUP BY userName, campName
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
