import { NextRequest, NextResponse } from "next/server";

// Validation function to clean atmospheric model data
function validateAtmosphericModel(atmosphericModel: any): string {
  if (!atmosphericModel || typeof atmosphericModel !== 'string') {
    return 'standard';
  }
  
  // Clean corrupted values
  const cleaned = atmosphericModel.toLowerCase().trim();
  if (cleaned.includes('standard')) {
    return 'standard';
  }
  if (cleaned.includes('custom')) {
    return 'custom';
  }
  if (cleaned.includes('forecast')) {
    return 'forecast';
  }
  
  // Default fallback
  return 'standard';
}

// Clean environment data function
function cleanEnvironmentData(environment: any): any {
  if (!environment || typeof environment !== 'object') {
    return {
      latitude: 0.0,
      longitude: 0.0,
      elevation: 0.0,
      atmosphericModel: 'standard'
    };
  }

  return {
    ...environment,
    atmosphericModel: validateAtmosphericModel(environment.atmosphericModel),
    // Ensure numeric values are properly typed
    latitude: typeof environment.latitude === 'number' ? environment.latitude : 0.0,
    longitude: typeof environment.longitude === 'number' ? environment.longitude : 0.0,
    elevation: typeof environment.elevation === 'number' ? environment.elevation : 0.0,
    windSpeed: typeof environment.wind_speed_m_s === 'number' ? environment.wind_speed_m_s : 
               typeof environment.windSpeed === 'number' ? environment.windSpeed : 0.0,
    windDirection: typeof environment.wind_direction_deg === 'number' ? environment.wind_direction_deg : 
                   typeof environment.windDirection === 'number' ? environment.windDirection : 0.0
  };
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rocket, environment, analysisType = "comprehensive" } = body;

    // Clean and validate environment data
    const cleanEnvironment = cleanEnvironmentData(environment);

    // Forward request to RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://localhost:8000";
    const response = await fetch(`${rocketpyUrl}/analyze/stability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rocket,
        environment: cleanEnvironment,
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