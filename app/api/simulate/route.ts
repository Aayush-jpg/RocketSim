import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 1800; // 30 minutes maximum duration for simulations

// Helper function to validate and fix atmospheric model values
function validateAtmosphericModel(atmosphericModel: any): string {
  // Ensure atmospheric model is one of the valid values
  const validModels = ["standard", "custom", "forecast"];
  
  if (typeof atmosphericModel === "string") {
    const cleanModel = atmosphericModel.toLowerCase().trim();
    
    // Fix common corruptions
    if (cleanModel.includes("standard")) {
      return "standard";
    }
    if (cleanModel.includes("forecast")) {
      return "forecast";
    }
    if (cleanModel.includes("custom")) {
      return "custom";
    }
    
    // Check if it's a valid model
    if (validModels.includes(cleanModel)) {
      return cleanModel;
    }
  }
  
  // Default fallback
  return "standard";
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
    const { rocket, environment, launchParameters, fidelity = "standard" } = body;

    console.log(`🚀 Starting ${fidelity} simulation for rocket: ${rocket.name || 'Unnamed'}`);

    // Determine the appropriate RocketPy endpoint based on fidelity
    let rocketpyEndpoint = "/simulate";
    if (fidelity === "enhanced" || fidelity === "hifi") {
      rocketpyEndpoint = "/simulate/enhanced";
    } else if (fidelity === "professional") {
      rocketpyEndpoint = "/simulate/professional";
    }

    // Clean and validate environment data
    const cleanEnvironment = environment ? {
      ...environment,
      atmosphericModel: validateAtmosphericModel(environment.atmosphericModel)
    } : {
      latitude: 0,
      longitude: 0,
      elevation: 0,
      windSpeed: 0,
      windDirection: 0,
      atmosphericModel: "standard"
    };

    // Forward request to RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://rocketpy:8000";
    
    console.log(`🔗 Connecting to RocketPy service at: ${rocketpyUrl}${rocketpyEndpoint}`);
    
    // Set timeout based on fidelity level
    const timeoutMs = fidelity === "professional" ? 1500000 : // 25 minutes
                     fidelity === "enhanced" || fidelity === "hifi" ? 600000 : // 10 minutes
                     120000; // 2 minutes for standard
    
    console.log(`⏱️ Setting timeout to ${timeoutMs/1000} seconds for ${fidelity} simulation`);
    
    const startTime = Date.now();
    
    // Create custom AbortController to avoid Node.js default timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Simulation timeout reached after ${timeoutMs/1000} seconds`);
      controller.abort();
    }, timeoutMs);
    
    try {
      const response = await fetch(`${rocketpyUrl}${rocketpyEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connection": "keep-alive",
        },
        body: JSON.stringify({
          rocket,
          environment: cleanEnvironment,
          launchParameters: launchParameters || {
            railLength: 5.0,
            inclination: 85.0,
            heading: 0.0
          }
        }),
        signal: controller.signal,
        // Add keepalive and disable default timeouts
        keepalive: true,
      });
      
      // Clear the timeout since we got a response
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Simulation completed in ${duration}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("RocketPy simulation failed:", errorText);
        throw new Error(`Simulation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Add metadata but preserve actual simulation fidelity from RocketPy
      result.requestedFidelity = fidelity; // What the user asked for
      // Keep result.simulationFidelity as returned by RocketPy (what actually happened)
      result.timestamp = new Date().toISOString();
      result.duration = duration;

      return NextResponse.json(result);
      
    } catch (fetchError) {
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Re-throw the error to be handled by the outer catch block
      throw fetchError;
    }
  } catch (error) {
    console.error("Simulation API error:", error);
    
    // Handle specific timeout errors
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        console.error(`❌ Simulation timed out for fidelity: ${body?.fidelity || 'unknown'}`);
        return NextResponse.json(
          { 
            error: `Simulation timed out. ${body?.fidelity === 'professional' ? 'Professional simulations can take up to 25 minutes.' : body?.fidelity === 'enhanced' ? 'Enhanced simulations can take up to 10 minutes.' : 'Try using a lower fidelity setting.'}`,
            errorType: 'timeout',
            fidelity: body?.fidelity || 'unknown'
          },
          { status: 408 } // Request Timeout
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Simulation failed",
        errorType: 'general'
      },
      { status: 500 }
    );
  }
} 