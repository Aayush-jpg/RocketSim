import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 1800; // 30 minutes maximum duration for simulations

// ✅ Validate component-based rocket data and fix any invalid fin parameters
function validateRocketComponents(rocket: any): any {
  const validatedRocket = { ...rocket };
  
  // ✅ FIX: Validate and correct fin parameters to prevent RocketPy validation errors
  if (validatedRocket.fins && Array.isArray(validatedRocket.fins)) {
    validatedRocket.fins = validatedRocket.fins.map((fin: any) => {
      const correctedFin = { ...fin };
      
      // Remove wall_thickness_m property for backend (backend treats all fins as solid)
      if ('wall_thickness_m' in correctedFin) {
        delete correctedFin.wall_thickness_m;
      }
  
      // Ensure sweep_length_m <= span_m (RocketPy requirement)
      if (correctedFin.sweep_length_m > correctedFin.span_m) {
        console.warn(`⚠️ Fixing invalid fin: sweep_length_m (${correctedFin.sweep_length_m}) > span_m (${correctedFin.span_m})`);
        correctedFin.sweep_length_m = Math.min(correctedFin.sweep_length_m, correctedFin.span_m * 0.8); // 80% of span max
      }
      
      // Ensure span_m is reasonable (at least 0.05m for small rockets)
      if (correctedFin.span_m < 0.05) {
        console.warn(`⚠️ Fixing invalid fin: span_m too small (${correctedFin.span_m}), setting to 0.133m`);
        correctedFin.span_m = 0.133;
        correctedFin.sweep_length_m = Math.min(correctedFin.sweep_length_m, 0.05);
      }
      
      // Ensure tip_chord_m <= root_chord_m
      if (correctedFin.tip_chord_m > correctedFin.root_chord_m) {
        console.warn(`⚠️ Fixing invalid fin: tip_chord_m (${correctedFin.tip_chord_m}) > root_chord_m (${correctedFin.root_chord_m})`);
        correctedFin.tip_chord_m = correctedFin.root_chord_m * 0.8;
      }
      
      return correctedFin;
    });
  }
  
  return validatedRocket;
}

