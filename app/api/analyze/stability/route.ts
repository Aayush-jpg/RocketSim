import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rocket, environment, analysisType = "comprehensive" } = body;

    // Forward request to RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://localhost:8000";
    const response = await fetch(`${rocketpyUrl}/analyze/stability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rocket,
        environment: environment || {},
        analysisType
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RocketPy stability analysis failed:", errorText);
      throw new Error(`Stability analysis failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Add metadata
    result.timestamp = new Date().toISOString();
    result.analysisType = analysisType;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Stability analysis API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stability analysis failed" },
      { status: 500 }
    );
  }
} 