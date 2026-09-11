import { extractAuthToken, type JwtAuthPayload } from "@/lib/auth-crypto";
import { getDB } from "@/lib/db";

export interface FilterParams {
  startDate?: string;
  endDate?: string;
  agent?: string;
  validity?: string;
  router?: string;
  search?: string;
}

export async function buildWhereClauseAsync(
  searchParams: URLSearchParams,
  request?: Request
): Promise<{
  whereClause: string;
  params: any[];
  userPayload: JwtAuthPayload | null;
  effectiveAllowedCamps: string[];
  effectiveCompanyId: number | null;
  isReportUserRestricted: boolean;
}> {
  const params: any[] = [];
  const conditions: string[] = ["v.status = 'redeemed'"]; // We only report on sold/used vouchers

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const agent = searchParams.get("agent");
  const validity = searchParams.get("validity");
  const router = searchParams.get("router");
  const camp = searchParams.get("camp");
  const soldType = searchParams.get("soldType");
  const search = searchParams.get("search");

  // Date filtering: SQLite stores datetime in UTC. Convert to Dubai time (UTC+4) for business day filtering
  if (startDate) {
    conditions.push("date(v.used_at, '+4 hours') >= date(?)");
    params.push(startDate);
  }
  
  if (endDate) {
    conditions.push("date(v.used_at, '+4 hours') <= date(?)");
    params.push(endDate);
  }

  if (agent && agent !== "all" && agent !== "") {
    conditions.push(`(
      v.sold_by = ? 
      OR v.sold_by IN (SELECT username FROM sales_persons WHERE username = ? OR display_name = ?)
      OR v.sold_by IN (SELECT display_name FROM sales_persons WHERE username = ? OR display_name = ?)
      OR v.sales_person_id IN (SELECT id FROM sales_persons WHERE username = ? OR display_name = ?)
      OR v.sold_by LIKE ?
    )`);
    params.push(agent, agent, agent, agent, agent, agent, agent, `%${agent}%`);
  }

  if (validity && validity !== "all" && validity !== "") {
    conditions.push("v.validity_days = ?");
    params.push(Number(validity));
  }

  if (router && router !== "all" && router !== "") {
    conditions.push("v.router_id = ?");
    params.push(router);
  }

  if (camp && camp !== "all" && camp !== "") {
    conditions.push(`(
      v.router_id IN (SELECT id FROM routers WHERE camp = ?) 
      OR v.router_id IN (SELECT sessionName FROM routers WHERE camp = ?) 
      OR v.router_id = ?
    )`);
    params.push(camp, camp, camp);
  }

  if (soldType === "paid") {
    conditions.push("COALESCE(v.price_charged, 0) > 0");
  } else if (soldType === "free") {
    conditions.push("COALESCE(v.price_charged, 0) = 0");
  }

  if (search && search.trim() !== "") {
    conditions.push("(v.used_by LIKE ? OR v.voucher_code LIKE ?)");
    const likeParam = `%${search.trim()}%`;
    params.push(likeParam, likeParam);
  }

  // -----------------------------------------------------------------------------
  // SECURE TENANT & CAMP SCOPING:
  // Validate token identity or fallback username against database to resolve
  // canonical permissions rather than blindly trusting client query parameters.
  // -----------------------------------------------------------------------------
  let userPayload: JwtAuthPayload | null = request ? extractAuthToken(request) : null;
  let effectiveAllowedCamps: string[] = [];
  let effectiveCompanyId: number | null = null;
  let isReportUserRestricted = false;

  const rawUserType = searchParams.get("userType") || userPayload?.role || userPayload?.userType;
  const rawUsername = searchParams.get("username") || userPayload?.sub;

  const db = await getDB();

  // Query database authoritatively for user identity and permissions
  if (rawUsername) {
    try {
      // 1. Check report_users table
      const repRes = await db.execute({
        sql: `
          SELECT ru.allowed_camp_ids, ru.company_id, ru.status,
                 COALESCE(c.status, 1) as company_status, c.suspended_reason
          FROM report_users ru
          LEFT JOIN companies c ON ru.company_id = c.id
          WHERE LOWER(ru.username) = LOWER(?)
          LIMIT 1
        `,
        args: [rawUsername.trim()],
      });

      if (repRes.rows.length > 0) {
        isReportUserRestricted = true;
        const rRow = repRes.rows[0];

        // PAUSE ENFORCEMENT: If report user account is paused, immediately block request
        if (Number(rRow.status ?? 1) === 0) {
          throw new Error("ACCOUNT_PAUSED: Your account has been paused by the administrator.");
        }

        // Dues enforcement: If company is suspended
        if (rRow.company_status !== undefined && Number(rRow.company_status) === 0) {
          throw new Error("COMPANY_SUSPENDED: " + (rRow.suspended_reason ? String(rRow.suspended_reason) : "Account suspended due to company dues."));
        }

        effectiveCompanyId = rRow.company_id ? Number(rRow.company_id) : null;
        if (rRow.allowed_camp_ids) {
          try {
            const parsed = JSON.parse(String(rRow.allowed_camp_ids));
            if (Array.isArray(parsed)) effectiveAllowedCamps = parsed;
          } catch {
            effectiveAllowedCamps = [String(rRow.allowed_camp_ids)];
          }
        }
      } else {
        // 2. Check sales_persons table
        const spRes = await db.execute({
          sql: "SELECT allowed_camps, company_id FROM sales_persons WHERE LOWER(username) = LOWER(?) OR LOWER(display_name) = LOWER(?) LIMIT 1",
          args: [rawUsername.trim(), rawUsername.trim()],
        });

        if (spRes.rows.length > 0) {
          isReportUserRestricted = true;
          const spRow = spRes.rows[0];
          effectiveCompanyId = spRow.company_id ? Number(spRow.company_id) : null;
          if (spRow.allowed_camps) {
            try {
              const parsed = JSON.parse(String(spRow.allowed_camps));
              if (Array.isArray(parsed)) effectiveAllowedCamps = parsed;
            } catch {
              effectiveAllowedCamps = [String(spRow.allowed_camps)];
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && (err.message.includes("ACCOUNT_PAUSED") || err.message.includes("COMPANY_SUSPENDED"))) {
        throw err;
      }
      console.warn("Error fetching authoritative permissions from DB:", err);
    }
  }

  const isSuperAdmin = rawUserType === "superadmin" || userPayload?.role === "superadmin" || userPayload?.userType === "superadmin";

  if (!isSuperAdmin) {
    if (rawUserType === "report_user" || rawUserType === "salesperson" || (userPayload && userPayload.role !== "superadmin")) {
      isReportUserRestricted = true;
    }
  } else {
    isReportUserRestricted = false;
  }

  // Fallback to token allowedCamps if DB lookup had no rows
  if (isReportUserRestricted && effectiveAllowedCamps.length === 0 && userPayload?.allowedCamps && userPayload.allowedCamps.length > 0) {
    effectiveAllowedCamps = userPayload.allowedCamps;
  }

  // Enforce allowed camps filter for restricted users
  if (isReportUserRestricted) {
    if (effectiveAllowedCamps.length === 0) {
      // User has 0 allowed camps -> Return NO records
      conditions.push("1 = 0");
    } else {
      const placeholders = effectiveAllowedCamps.map(() => "?").join(",");
      conditions.push(`(
        v.router_id IN (${placeholders})
        OR v.router_id IN (SELECT id FROM routers WHERE camp IN (${placeholders}))
        OR v.router_id IN (SELECT sessionName FROM routers WHERE camp IN (${placeholders}))
      )`);
      params.push(...effectiveAllowedCamps, ...effectiveAllowedCamps, ...effectiveAllowedCamps);
    }
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return {
    whereClause,
    params,
    userPayload,
    effectiveAllowedCamps,
    effectiveCompanyId,
    isReportUserRestricted,
  };
}

export function buildWhereClause(searchParams: URLSearchParams): {
  whereClause: string;
  params: any[];
} {
  const params: any[] = [];
  const conditions: string[] = ["v.status = 'redeemed'"];

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const agent = searchParams.get("agent");
  const validity = searchParams.get("validity");
  const router = searchParams.get("router");
  const camp = searchParams.get("camp");
  const soldType = searchParams.get("soldType");
  const search = searchParams.get("search");

  if (startDate) {
    conditions.push("date(v.used_at, '+4 hours') >= date(?)");
    params.push(startDate);
  }
  
  if (endDate) {
    conditions.push("date(v.used_at, '+4 hours') <= date(?)");
    params.push(endDate);
  }

  if (agent && agent !== "all" && agent !== "") {
    conditions.push(`(
      v.sold_by = ? 
      OR v.sold_by IN (SELECT username FROM sales_persons WHERE username = ? OR display_name = ?)
      OR v.sold_by IN (SELECT display_name FROM sales_persons WHERE username = ? OR display_name = ?)
      OR v.sales_person_id IN (SELECT id FROM sales_persons WHERE username = ? OR display_name = ?)
      OR v.sold_by LIKE ?
    )`);
    params.push(agent, agent, agent, agent, agent, agent, agent, `%${agent}%`);
  }

  if (validity && validity !== "all" && validity !== "") {
    conditions.push("v.validity_days = ?");
    params.push(Number(validity));
  }

  if (router && router !== "all" && router !== "") {
    conditions.push("v.router_id = ?");
    params.push(router);
  }

  if (camp && camp !== "all" && camp !== "") {
    conditions.push(`(
      v.router_id IN (SELECT id FROM routers WHERE camp = ?) 
      OR v.router_id IN (SELECT sessionName FROM routers WHERE camp = ?) 
      OR v.router_id = ?
    )`);
    params.push(camp, camp, camp);
  }

  if (soldType === "paid") {
    conditions.push("COALESCE(v.price_charged, 0) > 0");
  } else if (soldType === "free") {
    conditions.push("COALESCE(v.price_charged, 0) = 0");
  }

  if (search && search.trim() !== "") {
    conditions.push("(v.used_by LIKE ? OR v.voucher_code LIKE ?)");
    const likeParam = `%${search.trim()}%`;
    params.push(likeParam, likeParam);
  }

  const allowedCampsParam = searchParams.get("allowedCamps");
  const userType = searchParams.get("userType");
  if (userType === "report_user") {
    if (!allowedCampsParam || allowedCampsParam.trim() === "" || allowedCampsParam === "[]") {
      conditions.push("1 = 0");
    } else {
      let allowedCamps: string[] = [];
      try {
        allowedCamps = JSON.parse(allowedCampsParam);
      } catch {
        allowedCamps = allowedCampsParam.split(",").map(s => s.trim()).filter(Boolean);
      }

      if (allowedCamps.length === 0) {
        conditions.push("1 = 0");
      } else {
        const placeholders = allowedCamps.map(() => "?").join(",");
        conditions.push(`(
          v.router_id IN (${placeholders})
          OR v.router_id IN (SELECT id FROM routers WHERE camp IN (${placeholders}))
          OR v.router_id IN (SELECT sessionName FROM routers WHERE camp IN (${placeholders}))
        )`);
        params.push(...allowedCamps, ...allowedCamps, ...allowedCamps);
      }
    }
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return {
    whereClause,
    params,
  };
}
