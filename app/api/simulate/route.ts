import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rocket, environment, launchParameters, fidelity = "standard" } = body;

    // Determine the appropriate RocketPy endpoint based on fidelity
    let rocketpyEndpoint = "/simulate";
    if (fidelity === "enhanced" || fidelity === "hifi") {
      rocketpyEndpoint = "/simulate/enhanced";
    } else if (fidelity === "professional") {
      rocketpyEndpoint = "/simulate/professional";
    }

    // Forward request to RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://localhost:8000";
    const response = await fetch(`${rocketpyUrl}${rocketpyEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rocket,
        environment: environment || {
          latitude: 0,
          longitude: 0,
          elevation: 0,
          windSpeed: 0,
          windDirection: 0,
          atmosphericModel: "standard"
        },
        launchParameters: launchParameters || {
          railLength: 5.0,
          inclination: 85.0,
          heading: 0.0
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RocketPy simulation failed:", errorText);
      throw new Error(`Simulation failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Add metadata
    result.simulationFidelity = fidelity;
    result.timestamp = new Date().toISOString();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simulation failed" },
      { status: 500 }
    );
  }
} 