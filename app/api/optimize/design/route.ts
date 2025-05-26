import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rocket, target = "max_altitude", constraints = {}, method = "professional" } = body;

    // Forward request to RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://localhost:8000";
    const response = await fetch(`${rocketpyUrl}/optimize/design`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rocket,
        target,
        constraints,
        method
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RocketPy design optimization failed:", errorText);
      throw new Error(`Design optimization failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Add metadata
    result.timestamp = new Date().toISOString();
    result.optimizationTarget = target;
    result.optimizationMethod = method;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Design optimization API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Design optimization failed" },
      { status: 500 }
    );
  }
} 