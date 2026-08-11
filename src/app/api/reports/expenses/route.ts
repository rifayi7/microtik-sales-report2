import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = getDB();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const company = url.searchParams.get("company");
    const category = url.searchParams.get("category");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const commonOnly = url.searchParams.get("commonOnly") === "true";

    let query = "SELECT * FROM expenses";
    let conditions: string[] = [];
    let params: any[] = [];

    if (search && search.trim() !== "") {
      conditions.push("(supplier_name LIKE ? OR description LIKE ? OR expense_by LIKE ?)");
      const paramVal = `%${search.trim()}%`;
      params.push(paramVal, paramVal, paramVal);
    }

    if (company && company !== "all" && company !== "") {
      conditions.push("company_name = ?");
      params.push(company);
    }

    if (category && category !== "all" && category !== "") {
      conditions.push("expense_category = ?");
      params.push(category);
    }

    if (startDate) {
      conditions.push("expense_date >= ?");
      params.push(startDate);
    }

    if (endDate) {
      conditions.push("expense_date <= ?");
      params.push(endDate);
    }

    if (commonOnly) {
      conditions.push("company_name IS NULL");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY expense_date DESC";

    const rows = db.prepare(query).all(...params) as any[];
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDB();
    const { id, company_name, common_category, expense_category, supplier_name, expense_date, expense_by, amount, description, action } = await request.json();

    if (action === "delete") {
      db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      return NextResponse.json({ success: true });
    }

    if (!expense_category || !expense_date || !expense_by || !amount) {
      return NextResponse.json({ error: "Category, Date, Staff and Amount are required" }, { status: 400 });
    }

    if (id) {
      db.prepare(`
        UPDATE expenses 
        SET company_name = ?, common_category = ?, expense_category = ?, supplier_name = ?, expense_date = ?, expense_by = ?, amount = ?, description = ?
        WHERE id = ?
      `).run(company_name || null, common_category || null, expense_category, supplier_name || null, expense_date, expense_by, amount, description || null, id);
    } else {
      db.prepare(`
        INSERT INTO expenses (company_name, common_category, expense_category, supplier_name, expense_date, expense_by, amount, description) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(company_name || null, common_category || null, expense_category, supplier_name || null, expense_date, expense_by, amount, description || null);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save expense" }, { status: 500 });
  }
}
