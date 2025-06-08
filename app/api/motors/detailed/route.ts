import { NextRequest, NextResponse } from "next/server";
import { MOTOR_DATABASE } from "@/lib/data/motors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Ensure dynamic behavior for API routes

export async function GET(req: NextRequest) {
  try {
    // Use centralized motor database directly for detailed specs
    const result = {
      motors: MOTOR_DATABASE,
      timestamp: new Date().toISOString(),
      total_count: Object.keys(MOTOR_DATABASE).length,
      categories: {
        solid: Object.values(MOTOR_DATABASE).filter(m => m.type === "solid").length,
        liquid: Object.values(MOTOR_DATABASE).filter(m => m.type === "liquid").length,
        hybrid: Object.values(MOTOR_DATABASE).filter(m => m.type === "hybrid").length
      }
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Motor data API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Motor data retrieval failed" },
      { status: 500 }
    );
  }
} 