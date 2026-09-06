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
  campName?: string;
  hotspotName?: string;
}

export async function GET(request: Request) {
  try {
    const db = await getDB();
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
      ${whereClause}
    `;
    const countRow = (await db.execute({ sql: countSql, args: [...params] })).rows[0] as unknown as { count: number } | undefined;
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
        COALESCE(v.price_charged, 0) as price,
        COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(c.name, ''), NULLIF(v.router_id, '')) as campName,
        COALESCE(NULLIF(r.hotspotName, ''), NULLIF(c.hotspot_name, ''), NULLIF(r.camp, ''), NULLIF(c.name, ''), NULLIF(v.router_id, '')) as hotspotName
      FROM vouchers v
      LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
      LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name OR r.camp = c.name)
      ${whereClause}
      ORDER BY v.used_at DESC
      LIMIT ? OFFSET ?
    `;
    const sales = (await db.execute({ sql: salesSql, args: [...params, limit, offset] })).rows as unknown as SalesRecord[];

    // 3. Get list of all sales persons from sales_persons table
    let allSalesPersons: any[] = [];
    try {
      const spRes = await db.execute({
        sql: "SELECT id, username, display_name, camp_name, allowed_camps, company_name FROM sales_persons",
        args: []
      });
      allSalesPersons = spRes.rows;
    } catch (e) {
      allSalesPersons = [];
    }

    // 4. Get voucher sellers with camp and company association
    let voucherSellers: any[] = [];
    try {
      const vsRes = await db.execute({
        sql: `
          SELECT DISTINCT 
            v.sold_by as name, 
            COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(c.name, ''), NULLIF(v.router_id, '')) as camp_name,
            COALESCE(NULLIF(c.company_name, ''), NULLIF(comp.name, '')) as company_name
          FROM vouchers v
          LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
          LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name OR r.camp = c.name)
          LEFT JOIN companies comp ON (c.company_name = comp.name)
          WHERE v.status = 'redeemed' AND v.sold_by IS NOT NULL AND v.sold_by != ''
        `,
        args: []
      });
      voucherSellers = vsRes.rows;
    } catch (e) {
      voucherSellers = [];
    }

    // 5. Get distinct list of agents for dropdown filter
    const agentsSql = `
      SELECT DISTINCT sold_by as name 
      FROM vouchers 
      WHERE status = 'redeemed' AND sold_by IS NOT NULL AND sold_by != ''
      ORDER BY sold_by ASC
    `;
    const agentsRows = (await db.execute({ sql: agentsSql, args: [] })).rows as unknown as { name: string }[];
    const agents = agentsRows.map(row => row.name);

    // 6. Get distinct list of routers for dropdown filter
    const routersSql = `
      SELECT DISTINCT router_id as id 
      FROM vouchers 
      WHERE status = 'redeemed' AND router_id IS NOT NULL AND router_id != ''
      ORDER BY router_id ASC
    `;
    const routersRows = (await db.execute({ sql: routersSql, args: [] })).rows as unknown as { id: string }[];
    const routers = routersRows.map(row => row.id);

    // 7. Get distinct validity periods
    const plansSql = `
      SELECT DISTINCT validity_days as days 
      FROM vouchers 
      WHERE status = 'redeemed'
      ORDER BY validity_days ASC
    `;
    const plansRows = (await db.execute({ sql: plansSql, args: [] })).rows as unknown as { days: number }[];
    const plans = plansRows.map(row => row.days);

    // 8. Get distinct camps dynamically from camps and routers tables
    const campsSql = `
      SELECT DISTINCT name FROM (
        SELECT name FROM camps WHERE name IS NOT NULL AND name != ''
        UNION
        SELECT camp as name FROM routers WHERE camp IS NOT NULL AND camp != ''
      ) ORDER BY name ASC
    `;
    const campsRows = (await db.execute({ sql: campsSql, args: [] })).rows as unknown as { name: string }[];
    const camps = campsRows.map(row => row.name);

    // 9. Get distinct companies dynamically from companies and camps tables
    const companiesSql = `
      SELECT DISTINCT name FROM (
        SELECT name FROM companies WHERE name IS NOT NULL AND name != ''
        UNION
        SELECT company_name as name FROM camps WHERE company_name IS NOT NULL AND company_name != ''
      ) ORDER BY name ASC
    `;
    const companiesRows = (await db.execute({ sql: companiesSql, args: [] })).rows as unknown as { name: string }[];
    const companies = companiesRows.map(row => row.name);

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
        camps,
        companies,
        allSalesPersons,
        voucherSellers,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sales log" },
      { status: 500 }
    );
  }
}
