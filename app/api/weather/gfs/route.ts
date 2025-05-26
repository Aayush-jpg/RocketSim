import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface GFSRequest {
  latitude: number;
  longitude: number;
  date: string;
  levels: number[]; // Pressure levels in hPa
}

interface GFSLevel {
  pressure: number; // hPa
  temperature: number; // °C
  windU: number; // m/s
  windV: number; // m/s
  humidity?: number; // %
  geopotentialHeight?: number; // m
}

interface GFSResponse {
  surface: {
    temperature: number;
    pressure: number;
    humidity: number;
    windU: number;
    windV: number;
    visibility?: number;
    cloudCover?: number;
    dewPoint?: number;
  };
  levels: GFSLevel[];
  hourly?: any[];
  metadata: {
    model: string;
    forecastTime: string;
    validTime: string;
    resolution: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: GFSRequest = await req.json();
    const { latitude, longitude, date, levels } = body;

    // Validate input
    if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    console.log(`🌍 Fetching GFS data for ${latitude}, ${longitude} at ${date}`);

    // Try multiple GFS data sources
    let gfsData: GFSResponse | null = null;

    // 1. Try NOAA NOMADS GFS data
    try {
      gfsData = await fetchNOAAGFS(latitude, longitude, date, levels);
      if (gfsData) {
        console.log('✅ Successfully fetched NOAA GFS data');
        return NextResponse.json(gfsData);
      }
    } catch (error) {
      console.warn('NOAA GFS failed:', error);
    }

    // 2. Try Open-Meteo (free alternative with GFS data)
    try {
      gfsData = await fetchOpenMeteoGFS(latitude, longitude, date, levels);
      if (gfsData) {
        console.log('✅ Successfully fetched Open-Meteo GFS data');
        return NextResponse.json(gfsData);
      }
    } catch (error) {
      console.warn('Open-Meteo failed:', error);
    }

    // 3. Try WeatherAPI (commercial backup)
    try {
      gfsData = await fetchWeatherAPIData(latitude, longitude, date, levels);
      if (gfsData) {
        console.log('✅ Successfully fetched WeatherAPI data');
        return NextResponse.json(gfsData);
      }
    } catch (error) {
      console.warn('WeatherAPI failed:', error);
    }

    // 4. Final fallback: generate estimated atmospheric profile
    console.log('⚠️ All weather APIs failed, generating estimated profile');
    gfsData = generateEstimatedProfile(latitude, longitude, levels);
    
    return NextResponse.json(gfsData);

  } catch (error) {
    console.error('GFS API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Weather data fetch failed' },
      { status: 500 }
    );
  }
}

/**
 * Fetch GFS data from NOAA NOMADS
 */
async function fetchNOAAGFS(
  latitude: number, 
  longitude: number, 
  date: string, 
  levels: number[]
): Promise<GFSResponse | null> {
  try {
    // NOAA NOMADS GFS data access
    const baseUrl = 'https://nomads.ncep.noaa.gov/dods';
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');
    const hour = Math.floor(targetDate.getUTCHours() / 6) * 6; // GFS runs every 6 hours
    
    // Construct NOMADS URL for GFS 0.25 degree data
    const gfsUrl = `${baseUrl}/gfs_0p25/gfs${dateStr}/gfs_0p25_${hour.toString().padStart(2, '0')}z`;
    
    // For now, we'll use a simplified approach since direct NOMADS access requires complex parsing
    // In production, you'd use libraries like netCDF4 or xarray equivalent
    
    console.log(`Attempting NOAA GFS from: ${gfsUrl}`);
    
    // This would require a more sophisticated implementation with proper GRIB/netCDF parsing
    // For now, return null to fall back to other sources
    return null;
    
  } catch (error) {
    console.error('NOAA GFS fetch failed:', error);
    return null;
  }
}

/**
 * Fetch GFS data from Open-Meteo (free, reliable alternative)
 */
