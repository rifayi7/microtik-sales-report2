export interface FilterParams {
  startDate?: string;
  endDate?: string;
  agent?: string;
  validity?: string;
  router?: string;
  search?: string;
}

export function buildWhereClause(searchParams: URLSearchParams): {
  whereClause: string;
  params: any[];
} {
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

  // Scoping for report viewers / assigned camps
  const allowedCampsParam = searchParams.get("allowedCamps");
  const userType = searchParams.get("userType");
  if (userType === "report_user") {
    if (!allowedCampsParam || allowedCampsParam.trim() === "" || allowedCampsParam === "[]") {
      // User has 0 allowed camps -> Return NO records
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
