import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rocket, environment, launchParameters, simulationType } = body;
    
    // Default to RocketPy service URL
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://rocketpy:8000";
    
    // Determine endpoint based on simulation type
    let endpoint = "/simulate";
    if (simulationType === "hifi") {
      endpoint = "/simulate/hifi";
    } else if (simulationType === "monte_carlo") {
      endpoint = "/simulate/monte-carlo";
    }
    
    // Prepare request payload
    const requestData = {
      rocket,
      environment: environment || {
        latitude: 0.0,
        longitude: 0.0,
        elevation: 0.0,
        windSpeed: 0.0,
        windDirection: 0.0,
        atmosphericModel: "standard"
      },
      launchParameters: launchParameters || {
        railLength: 5.0,
        inclination: 85.0,
        heading: 0.0
      },
      simulationType: simulationType || "standard"
    };
    
    console.log(`🚀 Proxying simulation request to ${rocketpyUrl}${endpoint}`);
    
    const response = await fetch(`${rocketpyUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ RocketPy simulation failed: ${response.status} ${errorText}`);
      throw new Error(`Simulation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Simulation completed successfully`);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("❌ Simulation API error:", error);
    
    // Return a simplified fallback simulation
    const fallbackResult = {
      maxAltitude: 500.0,
      maxVelocity: 150.0,
      maxAcceleration: 100.0,
      apogeeTime: 10.0,
      stabilityMargin: 1.5,
      thrustCurve: [
        [0.0, 0.0],
        [0.5, 800.0],
        [2.0, 600.0],
        [2.5, 0.0]
      ],
      simulationFidelity: "fallback"
    };
    
    return NextResponse.json(fallbackResult);
  }
} 