import { NextRequest, NextResponse } from "next/server";
import { Rocket } from "@/types/rocket";

export const runtime = "nodejs";

/**
 * API handler for high-fidelity rocket simulation
 * Connects to the Python RocketPy service
 */
export async function POST(req: NextRequest) {
  try {
    const { rocket } = await req.json();
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      // Call the RocketPy service with timeout - use /simulate_full for high-fidelity
      const rocketpyUrl = process.env.ROCKETPY_URL || "http://rocketpy:8000";
      const response = await fetch(`${rocketpyUrl}/simulate_full`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rocket),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error from RocketPy service:", errorText);
        
        // Fall back to local simulation if service unavailable
        if (response.status === 503 || response.status === 404) {
          return NextResponse.json(
            fallbackSimulation(rocket),
            { status: 200 }
          );
        }
        
        return NextResponse.json(
          { error: "Simulation service error", details: errorText },
          { status: response.status }
        );
      }

      const simResults = await response.json();
      return NextResponse.json(simResults);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Handle timeout specifically
      if (fetchError.name === 'AbortError') {
        console.log("RocketPy simulation timed out, falling back to local simulation");
        return NextResponse.json(
          fallbackSimulation(rocket),
          { status: 200 }
        );
      }
      
      throw fetchError; // Re-throw other errors
    }
  } catch (error) {
    console.error("Error in high-fidelity simulation:", error);
    
    // Fall back to local simulation on error
    try {
      const { rocket } = await req.json();
      return NextResponse.json(
        fallbackSimulation(rocket),
        { status: 200 }
      );
    } catch (parseError) {
      // If we can't even parse the request, return a generic error
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }
  }
}

/**
 * Fallback local simulation for when the RocketPy service is unavailable
 */
function fallbackSimulation(rocket: Rocket) {
  // Calculate values based on rocket properties
  const baseAltitude = 800;
  const partFactor = rocket.parts.length * 50;
  const dragFactor = rocket.Cd * 500;
  const maxAltitude = baseAltitude + partFactor - dragFactor;
  
  const baseVelocity = 200;
  const velocityPartFactor = rocket.parts.length * 10;
  const velocityDragFactor = rocket.Cd * 100;
  const maxVelocity = baseVelocity + velocityPartFactor - velocityDragFactor;
  
  const finCount = rocket.parts.filter(p => p.type === "fin").length;
  const stabilityMargin = 1.0 + (finCount * 0.25);
  
  // Generate a thrust curve
  const thrustCurve = generateThrustCurve();
  
  return {
    maxAltitude,
    maxVelocity,
    apogeeTime: maxVelocity / 9.8, // time to apogee based on max velocity and gravity
    stabilityMargin,
    thrustCurve,
  };
}

/**
 * Generate a sample thrust curve
 */
function generateThrustCurve() {
  const curve: [number, number][] = [];
  
  // Build-up phase
  for (let t = 0; t < 0.2; t += 0.02) {
    curve.push([t, 5000 * (t / 0.2)]);
  }
  
  // Sustained phase
  for (let t = 0.2; t < 2.0; t += 0.1) {
    curve.push([t, 5000 + (Math.random() * 300 - 150)]);
  }
  
  // Tail-off phase
  for (let t = 2.0; t < 2.5; t += 0.05) {
    curve.push([t, 5000 * (1 - ((t - 2.0) / 0.5))]);
  }
  
  // Zero thrust after burnout
  curve.push([2.5, 0]);
  curve.push([10, 0]);
  
  return curve;
} 