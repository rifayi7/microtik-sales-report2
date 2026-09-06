import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const query = `
      SELECT 
        sp.id, 
        sp.username, 
        sp.display_name, 
        sp.role, 
        sp.camp_name, 
        sp.company_name, 
        sp.company_id, 
        sp.allowed_camps, 
        sp.allowed_router_ids,
        c.id as resolved_company_id, 
        c.name as resolved_company_name
      FROM sales_persons sp
      LEFT JOIN companies c ON (sp.company_id IS NOT NULL AND c.id = sp.company_id) OR (sp.company_name IS NOT NULL AND LOWER(c.name) = LOWER(sp.company_name))
      ORDER BY sp.id ASC
    `;
    const result = await db.execute({ sql: query, args: [] });

    const salesPersons = result.rows.map((row: any) => {
      let allowedCamps: string[] = [];
      if (row.allowed_camps) {
        try {
          const parsed = JSON.parse(String(row.allowed_camps));
          allowedCamps = Array.isArray(parsed) ? parsed : [String(row.allowed_camps)];
        } catch {
          allowedCamps = [String(row.allowed_camps)];
        }
      } else if (row.camp_name && row.camp_name !== "All Camps") {
        allowedCamps = [String(row.camp_name)];
      }

      const finalCompanyName = String(row.resolved_company_name || row.company_name || "").trim();

      return {
        id: row.id,
        username: String(row.username || "").trim(),
        displayName: String(row.display_name || row.username || "").trim(),
        companyName: finalCompanyName,
        companyId: row.resolved_company_id ? Number(row.resolved_company_id) : (row.company_id ? Number(row.company_id) : null),
        campName: String(row.camp_name || "").trim(),
        allowedCamps: allowedCamps.map((c: string) => c.trim()).filter(Boolean),
      };
    });

    return NextResponse.json({
      success: true,
      data: salesPersons
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sales persons" },
      { status: 500 }
    );
  }
}

