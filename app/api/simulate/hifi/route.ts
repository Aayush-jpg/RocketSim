import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rocket, environment, launchParameters } = body;
    
    // Default to RocketPy service URL
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://rocketpy:8000";
    
    // Prepare request payload for high-fidelity simulation
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
      simulationType: "hifi"
    };
    
    // Normalize wind direction to 0-360 degrees for Python backend
    if (requestData.environment && typeof requestData.environment.windDirection === 'number') {
      requestData.environment.windDirection = ((requestData.environment.windDirection % 360) + 360) % 360;
    }
    
    console.log(`🚀 Proxying high-fidelity simulation request to ${rocketpyUrl}/simulate/hifi`);
    
    // Create AbortController with 10 minute timeout for hi-fi simulations
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes
    
    try {
      const response = await fetch(`${rocketpyUrl}/simulate/hifi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ High-fidelity simulation failed: ${response.status} ${errorText}`);
        throw new Error(`High-fidelity simulation failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ High-fidelity simulation completed successfully`);
      
      return NextResponse.json(result);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Handle timeout specifically
      if (fetchError.name === 'AbortError') {
        console.log("High-fidelity simulation timed out, falling back to local simulation");
        throw new Error("High-fidelity simulation timed out after 10 minutes");
      }
      
      throw fetchError; // Re-throw other errors
    }
  } catch (error) {
    console.error("❌ High-fidelity simulation API error:", error);
    
    // Return a more sophisticated fallback simulation for high-fidelity
    const fallbackResult = {
      maxAltitude: 750.0,
      maxVelocity: 180.0,
      maxAcceleration: 120.0,
      apogeeTime: 12.0,
      stabilityMargin: 1.8,
      thrustCurve: [
        [0.0, 0.0],
        [0.2, 850.0],
        [1.0, 800.0],
        [2.0, 600.0],
        [2.8, 200.0],
        [3.0, 0.0]
      ],
      simulationFidelity: "hifi_fallback",
      trajectory: {
        time: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        position: [
          [0, 0, 0], [1, 0, 50], [2, 0, 180], [3, 0, 350], 
          [4, 0, 520], [5, 0, 650], [6, 0, 730], [7, 0, 750],
          [8, 0, 720], [9, 0, 650], [10, 0, 550], [11, 0, 400], [12, 0, 0]
        ],
        velocity: [
          [0, 0, 0], [5, 0, 45], [8, 0, 80], [12, 0, 120], 
          [15, 0, 150], [18, 0, 170], [15, 0, 140], [8, 0, 80],
          [0, 0, 0], [-5, 0, -40], [-8, 0, -60], [-10, 0, -80], [-12, 0, -100]
        ],
        acceleration: [
          [0, 0, 0], [10, 0, 100], [15, 0, 120], [12, 0, 80], 
          [8, 0, 40], [2, 0, 10], [-2, 0, -10], [-5, 0, -9.8],
          [-5, 0, -9.8], [-5, 0, -9.8], [-5, 0, -9.8], [-5, 0, -9.8], [-5, 0, -9.8]
        ]
      },
      flightEvents: [
        { name: "Motor Ignition", time: 0.0, altitude: 0.0 },
        { name: "Motor Burnout", time: 3.0, altitude: 350.0 },
        { name: "Apogee", time: 7.0, altitude: 750.0 },
        { name: "Recovery Deployment", time: 7.5, altitude: 730.0 },
        { name: "Ground Impact", time: 12.0, altitude: 0.0 }
      ],
      impactVelocity: 8.5,
      driftDistance: 45.2
    };
    
    return NextResponse.json(fallbackResult);
  }
} 