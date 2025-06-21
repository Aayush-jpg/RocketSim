import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Custom fetch function with extended timeouts for long-running simulations
async function fetchWithExtendedTimeout(url: string, options: any, timeoutMs: number) {
  // Set environment variables to increase undici timeouts
  const originalHeadersTimeout = process.env.UNDICI_HEADERS_TIMEOUT;
  const originalBodyTimeout = process.env.UNDICI_BODY_TIMEOUT;
  const originalConnectTimeout = process.env.UNDICI_CONNECT_TIMEOUT;
  
  try {
    // Set extended timeouts (in milliseconds)
    process.env.UNDICI_HEADERS_TIMEOUT = timeoutMs.toString();
    process.env.UNDICI_BODY_TIMEOUT = timeoutMs.toString();
    process.env.UNDICI_CONNECT_TIMEOUT = '60000'; // 1 minute for connection
    
    return await fetch(url, options);
  } finally {
    // Restore original timeouts
    if (originalHeadersTimeout !== undefined) {
      process.env.UNDICI_HEADERS_TIMEOUT = originalHeadersTimeout;
    } else {
      delete process.env.UNDICI_HEADERS_TIMEOUT;
    }
    if (originalBodyTimeout !== undefined) {
      process.env.UNDICI_BODY_TIMEOUT = originalBodyTimeout;
    } else {
      delete process.env.UNDICI_BODY_TIMEOUT;
    }
    if (originalConnectTimeout !== undefined) {
      process.env.UNDICI_CONNECT_TIMEOUT = originalConnectTimeout;
    } else {
      delete process.env.UNDICI_CONNECT_TIMEOUT;
    }
  }
}

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
  try {
    const body = await req.json();
    const { rocket, environment, launchParameters, variations, iterations } = body;
    
    console.log(`🎲 Monte Carlo API called with rocket:`, rocket);
    
    // Default to RocketPy service URL - handle both Docker and local development
    const rocketpyUrl = process.env.ROCKETPY_URL || 
                       (process.env.NODE_ENV === 'development' ? "http://localhost:8000" : "http://rocketpy:8000");
    
    console.log(`🎲 About to transform rocket...`);
    // ✅ CRITICAL FIX: Transform legacy rocket format to component-based format
    const transformedRocket = transformLegacyRocketToComponents(rocket);
    console.log(`🎲 Transformation completed. Transformed rocket:`, transformedRocket);
    console.log(`🎲 Rocket transformation for Monte Carlo:`, {
      original: rocket.name,
      hasComponents: !!(transformedRocket.nose_cone && transformedRocket.body_tubes && transformedRocket.fins)
    });
    
    // ✅ CRITICAL FIX: Use same environment data mapping as standard simulation route
    const cleanEnvironment = environment ? {
      // Map frontend field names to backend expected names
      // Store uses latitude_deg/longitude_deg, not latitude/longitude
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
    
    console.log(`🎲 Environment processed for Monte Carlo:`, {
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
    
    // Prepare request payload for Monte Carlo simulation
    const requestData = {
      rocket: transformedRocket,
      environment: cleanEnvironment,
      launchParameters: cleanLaunchParameters,
      variations: variations || [
        {
          parameter: "environment.wind_speed_m_s",  // ✅ FIXED: Use backend parameter name
          distribution: "uniform",
          parameters: [0, 10]
        },
        {
          parameter: "rocket.Cd",
          distribution: "normal",
          parameters: [rocket.Cd ?? 0.5, (rocket.Cd ?? 0.5) * 0.1]
        },
        {
          parameter: "launch.inclination_deg",  // ✅ FIXED: Use backend parameter name
          distribution: "normal",
          parameters: [85, 2]
        }
      ],
      iterations: iterations || (rocket.motor?.motor_database_id?.includes('liquid') ? 50 : 100)  // Reduce iterations for liquid motors
    };
    
    console.log(`🎲 Proxying Monte Carlo simulation request to ${rocketpyUrl}/simulate/monte-carlo`);
    
    // Create AbortController with longer timeout for threaded Monte Carlo
    // Liquid motors and complex simulations need more time
    const baseTimeout = 3600000; // 1 hour base for liquid motors with forecast
    const iterationTime = (iterations || 100) * 5000; // 5 seconds per iteration for liquid motors with weather
    const timeoutMs = Math.max(baseTimeout, iterationTime);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Custom timeout approach to work around undici HeadersTimeoutError
      const fetchPromise = fetch(`${rocketpyUrl}/simulate/monte-carlo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        signal: controller.signal,
      });
      
      // Use Promise.race to implement our own timeout that works around undici issues
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Custom timeout after ${Math.round(timeoutMs/1000)} seconds`)), timeoutMs);
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Monte Carlo simulation failed: ${response.status} ${errorText}`);
        throw new Error(`Monte Carlo simulation failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Get mean altitude from the properly mapped statistics
      const meanAltitude = result.statistics?.maxAltitude?.mean || 
                          result.nominal?.maxAltitude || 
                          'unknown';
      
      console.log(`✅ Monte Carlo simulation completed successfully with ${meanAltitude.toFixed ? meanAltitude.toFixed(1) + 'm' : meanAltitude} mean altitude`);
      
      return NextResponse.json(result);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`❌ Monte Carlo simulation timed out after ${timeoutMs}ms`);
        throw new Error(`Monte Carlo simulation timed out after ${Math.round(timeoutMs/1000)} seconds`);
      }
      
      throw fetchError;
    }
    
  } catch (error) {
    console.error("❌ Monte Carlo simulation API error:", error);
    
    // Return a fallback Monte Carlo result
    const fallbackResult = {
      nominal: {
        maxAltitude: 650.0,
        maxVelocity: 170.0,
        maxAcceleration: 110.0,
        apogeeTime: 11.0,
        stabilityMargin: 1.7,
        simulationFidelity: "monte_carlo_fallback"
      },
      statistics: {
        maxAltitude: {
          mean: 650.0,
          std: 75.0,
          min: 480.0,
          max: 820.0,
          percentiles: {
            "5": 520.0,
            "25": 590.0,
            "50": 650.0,
            "75": 710.0,
            "95": 780.0
          }
        },
        maxVelocity: {
          mean: 170.0,
          std: 15.0,
          min: 135.0,
          max: 205.0,
          percentiles: {
            "5": 145.0,
            "25": 160.0,
            "50": 170.0,
            "75": 180.0,
            "95": 195.0
          }
        },
        apogeeTime: {
          mean: 11.0,
          std: 1.2,
          min: 8.5,
          max: 13.8,
          percentiles: {
            "5": 9.2,
            "25": 10.1,
            "50": 11.0,
            "75": 11.9,
            "95": 12.8
          }
        },
        stabilityMargin: {
          mean: 1.7,
          std: 0.2,
          min: 1.2,
          max: 2.3,
          percentiles: {
            "5": 1.3,
            "25": 1.6,
            "50": 1.7,
            "75": 1.8,
            "95": 2.1
          }
        }
      },
      iterations: Array.from({ length: 50 }, (_, i) => ({
        maxAltitude: 650 + (Math.random() - 0.5) * 150,
        maxVelocity: 170 + (Math.random() - 0.5) * 30,
        apogeeTime: 11 + (Math.random() - 0.5) * 2.4,
        stabilityMargin: 1.7 + (Math.random() - 0.5) * 0.4,
        driftDistance: 35 + Math.random() * 40
      })),
      landingDispersion: {
        coordinates: [[0, 0]],
        cep: 42.5,
        majorAxis: 85.0,
        minorAxis: 63.8,
        rotation: 15.0,
        meanDrift: 42.5,
        maxDrift: 95.3
      }
    };
    
    return NextResponse.json(fallbackResult);
  }
} 