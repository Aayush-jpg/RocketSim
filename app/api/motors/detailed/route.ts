import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Forward request to RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://localhost:8000";
    const response = await fetch(`${rocketpyUrl}/motors/detailed`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RocketPy motor data failed:", errorText);
      throw new Error(`Motor data retrieval failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Add metadata
    result.timestamp = new Date().toISOString();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Motor data API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Motor data retrieval failed" },
      { status: 500 }
    );
  }
} 