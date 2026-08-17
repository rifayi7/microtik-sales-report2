import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const camp = url.searchParams.get("camp");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const paidYearMonth = url.searchParams.get("paidYearMonth");
    const collectedOnly = url.searchParams.get("collectedOnly") === "true";

    let query = "SELECT * FROM payments";
    let conditions: string[] = [];
    let params: any[] = [];

    if (search && search.trim() !== "") {
      conditions.push("(paid_by_user LIKE ? OR collected_by LIKE ? OR split_by LIKE ?)");
      const paramVal = `%${search.trim()}%`;
      params.push(paramVal, paramVal, paramVal);
    }

    if (camp && camp !== "all" && camp !== "") {
      conditions.push("camp_name = ?");
      params.push(camp);
    }

    if (startDate) {
      conditions.push("payment_date >= ?");
      params.push(startDate);
    }

    if (endDate) {
      conditions.push("payment_date <= ?");
      params.push(endDate);
    }

    if (paidYearMonth && paidYearMonth.trim() !== "") {
      conditions.push("paid_for_year_month = ?");
      params.push(paidYearMonth);
    }

    if (collectedOnly) {
      conditions.push("verified_status = 1");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY payment_date DESC, payment_time DESC";

    const rows = (await db.execute({ sql: query, args: [...params] })).rows as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load payments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const { id, paid_by_user, camp_name, paid_for_year_month, amount, collected_by, split_by, payment_date, payment_time, verified_status, action } = await request.json();

    if (action === "delete") {
      await db.execute({ sql: "DELETE FROM payments WHERE id = ?", args: [id] });
      return NextResponse.json({ success: true });
    }

    if (action === "verify") {
      await db.execute({ sql: "UPDATE payments SET verified_status = ? WHERE id = ?", args: [verified_status, id] });
      return NextResponse.json({ success: true });
    }

    if (!paid_by_user || !camp_name || !paid_for_year_month || !amount) {
      return NextResponse.json({ error: "Paid by user, Camp, Month and Amount are required" }, { status: 400 });
    }

    if (id) {
      await db.execute({ sql: `
        UPDATE payments 
        SET paid_by_user = ?, camp_name = ?, paid_for_year_month = ?, amount = ?, collected_by = ?, split_by = ?, payment_date = ?, payment_time = ?
        WHERE id = ?
      `, args: [paid_by_user, camp_name, paid_for_year_month, amount, collected_by || null, split_by || null, payment_date || null, payment_time || null, id] });
    } else {
      const now = new Date();
      const pDate = payment_date || now.toISOString().split("T")[0];
      const pTime = payment_time || now.toTimeString().split(" ")[0];
      await db.execute({ sql: `
        INSERT INTO payments (paid_by_user, camp_name, paid_for_year_month, amount, collected_by, split_by, payment_date, payment_time, verified_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `, args: [paid_by_user, camp_name, paid_for_year_month, amount, collected_by || null, split_by || null, pDate, pTime] });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save payment" }, { status: 500 });
  }
}
