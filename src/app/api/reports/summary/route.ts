import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { buildWhereClauseAsync } from "@/lib/query-builder";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const { 
      whereClause, 
      params, 
      effectiveAllowedCamps, 
      isReportUserRestricted 
    } = await buildWhereClauseAsync(url.searchParams, request);

    // Unit weight expression: 15-Days = 0.5, 30-Days = 1.0, or from camp_validity_pricing / validity_profiles
    const unitCountExpr = `COALESCE(cvp.unit, vp.unit_weight, CASE WHEN v.validity_days = 30 THEN 1.0 WHEN v.validity_days = 15 THEN 0.5 WHEN v.validity_days = 7 THEN 0.25 ELSE CAST(v.validity_days AS REAL) / 30.0 END)`;

    // Fallback price expression: price_charged or camp_validity_pricing or standard default (30d = 32, 15d = 16)
    const priceExpr = `COALESCE(v.price_charged, cvp.price, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END)`;

    // 1. Get high-level summary (Filtered by Date Range / Criteria)
    const summarySql = `
      SELECT 
        SUM(${unitCountExpr}) as totalSales, 
        SUM(${priceExpr}) as totalRevenue 
      FROM vouchers v
      LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
      LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
      ${whereClause}
    `;
    const summaryRow = (await db.execute({ sql: summarySql, args: [...params] })).rows[0] as unknown as {
      totalSales: number | null;
      totalRevenue: number | null;
    } | undefined;

    let totalSales = Number(summaryRow?.totalSales || 0);
    let totalRevenue = Number(summaryRow?.totalRevenue || 0);

    // 2. Get Sales Performance by Agent
    const agentSql = `
      SELECT 
        COALESCE(NULLIF(sp.display_name, ''), NULLIF(sp.username, ''), NULLIF(v.sold_by, '')) as name, 
        SUM(${unitCountExpr}) as salesCount, 
        SUM(${priceExpr}) as revenue 
      FROM vouchers v
      LEFT JOIN sales_persons sp ON (v.sales_person_id = sp.id OR v.sold_by = sp.username OR v.sold_by = sp.display_name)
      LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
      LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
      ${whereClause} AND v.sold_by IS NOT NULL AND v.sold_by != ''
      GROUP BY COALESCE(NULLIF(sp.display_name, ''), NULLIF(sp.username, ''), NULLIF(v.sold_by, ''))
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
        SUM(${priceExpr}) as revenue 
      FROM vouchers v
      LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
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
        SUM(${unitCountExpr}) as sales, 
        SUM(${priceExpr}) as revenue 
      FROM vouchers v
      LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
      LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
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
        SUM(${unitCountExpr}) as salesCount, 
        SUM(${priceExpr}) as revenue 
      FROM vouchers v
      LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
      LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name)
      LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
      LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
      ${whereClause} AND v.router_id IS NOT NULL AND v.router_id != ''
      GROUP BY campName
      ORDER BY revenue DESC
    `;
    const camps = (await db.execute({ sql: campSql, args: [...params] })).rows as unknown as {
      campName: string;
      salesCount: number;
      revenue: number;
    }[];

    // 6. Get Sales Performance by Company
    const companySql = `
      SELECT 
        COALESCE(NULLIF(c.company_name, ''), NULLIF(comp.name, ''), 'Default Company') as companyName, 
        SUM(${unitCountExpr}) as salesCount, 
        SUM(${priceExpr}) as revenue 
      FROM vouchers v
      LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
      LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name OR r.camp = c.name)
      LEFT JOIN companies comp ON (c.company_name = comp.name)
      LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
      LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
      ${whereClause}
      GROUP BY companyName
      ORDER BY revenue DESC
    `;
    const companiesRes = (await db.execute({ sql: companySql, args: [...params] })).rows as unknown as {
      companyName: string;
      salesCount: number;
      revenue: number;
    }[];

    let finalAgents = agents;
    let finalPlans = plans;
    let finalTrends = trends;
    let finalCamps = camps;
    let finalCompanies = companiesRes || [];
    
    // Authoritative camp scoping for comparison cards
    let campScopeSql = "";
    const campScopeArgs: any[] = [];
    let isZeroAccess = false;

    if (isReportUserRestricted) {
      if (effectiveAllowedCamps.length === 0) {
        isZeroAccess = true;
      } else {
        const placeholders = effectiveAllowedCamps.map(() => "?").join(",");
        campScopeSql = ` AND (
          v.router_id IN (${placeholders})
          OR v.router_id IN (SELECT id FROM routers WHERE camp IN (${placeholders}))
          OR v.router_id IN (SELECT sessionName FROM routers WHERE camp IN (${placeholders}))
        )`;
        campScopeArgs.push(...effectiveAllowedCamps, ...effectiveAllowedCamps, ...effectiveAllowedCamps);
      }
    }

    let todaySales = 0;
    let todayRevenue = 0;
    let yesterdaySales = 0;
    let yesterdayRevenue = 0;
    let thisMonthSalesCount = 0;
    let thisMonthSalesRevenue = 0;
    let lastMonthSalesCount = 0;
    let lastMonthSalesRevenue = 0;
    let lastMonthCollectionCount = 0;
    let lastMonthCollectionRevenue = 0;
    let finalTodayCamps: { campName: string; count: number; revenue: number }[] = [];

    if (!isZeroAccess) {
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const yesterdayDate = new Date(Date.now() - 86400000);
      const yesterday = yesterdayDate.toISOString().split("T")[0];

      const todayStatsSql = `
        SELECT 
          SUM(${unitCountExpr}) as count, 
          SUM(${priceExpr}) as revenue
        FROM vouchers v
        LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
        LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
        WHERE v.status = 'redeemed' AND v.used_at >= ? AND v.used_at <= ? ${campScopeSql}
      `;
      const todayStats = (await db.execute({ sql: todayStatsSql, args: [`${today} 00:00:00`, `${today} 23:59:59`, ...campScopeArgs] })).rows[0] as unknown as {
        count: number | null;
        revenue: number | null;
      };

      const yesterdayStats = (await db.execute({ sql: todayStatsSql, args: [`${yesterday} 00:00:00`, `${yesterday} 23:59:59`, ...campScopeArgs] })).rows[0] as unknown as {
        count: number | null;
        revenue: number | null;
      };

      todaySales = Number(todayStats?.count || 0);
      todayRevenue = Number(todayStats?.revenue || 0);
      yesterdaySales = Number(yesterdayStats?.count || 0);
      yesterdayRevenue = Number(yesterdayStats?.revenue || 0);

      // Real Dynamic This Month Sales Calculation
      const now = new Date();
      const thisMonthYear = now.getFullYear();
      const thisMonthNum = String(now.getMonth() + 1).padStart(2, "0");
      const thisMonthYearMonth = `${thisMonthYear}-${thisMonthNum}`;
      const thisMonthStart = `${thisMonthYearMonth}-01 00:00:00`;
      const lastDayOfCurrentMonth = new Date(thisMonthYear, now.getMonth() + 1, 0).getDate();
      const thisMonthEnd = `${thisMonthYearMonth}-${String(lastDayOfCurrentMonth).padStart(2, "0")} 23:59:59`;

      const thisMonthSalesSql = `
        SELECT 
          SUM(${unitCountExpr}) as count, 
          SUM(${priceExpr}) as revenue
        FROM vouchers v
        LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
        LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
        WHERE v.status = 'redeemed' AND v.used_at >= ? AND v.used_at <= ? ${campScopeSql}
      `;
      const thisMonthSalesRow = (await db.execute({ sql: thisMonthSalesSql, args: [thisMonthStart, thisMonthEnd, ...campScopeArgs] })).rows[0] as unknown as {
        count: number | null;
        revenue: number | null;
      };

      thisMonthSalesCount = Number(thisMonthSalesRow?.count || 0);
      thisMonthSalesRevenue = Number(thisMonthSalesRow?.revenue || 0);

      // Real Dynamic Last Month Sales and Collections Calculation
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthYear = lastMonthDate.getFullYear();
      const lastMonthNum = String(lastMonthDate.getMonth() + 1).padStart(2, "0");
      const lastMonthYearMonth = `${lastMonthYear}-${lastMonthNum}`;
      const lastMonthStart = `${lastMonthYearMonth}-01 00:00:00`;
      const lastDayOfPrevMonth = new Date(lastMonthYear, lastMonthDate.getMonth() + 1, 0).getDate();
      const lastMonthEnd = `${lastMonthYearMonth}-${String(lastDayOfPrevMonth).padStart(2, "0")} 23:59:59`;

      const lastMonthSalesSql = `
        SELECT 
          SUM(${unitCountExpr}) as count, 
          SUM(${priceExpr}) as revenue
        FROM vouchers v
        LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
        LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
        WHERE v.status = 'redeemed' AND v.used_at >= ? AND v.used_at <= ? ${campScopeSql}
      `;
      const lastMonthSalesRow = (await db.execute({ sql: lastMonthSalesSql, args: [lastMonthStart, lastMonthEnd, ...campScopeArgs] })).rows[0] as unknown as {
        count: number | null;
        revenue: number | null;
      };

      let paymentCampScopeSql = "";
      const paymentCampScopeArgs: any[] = [];
      if (isReportUserRestricted && effectiveAllowedCamps.length > 0) {
        const placeholders = effectiveAllowedCamps.map(() => "?").join(",");
        paymentCampScopeSql = ` AND camp_name IN (${placeholders})`;
        paymentCampScopeArgs.push(...effectiveAllowedCamps);
      }

      const lastMonthCollectionSql = `
        SELECT COUNT(*) as count, SUM(COALESCE(amount, 0)) as revenue
        FROM payments
        WHERE (paid_for_year_month = ? OR (payment_date >= ? AND payment_date <= ?)) ${paymentCampScopeSql}
      `;
      const lastMonthCollectionRow = (await db.execute({ 
        sql: lastMonthCollectionSql, 
        args: [lastMonthYearMonth, `${lastMonthYearMonth}-01`, `${lastMonthYearMonth}-${String(lastDayOfPrevMonth).padStart(2, "0")}`, ...paymentCampScopeArgs] 
      })).rows[0] as unknown as {
        count: number;
        revenue: number | null;
      };

      lastMonthSalesCount = Number(lastMonthSalesRow?.count || 0);
      lastMonthSalesRevenue = Number(lastMonthSalesRow?.revenue || 0);
      lastMonthCollectionCount = Number(lastMonthCollectionRow?.count || 0);
      lastMonthCollectionRevenue = Number(lastMonthCollectionRow?.revenue || 0);

      // Today sales breakdown per camp
      const todayCampSql = `
        SELECT 
          COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(c.name, ''), NULLIF(v.router_id, ''), 'Camp') as campName, 
          SUM(${unitCountExpr}) as count, 
          SUM(${priceExpr}) as revenue 
        FROM vouchers v
        LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
        LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name)
        LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
        LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
        WHERE v.status = 'redeemed' AND v.used_at >= ? AND v.used_at <= ? ${campScopeSql}
        GROUP BY campName
        ORDER BY revenue DESC
      `;
      const todayCampsRows = (await db.execute({ sql: todayCampSql, args: [`${today} 00:00:00`, `${today} 23:59:59`, ...campScopeArgs] })).rows as unknown as {
        campName: string;
        count: number;
        revenue: number;
      }[];
      finalTodayCamps = todayCampsRows || [];

      // All-time Allowed Camps Sold Amount & Count (for Outstanding Balance / Full Sold Overview)
      const allTimeSummarySql = `
        SELECT 
          SUM(${unitCountExpr}) as allTimeSales, 
          SUM(${priceExpr}) as allTimeRevenue 
        FROM vouchers v
        LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
        LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
        WHERE v.status = 'redeemed' ${campScopeSql}
      `;
      const allTimeRow = (await db.execute({ sql: allTimeSummarySql, args: [...campScopeArgs] })).rows[0] as unknown as {
        allTimeSales: number | null;
        allTimeRevenue: number | null;
      } | undefined;

      totalSales = Number(allTimeRow?.allTimeSales || 0);
      totalRevenue = Number(allTimeRow?.allTimeRevenue || 0);
    } else {
      totalSales = 0;
      totalRevenue = 0;
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalSales,
        totalRevenue: totalRevenue || 0,
        activeAgentsCount: finalAgents.length,
      },
      comparison: {
        today: { 
          sales: todaySales, 
          revenue: todayRevenue,
          camps: finalTodayCamps || []
        },
        yesterday: { sales: yesterdaySales, revenue: yesterdayRevenue },
        thisMonth: {
          sales: thisMonthSalesCount || 0,
          revenue: thisMonthSalesRevenue || 0,
        },
      },
      lastMonth: {
        sales: {
          count: lastMonthSalesCount || 0,
          revenue: lastMonthSalesRevenue || 0,
        },
        collection: {
          count: lastMonthCollectionCount || 0,
          revenue: lastMonthCollectionRevenue || 0,
        }
      },
      agents: finalAgents,
      camps: finalCamps,
      companies: finalCompanies,
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
