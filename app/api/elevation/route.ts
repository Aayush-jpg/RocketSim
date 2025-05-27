import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = searchParams.get('lat');
  const longitude = searchParams.get('lon');

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: 'Missing latitude or longitude parameters' },
      { status: 400 }
    );
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json(
      { error: 'Invalid latitude or longitude values' },
      { status: 400 }
    );
  }

  try {
    // Try USGS Elevation API first (most accurate for US)
    try {
      const usgsResponse = await fetch(
        `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Meters&wkid=4326&includeDate=false`,
        {
          headers: {
            'User-Agent': 'ROCKETv1/1.0 (Rocket Design Application)',
          },
          // Add timeout
          signal: AbortSignal.timeout(5000)
        }
      );

      if (usgsResponse.ok) {
        const data = await usgsResponse.json();
        if (data.value !== null && data.value !== undefined) {
          return NextResponse.json({
            elevation: parseFloat(data.value),
            source: 'USGS',
            location: { latitude: lat, longitude: lon }
          });
        }
      }
    } catch (error) {
      console.warn('USGS elevation failed:', error);
    }

    // Fallback to Open-Elevation API (global coverage)
    try {
      const openElevResponse = await fetch(
        `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`,
        {
          headers: {
            'User-Agent': 'ROCKETv1/1.0 (Rocket Design Application)',
          },
          signal: AbortSignal.timeout(5000)
        }
      );

      if (openElevResponse.ok) {
        const data = await openElevResponse.json();
        if (data.results?.[0]?.elevation !== undefined) {
          return NextResponse.json({
            elevation: data.results[0].elevation,
            source: 'Open-Elevation',
            location: { latitude: lat, longitude: lon }
          });
        }
      }
    } catch (error) {
      console.warn('Open-Elevation failed:', error);
    }

    // Final fallback: estimate from coordinates
    // Basic elevation estimation based on geographic features
    let estimatedElevation = 0;

    // Very rough elevation estimation based on known geographic patterns
    // This is just a fallback and not accurate
    if (lat >= 25 && lat <= 49 && lon >= -125 && lon <= -66) {
      // Continental US - rough estimates
      if (lon >= -105 && lat >= 39) {
        estimatedElevation = 1500; // Rocky Mountain region
      } else if (lon >= -100 && lat >= 32) {
        estimatedElevation = 300; // Great Plains
      } else if (lat <= 35 && lon >= -95) {
        estimatedElevation = 50; // Gulf Coast
      } else {
        estimatedElevation = 200; // General continental US
      }
    }

    return NextResponse.json({
      elevation: estimatedElevation,
      source: 'Estimated',
      location: { latitude: lat, longitude: lon },
      warning: 'Elevation data estimated due to API failures'
    });

  } catch (error) {
    console.error('Elevation API error:', error);
    return NextResponse.json(
      { 
        elevation: 0,
        source: 'Fallback',
        location: { latitude: lat, longitude: lon },
        error: 'All elevation services failed',
        warning: 'Using sea level as fallback'
      },
      { status: 200 } // Return 200 with fallback data rather than error
    );
  }
} 