import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { buildWhereClause } from "@/lib/query-builder";

export const runtime = "nodejs";

interface SalesRecord {
  code: string;
  validity: number;
  mobile: string;
  timestamp: string;
  seller: string | null;
  routerId: string;
  price: number;
}

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const { whereClause, params } = buildWhereClause(url.searchParams);

    // Get pagination parameters
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
    const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1;
    const offset = (page - 1) * limit;

    // 1. Get total count of matching sales
    const countSql = `
      SELECT COUNT(*) as count 
      FROM vouchers v
      LEFT JOIN sales_pricing p ON v.validity_days = p.validity_days
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { count: number } | undefined;
    const totalCount = countRow ? countRow.count : 0;

    // 2. Fetch the filtered sales logs
    const salesSql = `
      SELECT 
        v.voucher_code as code, 
        v.validity_days as validity, 
        v.used_by as mobile, 
        v.used_at as timestamp, 
        v.sold_by as seller, 
        v.router_id as routerId,
        COALESCE(p.price, 0) as price
      FROM vouchers v
      LEFT JOIN sales_pricing p ON v.validity_days = p.validity_days
      ${whereClause}
      ORDER BY v.used_at DESC
      LIMIT ? OFFSET ?
    `;
    const sales = db.prepare(salesSql).all(...params, limit, offset) as unknown as SalesRecord[];

    // 3. Get distinct list of agents for dropdown filter
    const agentsSql = `
      SELECT DISTINCT sold_by as name 
      FROM vouchers 
      WHERE is_used = 1 AND sold_by IS NOT NULL AND sold_by != ''
      ORDER BY sold_by ASC
    `;
    const agentsRows = db.prepare(agentsSql).all() as unknown as { name: string }[];
    const agents = agentsRows.map(row => row.name);

    // 4. Get distinct list of routers for dropdown filter
    const routersSql = `
      SELECT DISTINCT router_id as id 
      FROM vouchers 
      WHERE is_used = 1 AND router_id IS NOT NULL AND router_id != ''
      ORDER BY router_id ASC
    `;
    const routersRows = db.prepare(routersSql).all() as unknown as { id: string }[];
    const routers = routersRows.map(row => row.id);

    // 5. Get distinct validity periods
    const plansSql = `
      SELECT DISTINCT validity_days as days 
      FROM vouchers 
      WHERE is_used = 1
      ORDER BY validity_days ASC
    `;
    const plansRows = db.prepare(plansSql).all() as unknown as { days: number }[];
    const plans = plansRows.map(row => row.days);

    return NextResponse.json({
      success: true,
      sales,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      filters: {
        agents,
        routers,
        plans,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sales log" },
      { status: 500 }
    );
  }
}
