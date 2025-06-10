import { NextRequest, NextResponse } from "next/server";
import { getMotors } from "@/lib/data/motors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Mark route as dynamic to prevent static generation issues

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "solid" | "liquid" | "hybrid" | null;
    const manufacturer = searchParams.get("manufacturer");
    const impulseClass = searchParams.get("impulseClass");
    
    // Apply filters to get motors
    const motors = getMotors({
      ...(type && { type }),
      ...(manufacturer && { manufacturer }),
      ...(impulseClass && { impulseClass }),
    });
    
    // Return motors in component-based format (no legacy conversion needed)
    const response = motors.map(motor => ({
      ...motor
    }));
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    });
  } catch (error) {
    console.error("Motor API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch motors" }, 
      { status: 500 }
    );
  }
} 