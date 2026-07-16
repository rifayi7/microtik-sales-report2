import { NextResponse } from "next/server";
import { getPricingMap, updatePrice } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pricing = getPricingMap();
    return NextResponse.json({ success: true, pricing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load pricing" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { validity_days, price } = await request.json();
    
    if (typeof validity_days !== "number" || typeof price !== "number") {
      return NextResponse.json(
        { error: "validity_days and price must be numbers" },
        { status: 400 }
      );
    }

    updatePrice(validity_days, price);
    const updatedPricing = getPricingMap();
    
    return NextResponse.json({ success: true, pricing: updatedPricing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update pricing" },
      { status: 500 }
    );
  }
}
