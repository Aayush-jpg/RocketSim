import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 1800; // 30 minutes maximum duration for simulations

// ✅ CRITICAL: Transform legacy rocket format to component-based format
function transformLegacyRocketToComponents(legacyRocket: any): any {
  // If already in component format, return as-is
  if (legacyRocket.nose_cone && legacyRocket.body_tubes && legacyRocket.fins) {
    return legacyRocket;
  }
  
  // Transform legacy format to component-based format
  const rocketId = legacyRocket.id || randomUUID();
  const rocketName = legacyRocket.name || "Default Rocket";
  
  // Use legacy Cd or default
  const dragCoefficient = legacyRocket.Cd || 0.5;
  
  return {
    id: rocketId,
    name: rocketName,
    nose_cone: {
      id: "nose-1",
      shape: "ogive",
      length_m: 0.325,
      wall_thickness_m: 0.002,
      material_density_kg_m3: 1600.0,
      surface_roughness_m: 0.00001
    },
    body_tubes: [{
      id: "body-1", 
      outer_radius_m: 0.0508, // 4 inch diameter
      length_m: 1.3,
      wall_thickness_m: 0.003,
      material_density_kg_m3: 1600.0,
      surface_roughness_m: 0.00001
    }],
    fins: [{
      id: "fins-1",
      fin_count: 3,
      root_chord_m: 0.17,
      tip_chord_m: 0.08,
      span_m: 0.133,
      sweep_length_m: 0.05,
      thickness_m: 0.006,
      material_density_kg_m3: 650.0,
      cant_angle_deg: 0.0
    }],
    motor: {
      id: "motor-1",
      motor_database_id: "I284-6-M",
      position_from_tail_m: 0.0
    },
    parachutes: [{
      id: "parachute-1",
      name: "Recovery Parachute",
      cd_s_m2: 1.8,
      trigger: "apogee",
      position_from_tail_m: 1.4,
      lag_s: 1.5,
      sampling_rate_hz: 105.0,
      noise_bias: 0.0,
      noise_deviation: 8.3,
      noise_correlation: 0.5
    }],
    coordinate_system: "tail_to_nose"
  };
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
      latitude_deg: environment.latitude || 0,
      longitude_deg: environment.longitude || 0,
      elevation_m: environment.elevation || 0,
      wind_speed_m_s: environment.wind_speed_m_s || environment.windSpeed || 0,
      wind_direction_deg: environment.wind_direction_deg || environment.windDirection || 0,
      atmospheric_model: validateAtmosphericModel(environment.atmosphericModel),
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
    
    // ✅ CRITICAL FIX: Transform legacy rocket format to component-based format
    const transformedRocket = transformLegacyRocketToComponents(rocket);
    console.log(`🔵 [${requestId}] Rocket transformation:`, {
      original: rocket.name,
      hasComponents: !!(transformedRocket.nose_cone && transformedRocket.body_tubes && transformedRocket.fins),
      componentCount: {
        body_tubes: transformedRocket.body_tubes?.length || 0,
        fins: transformedRocket.fins?.length || 0,
        parachutes: transformedRocket.parachutes?.length || 0
      }
    });
    
    const payload = {
      rocket: transformedRocket,
      environment: cleanEnvironment,
      launchParameters: cleanLaunchParameters
    };
    console.log(`🔵 [${requestId}] Payload size: ${JSON.stringify(payload).length} bytes`);
      console.log(`🔵 [${requestId}] Making fetch request to ${rocketpyUrl}${rocketpyEndpoint}...`);
      
      const response = await fetch(`${rocketpyUrl}${rocketpyEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connection": "keep-alive",
        },
        body: JSON.stringify(payload),
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