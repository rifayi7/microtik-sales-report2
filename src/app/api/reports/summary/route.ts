import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { buildWhereClause } from "@/lib/query-builder";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const { whereClause, params } = buildWhereClause(url.searchParams);

    // 1. Get high-level summary (Total Sales, Total Revenue)
    const summarySql = `
      SELECT 
        COUNT(*) as totalSales, 
        SUM(COALESCE(v.price_charged, 0)) as totalRevenue 
      FROM vouchers v
      ${whereClause}
    `;
    const summaryRow = (await db.execute({ sql: summarySql, args: [...params] })).rows[0] as unknown as {
      totalSales: number;
      totalRevenue: number | null;
    } | undefined;

    let totalSales = summaryRow?.totalSales || 0;
    let totalRevenue = summaryRow?.totalRevenue || 0;

    // 2. Get Sales Performance by Agent
    const agentSql = `
      SELECT 
        v.sold_by as name, 
        COUNT(*) as salesCount, 
        SUM(COALESCE(v.price_charged, 0)) as revenue 
      FROM vouchers v
      ${whereClause} AND v.sold_by IS NOT NULL AND v.sold_by != ''
      GROUP BY v.sold_by
      ORDER BY revenue DESC
    `;
    const agents = (await db.execute({ sql: agentSql, args: [...params] })).rows as unknown as {
      name: string;
      salesCount: number;
      revenue: number;
    }[];

    // 3. Get Plan Performance (Distribution)
    const planSql = `
      SELECT 
        v.validity_days || ' Days' as planName, 
        COUNT(*) as count, 
        SUM(COALESCE(v.price_charged, 0)) as revenue 
      FROM vouchers v
      ${whereClause}
      GROUP BY v.validity_days
      ORDER BY count DESC
    `;
    const plans = (await db.execute({ sql: planSql, args: [...params] })).rows as unknown as {
      planName: string;
      count: number;
      revenue: number;
    }[];

    // 4. Get Sales Trend grouped by day (Dubai Business Day)
    const trendSql = `
      SELECT 
        date(v.used_at, '+4 hours') as date, 
        COUNT(*) as sales, 
        SUM(COALESCE(v.price_charged, 0)) as revenue 
      FROM vouchers v
      ${whereClause}
      GROUP BY date
      ORDER BY date ASC
    `;
    const trends = (await db.execute({ sql: trendSql, args: [...params] })).rows as unknown as {
      date: string;
      sales: number;
      revenue: number;
    }[];

    // 5. Get Sales Performance by Camp (Router)
    const campSql = `
      SELECT 
        COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(c.name, ''), NULLIF(v.router_id, ''), 'Camp') as campName, 
        COUNT(*) as salesCount, 
        SUM(COALESCE(v.price_charged, 0)) as revenue 
      FROM vouchers v
      LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
      LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name)
      ${whereClause} AND v.router_id IS NOT NULL AND v.router_id != ''
      GROUP BY campName
      ORDER BY revenue DESC
    `;
    const camps = (await db.execute({ sql: campSql, args: [...params] })).rows as unknown as {
      campName: string;
      salesCount: number;
      revenue: number;
    }[];

    let finalAgents = agents;
    let finalPlans = plans;
    let finalTrends = trends;
    let finalCamps = camps;
    
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = yesterdayDate.toISOString().split("T")[0];

    const todayStatsSql = `
      SELECT COUNT(*) as count, SUM(COALESCE(v.price_charged, 0)) as revenue
      FROM vouchers v
      WHERE v.status = 'redeemed' AND v.used_at >= ? AND v.used_at <= ?
    `;
    const todayStats = (await db.execute({ sql: todayStatsSql, args: [`${today} 00:00:00`, `${today} 23:59:59`] })).rows[0] as unknown as {
      count: number;
      revenue: number | null;
    };

    const yesterdayStats = (await db.execute({ sql: todayStatsSql, args: [`${yesterday} 00:00:00`, `${yesterday} 23:59:59`] })).rows[0] as unknown as {
      count: number;
      revenue: number | null;
    };

    let todaySales = todayStats?.count || 0;
    let todayRevenue = todayStats?.revenue || 0;
    let yesterdaySales = yesterdayStats?.count || 0;
    let yesterdayRevenue = yesterdayStats?.revenue || 0;

    // Real Dynamic Last Month Sales and Collections Calculation
    const now = new Date();
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthNum = String(lastMonthDate.getMonth() + 1).padStart(2, "0");
    const lastMonthYearMonth = `${lastMonthYear}-${lastMonthNum}`;
    const lastMonthStart = `${lastMonthYearMonth}-01 00:00:00`;
    const lastDayOfPrevMonth = new Date(lastMonthYear, lastMonthDate.getMonth() + 1, 0).getDate();
    const lastMonthEnd = `${lastMonthYearMonth}-${String(lastDayOfPrevMonth).padStart(2, "0")} 23:59:59`;

    const lastMonthSalesSql = `
      SELECT COUNT(*) as count, SUM(COALESCE(v.price_charged, 0)) as revenue
      FROM vouchers v
      WHERE v.status = 'redeemed' AND v.used_at >= ? AND v.used_at <= ?
    `;
    const lastMonthSalesRow = (await db.execute({ sql: lastMonthSalesSql, args: [lastMonthStart, lastMonthEnd] })).rows[0] as unknown as {
      count: number;
      revenue: number | null;
    };

    const lastMonthCollectionSql = `
      SELECT COUNT(*) as count, SUM(COALESCE(amount, 0)) as revenue
      FROM payments
      WHERE paid_for_year_month = ? OR (payment_date >= ? AND payment_date <= ?)
    `;
    const lastMonthCollectionRow = (await db.execute({ 
      sql: lastMonthCollectionSql, 
      args: [lastMonthYearMonth, `${lastMonthYearMonth}-01`, `${lastMonthYearMonth}-${String(lastDayOfPrevMonth).padStart(2, "0")}`] 
    })).rows[0] as unknown as {
      count: number;
      revenue: number | null;
    };

    return NextResponse.json({
      success: true,
      summary: {
        totalSales,
        totalRevenue: totalRevenue || 0,
        activeAgentsCount: finalAgents.length,
      },
      comparison: {
        today: { sales: todaySales, revenue: todayRevenue },
        yesterday: { sales: yesterdaySales, revenue: yesterdayRevenue },
      },
      lastMonth: {
        sales: {
          count: lastMonthSalesRow?.count || 0,
          revenue: lastMonthSalesRow?.revenue || 0,
        },
        collection: {
          count: lastMonthCollectionRow?.count || 0,
          revenue: lastMonthCollectionRow?.revenue || 0,
        }
      },
      agents: finalAgents,
      camps: finalCamps,
      plans: finalPlans,
      trends: finalTrends,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load summary stats" },
      { status: 500 }
    );
  }
}
