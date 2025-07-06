/**
 * Real-world weather data service for rocket simulations
 * Integrates with multiple weather APIs for accurate atmospheric conditions
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  elevation: number;
  city?: string;
  country?: string;
  timezone?: string;
}

export interface WeatherData {
  temperature: number; // °C
  pressure: number; // hPa
  humidity: number; // %
  windSpeed: number; // m/s
  windDirection: number; // degrees
  visibility: number; // km
  cloudCover: number; // %
  dewPoint: number; // °C
  timestamp: string;
  source: string;
}

export interface AtmosphericProfile {
  altitude: number[]; // meters
  temperature: number[]; // K
  pressure: number[]; // Pa
  density: number[]; // kg/m³
  windU: number[]; // m/s (east component)
  windV: number[]; // m/s (north component)
}

export interface WeatherForecast {
  current: WeatherData;
  hourly: WeatherData[];
  atmospheric: AtmosphericProfile;
  location: LocationData;
  validTime: string;
  model: 'GFS' | 'HRRR' | 'OpenWeather' | 'NOAA';
}

class WeatherService {
  private static instance: WeatherService;
  private locationCache: LocationData | null = null;
  private weatherCache: Map<string, WeatherForecast> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // API Keys (should be set in environment variables)
  private readonly OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  //private readonly NOAA_API_KEY = process.env.NEXT_PUBLIC_NOAA_API_KEY;

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Request user location permission and get current position
   */
  async requestUserLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      // Show user-friendly permission request
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000 // 5 minutes
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            
            // Get elevation and location details
            const locationData = await this.enrichLocationData(latitude, longitude);
            
            // Cache the location
            this.locationCache = locationData;
            
            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('locationObtained', {
              detail: locationData
            }));
            
            resolve(locationData);
          } catch (error) {
            reject(error);
          }
        },
        (error) => {
          let errorMessage = 'Location access denied';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        options
      );
    });
  }

  /**
   * Enrich basic coordinates with elevation, timezone, and location details
   */
  private async enrichLocationData(latitude: number, longitude: number): Promise<LocationData> {
    try {
      // Get elevation from multiple sources for accuracy
      const elevation = await this.getElevation(latitude, longitude);
      
      // Get location details (city, country, timezone)
      const locationDetails = await this.getLocationDetails(latitude, longitude);
      
      return {
        latitude,
        longitude,
        elevation,
        ...locationDetails
      };
    } catch (error) {
      console.warn('Failed to enrich location data:', error);
      return {
        latitude,
        longitude,
        elevation: 0 // Fallback to sea level
      };
    }
  }

  /**
   * Get elevation data from multiple sources
   */
  private async getElevation(latitude: number, longitude: number): Promise<number> {
    try {
      // Use our proxy API to avoid CORS issues
      const response = await fetch(`/api/elevation?lat=${latitude}&lon=${longitude}`);
      
      if (response.ok) {
        const data = await response.json();
        if (typeof data.elevation === 'number' && !isNaN(data.elevation)) {
          if (data.warning) {
            console.warn(`Elevation warning: ${data.warning}`);
          }
          return data.elevation;
        }
      }
    } catch (error) {
      console.warn('Elevation API proxy failed:', error);
    }

    // Final fallback: estimate from barometric formula
    return 0; // Default to sea level
  }

  /**
   * Get location details (city, country, timezone)
   */
  private async getLocationDetails(latitude: number, longitude: number) {
    try {
      // Use OpenWeatherMap Geocoding API for location details
      if (this.OPENWEATHER_API_KEY) {
        const response = await fetch(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${this.OPENWEATHER_API_KEY}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data[0]) {
            return {
              city: data[0].name,
              country: data[0].country,
              timezone: await this.getTimezone(latitude, longitude)
            };
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get location details:', error);
    }

    return {};
  }

  /**
   * Get timezone for coordinates
   */
  private async getTimezone(latitude: number, longitude: number): Promise<string> {
    try {
      // Use TimeZoneDB API or similar service
      const response = await fetch(
        `https://api.timezonedb.com/v2.1/get-time-zone?key=${process.env.NEXT_PUBLIC_TIMEZONE_API_KEY}&format=json&by=position&lat=${latitude}&lng=${longitude}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.zoneName || 'UTC';
      }
    } catch (error) {
      console.warn('Timezone lookup failed:', error);
    }

    return 'UTC';
  }

  /**
   * Get comprehensive weather forecast for location
   */
  async getWeatherForecast(location: LocationData, date?: Date): Promise<WeatherForecast> {
    const cacheKey = `${location.latitude},${location.longitude},${date?.toISOString() || 'current'}`;
    
    // Check cache first
    const cached = this.weatherCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.validTime)) {
      return cached;
    }

    try {
      // Try to get GFS data first (most comprehensive for rocket simulations)
      const gfsData = await this.getGFSData(location, date);
      if (gfsData) {
        this.weatherCache.set(cacheKey, gfsData);
        return gfsData;
      }
    } catch (error) {
      console.warn('GFS data failed, trying alternatives:', error);
    }

    try {
      // Fallback to OpenWeatherMap
      const owmData = await this.getOpenWeatherData(location, date);
      if (owmData) {
        this.weatherCache.set(cacheKey, owmData);
        return owmData;
      }
    } catch (error) {
      console.warn('OpenWeatherMap failed:', error);
    }

    // Final fallback: standard atmosphere with estimated conditions
    return this.getStandardAtmosphere(location);
  }

  /**
   * Get GFS (Global Forecast System) data - most accurate for rocket simulations
   */
  private async getGFSData(location: LocationData, date?: Date): Promise<WeatherForecast | null> {
    try {
      // Use NOAA GFS API or similar service
      const targetDate = date || new Date();
      const response = await fetch('/api/weather/gfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          date: targetDate.toISOString(),
          levels: [1000, 925, 850, 700, 500, 300, 250, 200, 150, 100] // Pressure levels
        })
      });

      if (response.ok) {
        const data = await response.json();
        return this.processGFSData(data, location);
      }
    } catch (error) {
      console.error('GFS data fetch failed:', error);
    }

    return null;
  }

  /**
   * Get OpenWeatherMap data with atmospheric profile estimation
   */
  private async getOpenWeatherData(location: LocationData, date?: Date): Promise<WeatherForecast | null> {
    if (!this.OPENWEATHER_API_KEY) {
      console.warn('OpenWeatherMap API key not configured');
      return null;
    }

    try {
      // Current weather
      const currentResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${this.OPENWEATHER_API_KEY}&units=metric`
      );

      // 5-day forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${location.latitude}&lon=${location.longitude}&appid=${this.OPENWEATHER_API_KEY}&units=metric`
      );

      if (currentResponse.ok && forecastResponse.ok) {
        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();
        
        return this.processOpenWeatherData(currentData, forecastData, location);
      }
    } catch (error) {
      console.error('OpenWeatherMap fetch failed:', error);
    }

    return null;
  }

  /**
   * Process GFS data into our format
   */
  private processGFSData(data: any, location: LocationData): WeatherForecast {
    // Process multi-level atmospheric data from GFS
    const atmospheric: AtmosphericProfile = {
      altitude: [],
      temperature: [],
      pressure: [],
      density: [],
      windU: [],
      windV: []
    };

    // Convert pressure levels to altitude and process data
    data.levels?.forEach((level: any) => {
      const altitude = this.pressureToAltitude(level.pressure * 100); // Convert hPa to Pa
      atmospheric.altitude.push(altitude);
      atmospheric.temperature.push(level.temperature + 273.15); // Convert to Kelvin
      atmospheric.pressure.push(level.pressure * 100); // Convert to Pa
      atmospheric.density.push(this.calculateDensity(level.pressure * 100, level.temperature + 273.15));
      atmospheric.windU.push(level.windU || 0);
      atmospheric.windV.push(level.windV || 0);
    });

    const current: WeatherData = {
      temperature: data.surface.temperature,
      pressure: data.surface.pressure,
      humidity: data.surface.humidity,
      windSpeed: Math.sqrt(data.surface.windU ** 2 + data.surface.windV ** 2),
      windDirection: ((Math.atan2(data.surface.windU, data.surface.windV) * 180 / Math.PI) + 360) % 360,
      visibility: data.surface.visibility || 10,
      cloudCover: data.surface.cloudCover || 0,
      dewPoint: data.surface.dewPoint,
      timestamp: new Date().toISOString(),
      source: 'GFS'
    };

    return {
      current,
      hourly: data.hourly || [],
      atmospheric,
      location,
      validTime: new Date().toISOString(),
      model: 'GFS'
    };
  }

  /**
   * Process OpenWeatherMap data and estimate atmospheric profile
   */
  private processOpenWeatherData(current: any, forecast: any, location: LocationData): WeatherForecast {
    const currentWeather: WeatherData = {
      temperature: current.main.temp,
      pressure: current.main.pressure,
      humidity: current.main.humidity,
      windSpeed: current.wind.speed,
      windDirection: current.wind.deg,
      visibility: current.visibility / 1000, // Convert to km
      cloudCover: current.clouds.all,
      dewPoint: this.calculateDewPoint(current.main.temp, current.main.humidity),
      timestamp: new Date().toISOString(),
      source: 'OpenWeatherMap'
    };

    // Estimate atmospheric profile using standard atmosphere with surface conditions
    const atmospheric = this.estimateAtmosphericProfile(currentWeather, location.elevation);

    // Process hourly forecast
    const hourly: WeatherData[] = forecast.list.map((item: any) => ({
      temperature: item.main.temp,
      pressure: item.main.pressure,
      humidity: item.main.humidity,
      windSpeed: item.wind.speed,
      windDirection: item.wind.deg,
      visibility: 10, // Default
      cloudCover: item.clouds.all,
      dewPoint: this.calculateDewPoint(item.main.temp, item.main.humidity),
      timestamp: new Date(item.dt * 1000).toISOString(),
      source: 'OpenWeatherMap'
    }));

    return {
      current: currentWeather,
      hourly,
      atmospheric,
      location,
      validTime: new Date().toISOString(),
      model: 'OpenWeather'
    };
  }

  /**
   * Generate standard atmosphere as fallback
   */
  private getStandardAtmosphere(location: LocationData): WeatherForecast {
    const current: WeatherData = {
      temperature: 15, // Standard temperature
      pressure: 1013.25 * Math.exp(-location.elevation / 8400), // Barometric formula
      humidity: 50,
      windSpeed: 0,
      windDirection: 0,
      visibility: 10,
      cloudCover: 0,
      dewPoint: 5,
      timestamp: new Date().toISOString(),
      source: 'Standard Atmosphere'
    };

    const atmospheric = this.estimateAtmosphericProfile(current, location.elevation);

    return {
      current,
      hourly: [],
      atmospheric,
      location,
      validTime: new Date().toISOString(),
      model: 'OpenWeather' // Fallback model
    };
  }

  /**
   * Estimate atmospheric profile from surface conditions
   */
  private estimateAtmosphericProfile(surface: WeatherData, elevation: number): AtmosphericProfile {
    const altitudes = [];
    const temperatures = [];
    const pressures = [];
    const densities = [];
    const windU = [];
    const windV = [];

    // Generate profile from surface to 30km
    for (let alt = elevation; alt <= 30000; alt += 500) {
      altitudes.push(alt);
      
      // Standard atmosphere temperature lapse rate
      let temp;
      if (alt <= 11000) {
        temp = surface.temperature + 273.15 - 0.0065 * (alt - elevation);
      } else {
        temp = 216.65; // Stratosphere
      }
      temperatures.push(temp);
      
      // Pressure using barometric formula
      const pressure = surface.pressure * 100 * Math.exp(-(alt - elevation) / 8400);
      pressures.push(pressure);
      
      // Density from ideal gas law
      const density = this.calculateDensity(pressure, temp);
      densities.push(density);
      
      // Wind profile (increases with altitude)
      const windFactor = 1 + (alt - elevation) / 10000;
      const windRad = surface.windDirection * Math.PI / 180;
      windU.push(surface.windSpeed * Math.sin(windRad) * windFactor);
      windV.push(surface.windSpeed * Math.cos(windRad) * windFactor);
    }

    return {
      altitude: altitudes,
      temperature: temperatures,
      pressure: pressures,
      density: densities,
      windU,
      windV
    };
  }

  /**
   * Utility functions
   */
  private pressureToAltitude(pressure: number): number {
    // Standard atmosphere pressure-altitude relationship
    return 44330 * (1 - Math.pow(pressure / 101325, 0.1903));
  }

  private calculateDensity(pressure: number, temperature: number): number {
    // Ideal gas law: ρ = P / (R * T)
    const R = 287.05; // Specific gas constant for dry air
    return pressure / (R * temperature);
  }

  private calculateDewPoint(temperature: number, humidity: number): number {
    // Magnus formula approximation
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
  }

  private isCacheValid(validTime: string): boolean {
    const cacheTime = new Date(validTime).getTime();
    const now = Date.now();
    return (now - cacheTime) < this.CACHE_DURATION;
  }

  /**
   * Get cached location if available
   */
  getCachedLocation(): LocationData | null {
    return this.locationCache;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.weatherCache.clear();
    this.locationCache = null;
  }
}

// Export singleton instance
export const weatherService = WeatherService.getInstance();

// Export utility functions for components
export async function requestLocationPermission(): Promise<LocationData> {
  return weatherService.requestUserLocation();
}

export async function getCurrentWeather(location?: LocationData): Promise<WeatherForecast> {
  const targetLocation = location || weatherService.getCachedLocation();
  if (!targetLocation) {
    throw new Error('No location available. Please enable location access.');
  }
  return weatherService.getWeatherForecast(targetLocation);
}

export async function getWeatherForDate(date: Date, location?: LocationData): Promise<WeatherForecast> {
  const targetLocation = location || weatherService.getCachedLocation();
  if (!targetLocation) {
    throw new Error('No location available. Please enable location access.');
  }
  return weatherService.getWeatherForecast(targetLocation, date);
} 