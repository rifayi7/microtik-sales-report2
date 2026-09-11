import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { extractAuthToken } from "@/lib/auth-crypto";

export const runtime = "nodejs";

const unitCountExpr = `COALESCE(cvp.unit, vp.unit_weight, CASE WHEN v.validity_days = 30 THEN 1.0 WHEN v.validity_days = 15 THEN 0.5 WHEN v.validity_days = 7 THEN 0.25 ELSE CAST(v.validity_days AS REAL) / 30.0 END)`;
const priceExpr = `COALESCE(v.price_charged, cvp.price, CASE WHEN v.validity_days = 30 THEN 32 ELSE 16 END)`;

const campSalesSql = (campScopeSql: string) => `
  SELECT 
    COALESCE(NULLIF(r.camp, ''), NULLIF(r.sessionName, ''), NULLIF(c.name, ''), NULLIF(v.router_id, ''), 'Camp') as campName,
    SUM(${unitCountExpr}) as salesCount,
    SUM(${priceExpr}) as revenue
  FROM vouchers v
  LEFT JOIN routers r ON (CAST(r.id AS TEXT) = CAST(v.router_id AS TEXT) OR r.sessionName = v.router_id)
  LEFT JOIN camps c ON (v.router_id = c.name OR CAST(v.router_id AS TEXT) = CAST(c.id AS TEXT) OR v.router_id = c.hotspot_name OR r.camp = c.name)
  LEFT JOIN camp_validity_pricing cvp ON (cvp.router_id = v.router_id AND cvp.validity = v.validity_days)
  LEFT JOIN validity_profiles vp ON (vp.name = v.validity_days || '-Days' OR vp.name = v.validity_days || '-D' OR CAST(vp.name AS INTEGER) = v.validity_days)
  WHERE v.status = 'redeemed'
    AND date(v.used_at, '+4 hours') >= date(?)
    AND date(v.used_at, '+4 hours') <= date(?)
    ${campScopeSql}
  GROUP BY campName
  ORDER BY revenue DESC
`;

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const analysisMonth = url.searchParams.get("analysisMonth"); // "YYYY-MM"
    const rawUsername = url.searchParams.get("username") || extractAuthToken(request)?.sub;
    const rawUserType = url.searchParams.get("userType") || extractAuthToken(request)?.role;

    if (!analysisMonth || !/^\d{4}-\d{2}$/.test(analysisMonth)) {
      return NextResponse.json({ error: "analysisMonth (YYYY-MM) is required" }, { status: 400 });
    }

    // --- Resolve authoritative camp permissions from DB ---
    let effectiveAllowedCamps: string[] = [];
    let isReportUserRestricted = false;

    if (rawUsername) {
      try {
        const repRes = await db.execute({
          sql: `
            SELECT ru.allowed_camp_ids, ru.status,
                   COALESCE(c.status, 1) as company_status, c.suspended_reason
            FROM report_users ru
            LEFT JOIN companies c ON ru.company_id = c.id
            WHERE LOWER(ru.username) = LOWER(?)
            LIMIT 1
          `,
          args: [rawUsername.trim()],
        });
        if (repRes.rows.length > 0) {
          const r = repRes.rows[0];
          if (Number(r.status ?? 1) === 0) {
            return NextResponse.json({ error: "ACCOUNT_PAUSED: Your account has been paused by the administrator.", isPaused: true }, { status: 403 });
          }
          if (r.company_status !== undefined && Number(r.company_status) === 0) {
            return NextResponse.json({ error: "COMPANY_SUSPENDED: " + (r.suspended_reason || "Account suspended due to company dues."), isSuspended: true }, { status: 403 });
          }
          isReportUserRestricted = true;
          if (r.allowed_camp_ids) {
            try {
              const parsed = JSON.parse(String(r.allowed_camp_ids));
              if (Array.isArray(parsed)) effectiveAllowedCamps = parsed;
            } catch {
              effectiveAllowedCamps = [String(r.allowed_camp_ids)];
            }
          }
        } else {
          const spRes = await db.execute({
            sql: "SELECT allowed_camps FROM sales_persons WHERE LOWER(username) = LOWER(?) OR LOWER(display_name) = LOWER(?) LIMIT 1",
            args: [rawUsername.trim(), rawUsername.trim()],
          });
          if (spRes.rows.length > 0) {
            isReportUserRestricted = true;
            const r = spRes.rows[0];
            if (r.allowed_camps) {
              try {
                const parsed = JSON.parse(String(r.allowed_camps));
                if (Array.isArray(parsed)) effectiveAllowedCamps = parsed;
              } catch {
                effectiveAllowedCamps = [String(r.allowed_camps)];
              }
            }
          }
        }
      } catch (err) {
        console.warn("DB perm lookup failed:", err);
      }
    }

    if (!isReportUserRestricted && (rawUserType === "report_user" || rawUserType === "salesperson")) {
      isReportUserRestricted = true;
    }

    // --- Build camp scope SQL ---
    let campScopeSql = "";
    const campScopeArgs: string[] = [];

    if (isReportUserRestricted) {
      if (effectiveAllowedCamps.length === 0) {
        // Zero access: return empty immediately
        return NextResponse.json({
          success: true,
          analysisMonth,
          currentMonth: [],
          previousMonth: [],
          allowedCamps: [],
        });
      }
      const ph = effectiveAllowedCamps.map(() => "?").join(",");
      campScopeSql = `AND (
        v.router_id IN (${ph})
        OR v.router_id IN (SELECT id FROM routers WHERE camp IN (${ph}))
        OR v.router_id IN (SELECT sessionName FROM routers WHERE camp IN (${ph}))
      )`;
      campScopeArgs.push(...effectiveAllowedCamps, ...effectiveAllowedCamps, ...effectiveAllowedCamps);
    }

    // --- Compute month date ranges ---
    const [yearStr, monthStr] = analysisMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    const currStart = `${yearStr}-${monthStr}-01`;
    const currLastDay = new Date(year, month, 0).getDate();
    const currEnd = `${yearStr}-${monthStr}-${String(currLastDay).padStart(2, "0")}`;

    const prevDate = new Date(year, month - 2, 1); // month-1 in JS Date (0-indexed)
    const prevYear = prevDate.getFullYear();
    const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
    const prevStart = `${prevYear}-${prevMonth}-01`;
    const prevLastDay = new Date(prevYear, prevDate.getMonth() + 1, 0).getDate();
    const prevEnd = `${prevYear}-${prevMonth}-${String(prevLastDay).padStart(2, "0")}`;

    const sql = campSalesSql(campScopeSql);

    const [currRows, prevRows] = await Promise.all([
      db.execute({ sql, args: [currStart, currEnd, ...campScopeArgs] }),
      db.execute({ sql, args: [prevStart, prevEnd, ...campScopeArgs] }),
    ]);

    return NextResponse.json({
      success: true,
      analysisMonth,
      previousMonthKey: `${prevYear}-${prevMonth}`,
      currentMonth: currRows.rows as unknown as { campName: string; salesCount: number; revenue: number }[],
      previousMonth: prevRows.rows as unknown as { campName: string; salesCount: number; revenue: number }[],
      allowedCamps: effectiveAllowedCamps,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load monthly camp analysis" },
      { status: 500 }
    );
  }
}