async function fetchOpenMeteoGFS(
  latitude: number, 
  longitude: number, 
  date: string, 
  levels: number[]
): Promise<GFSResponse | null> {
  try {
    const targetDate = new Date(date);
    const dateStr = targetDate.toISOString().slice(0, 10);
    
    // Open-Meteo API for atmospheric data
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: dateStr,
      end_date: dateStr,
      hourly: [
        'temperature_2m',
        'pressure_msl',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'visibility',
        'cloud_cover'
      ].join(','),
      // Pressure level data
      pressure_level: levels.join(','),
      pressure_level_variables: [
        'temperature',
        'wind_speed',
        'wind_direction',
        'relative_humidity',
        'geopotential_height'
      ].join(','),
      timezone: 'UTC',
      models: 'gfs_global'
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      {
        headers: {
          'User-Agent': 'ROCKETv1-Simulation/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Process Open-Meteo data into our format
    return processOpenMeteoData(data, levels);
    
  } catch (error) {
    console.error('Open-Meteo fetch failed:', error);
    return null;
  }
}

/**
 * Fetch data from WeatherAPI (commercial backup)
 */
async function fetchWeatherAPIData(
  latitude: number, 
  longitude: number, 
  date: string, 
  levels: number[]
): Promise<GFSResponse | null> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    console.warn('WeatherAPI key not configured');
    return null;
  }

  try {
    const targetDate = new Date(date);
    const isHistorical = targetDate < new Date();
    
    const endpoint = isHistorical ? 'history.json' : 'forecast.json';
    const dateParam = isHistorical ? 'dt' : 'dt';
    
    const response = await fetch(
      `https://api.weatherapi.com/v1/${endpoint}?key=${apiKey}&q=${latitude},${longitude}&${dateParam}=${targetDate.toISOString().slice(0, 10)}&aqi=yes&alerts=no`
    );

    if (!response.ok) {
      throw new Error(`WeatherAPI error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Process WeatherAPI data and estimate atmospheric profile
    return processWeatherAPIData(data, levels);
    
  } catch (error) {
    console.error('WeatherAPI fetch failed:', error);
    return null;
  }
}

/**
 * Process Open-Meteo data into our GFS format
 */
function processOpenMeteoData(data: any, requestedLevels: number[]): GFSResponse {
  const hourly = data.hourly;
  const currentIndex = 0; // Use first hour as current
  
  // Surface data
  const surface = {
    temperature: hourly.temperature_2m[currentIndex] || 15,
    pressure: hourly.pressure_msl[currentIndex] || 1013.25,
    humidity: hourly.relative_humidity_2m[currentIndex] || 50,
    windU: calculateWindComponent(
      hourly.wind_speed_10m[currentIndex] || 0,
      hourly.wind_direction_10m[currentIndex] || 0,
      'u'
    ),
    windV: calculateWindComponent(
      hourly.wind_speed_10m[currentIndex] || 0,
      hourly.wind_direction_10m[currentIndex] || 0,
      'v'
    ),
    visibility: hourly.visibility[currentIndex] || 10,
    cloudCover: hourly.cloud_cover[currentIndex] || 0
  };

  // Process pressure level data if available
  const levels: GFSLevel[] = [];
  
  if (data.pressure_level) {
    requestedLevels.forEach(pressureLevel => {
      const levelData = data.pressure_level[pressureLevel];
      if (levelData) {
        levels.push({
          pressure: pressureLevel,
          temperature: levelData.temperature[currentIndex] || surface.temperature,
          windU: calculateWindComponent(
            levelData.wind_speed[currentIndex] || 0,
            levelData.wind_direction[currentIndex] || 0,
            'u'
          ),
          windV: calculateWindComponent(
            levelData.wind_speed[currentIndex] || 0,
            levelData.wind_direction[currentIndex] || 0,
            'v'
          ),
          humidity: levelData.relative_humidity[currentIndex] || surface.humidity,
          geopotentialHeight: levelData.geopotential_height[currentIndex]
        });
      }
    });
  }

  // If no pressure level data, estimate from surface
  if (levels.length === 0) {
    levels.push(...estimatePressureLevels(surface, requestedLevels));
  }

  return {
    surface,
    levels,
    metadata: {
      model: 'GFS (Open-Meteo)',
      forecastTime: new Date().toISOString(),
      validTime: data.hourly.time[currentIndex] || new Date().toISOString(),
      resolution: '0.25°'
    }
  };
}

/**
 * Process WeatherAPI data into our GFS format
 */
function processWeatherAPIData(data: any, requestedLevels: number[]): GFSResponse {
  const current = data.current;
  
  const surface = {
    temperature: current.temp_c,
    pressure: current.pressure_mb,
    humidity: current.humidity,
    windU: calculateWindComponent(current.wind_kph / 3.6, current.wind_degree, 'u'), // Convert kph to m/s
    windV: calculateWindComponent(current.wind_kph / 3.6, current.wind_degree, 'v'),
    visibility: current.vis_km,
    cloudCover: current.cloud
  };

  // Estimate pressure levels from surface data
  const levels = estimatePressureLevels(surface, requestedLevels);

  return {
    surface,
    levels,
    metadata: {
      model: 'WeatherAPI',
      forecastTime: new Date().toISOString(),
      validTime: current.last_updated,
      resolution: 'Point forecast'
    }
  };
}

/**
 * Generate estimated atmospheric profile when all APIs fail
 */
function generateEstimatedProfile(
  latitude: number, 
  longitude: number, 
  requestedLevels: number[]
): GFSResponse {
  // Use International Standard Atmosphere with seasonal/latitudinal adjustments
  const seasonalTemp = getSeasonalTemperature(latitude);
  const elevationEstimate = getElevationEstimate(latitude, longitude);
  
  const surface = {
    temperature: seasonalTemp,
    pressure: 1013.25 * Math.exp(-elevationEstimate / 8400), // Barometric formula
    humidity: 50 + 30 * Math.sin(latitude * Math.PI / 180), // Higher humidity near equator
    windU: 0,
    windV: 0,
    visibility: 10,
    cloudCover: 25
  };

  const levels = estimatePressureLevels(surface, requestedLevels);

  return {
    surface,
    levels,
    metadata: {
      model: 'Standard Atmosphere (Estimated)',
      forecastTime: new Date().toISOString(),
      validTime: new Date().toISOString(),
      resolution: 'Estimated'
    }
  };
}

/**
 * Utility functions
 */
function calculateWindComponent(speed: number, direction: number, component: 'u' | 'v'): number {
  const radians = direction * Math.PI / 180;
  return component === 'u' ? speed * Math.sin(radians) : speed * Math.cos(radians);
}

function estimatePressureLevels(surface: any, levels: number[]): GFSLevel[] {
  return levels.map(pressure => {
    // Standard atmosphere calculations
    const altitude = 44330 * (1 - Math.pow(pressure / surface.pressure, 0.1903));
    
    let temperature;
    if (altitude <= 11000) {
      temperature = surface.temperature - 0.0065 * altitude; // Troposphere lapse rate
    } else {
      temperature = -56.5; // Stratosphere
    }
    
    // Wind typically increases with altitude
    const windFactor = 1 + altitude / 10000;
    
    return {
      pressure,
      temperature,
      windU: surface.windU * windFactor,
      windV: surface.windV * windFactor,
      humidity: Math.max(5, surface.humidity * Math.exp(-altitude / 8000)), // Humidity decreases with altitude
      geopotentialHeight: altitude
    };
  });
}

function getSeasonalTemperature(latitude: number): number {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const seasonalVariation = 10 * Math.cos((dayOfYear - 172) * 2 * Math.PI / 365); // Peak summer around day 172
  const latitudinalEffect = 15 * Math.cos(latitude * Math.PI / 180); // Warmer near equator
  
  return 15 + seasonalVariation + latitudinalEffect;
}

function getElevationEstimate(latitude: number, longitude: number): number {
  // Very rough elevation estimates based on known geographic features
  // In production, you'd use a proper elevation API
  
  // Mountain ranges
  if ((latitude > 25 && latitude < 50 && longitude > -125 && longitude < -100) || // Rocky Mountains
      (latitude > 35 && latitude < 50 && longitude > -10 && longitude < 20) ||   // Alps
      (latitude > -40 && latitude < -20 && longitude > -80 && longitude < -60)) { // Andes
    return 1500; // Mountainous regions
  }
  
  // High plateaus
  if ((latitude > 25 && latitude < 40 && longitude > 75 && longitude < 105) ||   // Tibet
      (latitude > -20 && latitude < 0 && longitude > -80 && longitude < -40)) {  // Altiplano
    return 3000;
  }
  
  return 100; // Default low elevation
} 