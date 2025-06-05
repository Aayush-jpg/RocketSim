import { NextRequest, NextResponse } from "next/server";
import type { Rocket } from "@/types/rocket";

export const runtime = "nodejs";

/**
 * API handler for high-fidelity rocket simulation
 * Connects to the Python RocketPy service
 */
export async function POST(req: NextRequest) {
  try {
    const { rocket, environment, launchParameters } = await req.json();
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      // Call the RocketPy service with timeout - use /simulate/hifi for high-fidelity
      const rocketpyUrl = process.env.ROCKETPY_URL || "http://rocketpy:8000";
      
      // Format request according to SimulationRequestModel
      const requestPayload = {
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
      
      const response = await fetch(`${rocketpyUrl}/simulate/hifi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
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
      const body = await req.json();
      const { rocket } = body;
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
  // Calculate values based on rocket component properties
  const baseAltitude = 800;
  
  // Count components instead of parts
  let componentCount = 0;
  if (rocket.nose_cone) componentCount += 1;
  componentCount += rocket.body_tubes.length;
  componentCount += rocket.fins.length;
  componentCount += rocket.parachutes.length;
  if (rocket.motor) componentCount += 1;
  
  const partFactor = componentCount * 50;
  
  // Calculate drag coefficient from components
  let dragCoefficient = 0.4; // Base drag coefficient
  
  // Add nose cone drag contribution
  if (rocket.nose_cone) {
    const noseShapes: Record<string, number> = {
      'ogive': 0.15,
      'conical': 0.18,
      'elliptical': 0.12,
      'parabolic': 0.14
    };
    dragCoefficient += noseShapes[rocket.nose_cone.shape] || 0.15;
  }
  
  // Add fin drag contribution
  const totalFinArea = rocket.fins.reduce((sum, fin) => {
    const rootChord = fin.root_chord_m || 0.08;
    const tipChord = fin.tip_chord_m || rootChord;
    const span = fin.span_m || 0.05;
    const finCount = fin.fin_count || 3;
    const finArea = 0.5 * (rootChord + tipChord) * span;
    return sum + finArea * finCount;
  }, 0);
  
  dragCoefficient += totalFinArea * 2;
  dragCoefficient = Math.min(Math.max(dragCoefficient, 0.3), 1.0);
  
  const dragFactor = dragCoefficient * 500;
  const maxAltitude = baseAltitude + partFactor - dragFactor;
  
  const baseVelocity = 200;
  const velocityPartFactor = componentCount * 10;
  const velocityDragFactor = dragCoefficient * 100;
  const maxVelocity = baseVelocity + velocityPartFactor - velocityDragFactor;
  
  // Count total fins instead of filtering parts
  const finCount = rocket.fins.reduce((sum, fin) => sum + (fin.fin_count || 3), 0);
  const stabilityMargin = 1.0 + (finCount * 0.05); // More realistic stability calculation
  
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