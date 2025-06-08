import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    // Get atmospheric models from RocketPy service
    const rocketpyUrl = process.env.ROCKETPY_URL || "http://rocketpy:8000";
    
    console.log(`🌍 Fetching atmospheric models from ${rocketpyUrl}/environment/atmospheric-models`);
    
    const response = await fetch(`${rocketpyUrl}/environment/atmospheric-models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Atmospheric models API failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("❌ Atmospheric models API error:", error);
    
    // Return fallback data if service is unavailable
    const fallbackData = {
      available_models: ["standard", "custom", "forecast"],
      default_model: "standard",
      descriptions: {
        standard: "International Standard Atmosphere (ISA) - Reliable baseline model",
        forecast: "Real-time weather data from GFS - Most accurate for actual launches", 
        custom: "User-defined atmospheric conditions - For research and specialized applications"
      },
      requirements: {
        standard: "No additional data required",
        forecast: "Internet connection and valid GPS coordinates required",
        custom: "Custom atmospheric profile data file required"
      }
    };
    
    return NextResponse.json(fallbackData);
  }
} 