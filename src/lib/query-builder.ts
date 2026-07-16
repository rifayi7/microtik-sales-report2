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
  const conditions: string[] = ["v.is_used = 1"]; // We only report on sold/used vouchers

  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const agent = searchParams.get("agent");
  const validity = searchParams.get("validity");
  const router = searchParams.get("router");
  const search = searchParams.get("search");

  // Date filtering: SQLite stores datetime('now') as 'YYYY-MM-DD HH:MM:SS' (UTC)
  // Ensure we match local date ranges by formatting them
  if (startDate) {
    // e.g. '2026-07-16' becomes '2026-07-16 00:00:00'
    conditions.push("v.used_at >= ?");
    params.push(`${startDate} 00:00:00`);
  }
  
  if (endDate) {
    // e.g. '2026-07-16' becomes '2026-07-16 23:59:59'
    conditions.push("v.used_at <= ?");
    params.push(`${endDate} 23:59:59`);
  }

  if (agent && agent !== "all" && agent !== "") {
    conditions.push("v.sold_by = ?");
    params.push(agent);
  }

  if (validity && validity !== "all" && validity !== "") {
    conditions.push("v.validity_days = ?");
    params.push(Number(validity));
  }

  if (router && router !== "all" && router !== "") {
    conditions.push("v.router_id = ?");
    params.push(router);
  }

  if (search && search.trim() !== "") {
    conditions.push("(v.used_by LIKE ? OR v.voucher_code LIKE ?)");
    const likeParam = `%${search.trim()}%`;
    params.push(likeParam, likeParam);
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  return {
    whereClause,
    params,
  };
}