// Helper function to validate and fix atmospheric model values
function validateAtmosphericModel(atmosphericModel: any): string {
  // Ensure atmospheric model is one of the valid values
  const validModels = ["standard", "custom", "forecast", "nrlmsise"];
  
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
    if (cleanModel.includes("nrlmsise")) {
      return "nrlmsise";
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
  const requestId = Math.random().toString(36).substr(2, 9);
  console.log(`🔵 [${requestId}] API request started`);
  
  try {
    console.log(`🔵 [${requestId}] Parsing request body...`);
    body = await req.json();
    const { rocket, environment, launchParameters, fidelity = "standard" } = body;

    console.log(`🔵 [${requestId}] Request parsed:`, {
      rocketName: rocket?.name || 'Unnamed',
      fidelity,
      hasEnvironment: !!environment,
      hasLaunchParams: !!launchParameters,
      environmentModel: environment?.atmosphericModel
    });

    console.log(`🚀 [${requestId}] Starting ${fidelity} simulation for rocket: ${rocket.name || 'Unnamed'}`);

    // Determine the appropriate RocketPy endpoint based on fidelity
    let rocketpyEndpoint = "/simulate";
    if (fidelity === "enhanced" || fidelity === "hifi") { 
      rocketpyEndpoint = "/simulate/enhanced";
    } else if (fidelity === "professional") {
      rocketpyEndpoint = "/simulate/professional";
    }
    
    console.log(`🔵 [${requestId}] Selected endpoint: ${rocketpyEndpoint}`);
    console.log(`🔵 [${requestId}] Processing environment data...`);
    // Clean and validate environment data - Map frontend field names to backend format
    const cleanEnvironment = environment ? {
      // Map frontend field names to backend expected names
      latitude_deg: environment.latitude_deg || environment.latitude || 0,
      longitude_deg: environment.longitude_deg || environment.longitude || 0,
      elevation_m: environment.elevation_m || environment.elevation || 0,
      wind_speed_m_s: environment.wind_speed_m_s || environment.windSpeed || 0,
      wind_direction_deg: environment.wind_direction_deg || environment.windDirection || 0,
      atmospheric_model: validateAtmosphericModel(environment.atmospheric_model || environment.atmosphericModel),
      date: environment.date || new Date().toISOString(),
      timezone: environment.timezone || "UTC",
      temperature_offset_k: environment.temperature_offset_k || 0.0,
      pressure_offset_pa: environment.pressure_offset_pa || 0.0,
      // CRITICAL: Include atmospheric profile data for high-fidelity simulations
      atmospheric_profile: environment.atmospheric_profile ? {
        altitude: environment.atmospheric_profile.altitude,
        temperature: environment.atmospheric_profile.temperature,
        pressure: environment.atmospheric_profile.pressure,
        density: environment.atmospheric_profile.density,
        windU: environment.atmospheric_profile.windU,
        windV: environment.atmospheric_profile.windV
      } : null
    } : {
      latitude_deg: 0,
      longitude_deg: 0,
      elevation_m: 0,
      wind_speed_m_s: 0,
      wind_direction_deg: 0,
      atmospheric_model: "standard"
    };

    // Normalize wind direction to 0-360 degrees for Python backend
    if (cleanEnvironment.wind_direction_deg && typeof cleanEnvironment.wind_direction_deg === 'number') {
      cleanEnvironment.wind_direction_deg = ((cleanEnvironment.wind_direction_deg % 360) + 360) % 360;
    }
    
    console.log(`🔵 [${requestId}] Environment processed:`, {
      model: cleanEnvironment.atmospheric_model,
      location: `${cleanEnvironment.latitude_deg}, ${cleanEnvironment.longitude_deg}`,
      wind: `${cleanEnvironment.wind_speed_m_s} m/s @ ${cleanEnvironment.wind_direction_deg}°`,
      hasProfile: !!cleanEnvironment.atmospheric_profile,
      profilePoints: cleanEnvironment.atmospheric_profile?.altitude?.length || 0
    });

    // Map launch parameters to backend format
    const cleanLaunchParameters = launchParameters ? {
      rail_length_m: launchParameters.railLength || 5.0,
      inclination_deg: launchParameters.inclination || 85.0,
      heading_deg: launchParameters.heading || 0.0
    } : {
      rail_length_m: 5.0,
      inclination_deg: 85.0,
      heading_deg: 0.0
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
          console.log(`🔵 [${requestId}] Preparing request payload...`);
    
    // ✅ Validate rocket components and fix any invalid parameters
    const validatedRocket = validateRocketComponents(rocket);
    console.log(`🔵 [${requestId}] Rocket validation:`, {
      original: rocket.name,
      hasComponents: !!(validatedRocket.nose_cone && validatedRocket.body_tubes && validatedRocket.fins),
      componentCount: {
        body_tubes: validatedRocket.body_tubes?.length || 0,
        fins: validatedRocket.fins?.length || 0,
        parachutes: validatedRocket.parachutes?.length || 0
      }
    });
    
    // Prepare the request data for RocketPy service
    const requestData = {
      rocket: validatedRocket,
      environment: cleanEnvironment,
      launchParameters: cleanLaunchParameters
    };
    console.log(`🔵 [${requestId}] Payload size: ${JSON.stringify(requestData).length} bytes`);
      console.log(`🔵 [${requestId}] Making fetch request to ${rocketpyUrl}${rocketpyEndpoint}...`);
      
      const response = await fetch(`${rocketpyUrl}${rocketpyEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connection": "keep-alive",
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
        // Add keepalive and disable default timeouts
        keepalive: true,
      });
      
      console.log(`🔵 [${requestId}] Response received:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
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