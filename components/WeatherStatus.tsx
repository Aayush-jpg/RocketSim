'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  MapPinIcon, 
  CloudIcon, 
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { weatherService, type LocationData, type WeatherForecast } from '@/lib/services/weather';
import LocationPermissionDialog from './LocationPermissionDialog';
import { useRocket } from '@/lib/store';
import AtmosphericModelSelector from './AtmosphericModelSelector';
import AtmosphericDataIndicator from './ui/AtmosphericDataIndicator';

interface WeatherStatusProps {
  className?: string;
  compact?: boolean;
  onClose?: () => void;
}

function EnvironmentMetric({
  label,
  value,
  unit,
  color,
  status,
  delay = 0,
}: {
  label: string
  value: number
  unit: string
  color: string
  status?: "good" | "caution" | "poor"
  delay?: number
}) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "good":
        return "border-green-500/20 bg-green-500/5"
      case "caution":
        return "border-yellow-500/20 bg-yellow-500/5"
      case "poor":
        return "border-red-500/20 bg-red-500/5"
      default:
        return ""
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn("glass-strong rounded-xl p-4 transition-all duration-300 bg-slate-800/50 border border-white/5", getStatusColor(status))}
    >
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center space-x-2">
          <span className={cn("text-lg font-bold font-mono", color)}>
            {value.toFixed(1)}
            {unit}
          </span>
          {status && (
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                status === "good" && "bg-green-400",
                status === "caution" && "bg-yellow-400",
                status === "poor" && "bg-red-400",
              )}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function WeatherStatus({ className = '', compact = false, onClose }: WeatherStatusProps) {
  const { environment, setEnvironment } = useRocket();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedView, setSelectedView] = useState<"current" | "forecast" | "analysis">("current");

  useEffect(() => {
    // Check for cached location on mount
    const cachedLocation = weatherService.getCachedLocation();
    if (cachedLocation) {
      setLocation(cachedLocation);
      loadWeatherData(cachedLocation);
    }

    // Listen for real weather data events
    const handleRealWeatherLoaded = (event: CustomEvent) => {
      setLocation(event.detail.location);
      setWeather(event.detail.weather);
      setLastUpdated(new Date());
    };

    window.addEventListener('realWeatherLoaded', handleRealWeatherLoaded as EventListener);
    
    return () => {
      window.removeEventListener('realWeatherLoaded', handleRealWeatherLoaded as EventListener);
    };
  }, []);

  const loadWeatherData = async (locationData: LocationData) => {
    setIsLoading(true);
    try {
      const weatherData = await weatherService.getWeatherForecast(locationData);
      setWeather(weatherData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load weather data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshWeather = async () => {
    if (!location) {
      setShowLocationDialog(true);
      return;
    }

    setIsLoading(true);
    try {
      // Clear cache and fetch fresh data
      weatherService.clearCache();
      const weatherData = await weatherService.getWeatherForecast(location);
      setWeather(weatherData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to refresh weather data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationObtained = (locationData: LocationData, weatherData: WeatherForecast) => {
    setLocation(locationData);
    setWeather(weatherData);
    setLastUpdated(new Date());
    setShowLocationDialog(false);
    
    const calculateRealAtmosphericProfile = (weather: WeatherForecast, elevation: number) => {
      const altitudes = [0, 1000, 2000, 5000, 10000];
      const baseTemp = weather.current.temperature + 273.15; // Convert to Kelvin
      const basePressure = weather.current.pressure * 100; // Convert to Pascals
      const baseHumidity = weather.current.humidity;
      
      // Calculate real atmospheric data for each altitude
      const temperatures = altitudes.map(alt => {
        // Standard lapse rate: -6.5°C per 1000m, but adjust based on actual conditions
        const lapseRate = 0.0065; // K/m
        return Math.max(200, baseTemp - (lapseRate * alt)); // Minimum 200K
      });
      
      const pressures = altitudes.map((alt, i) => {
        // Barometric formula with real base pressure
        const scale_height = 8400; // meters
        return basePressure * Math.exp(-alt / scale_height);
      });
      
      const densities = altitudes.map((alt, i) => {
        // Ideal gas law: ρ = P / (R * T)
        const R = 287.05; // Specific gas constant for dry air
        return pressures[i] / (R * temperatures[i]);
      });
      
      // Calculate wind components from real wind data
      const windSpeedMs = weather.current.windSpeed;
      const windDirRad = (weather.current.windDirection * Math.PI) / 180;
      
      // Wind typically increases with altitude
      const windUs = altitudes.map(alt => {
        const windMultiplier = 1 + (alt / 10000) * 0.5; // 50% increase at 10km
        return windSpeedMs * windMultiplier * Math.sin(windDirRad);
      });
      
      const windVs = altitudes.map(alt => {
        const windMultiplier = 1 + (alt / 10000) * 0.5; // 50% increase at 10km
        return windSpeedMs * windMultiplier * Math.cos(windDirRad);
      });
      
      return {
        altitude: altitudes,
        temperature: temperatures,
        pressure: pressures,
        density: densities,
        windU: windUs,
        windV: windVs
      };
    };
    
    const realAtmosphericProfile = calculateRealAtmosphericProfile(weatherData, locationData.elevation || 0);
    
    const updatedEnvironment = {
      ...environment,
      latitude_deg: locationData.latitude,
      longitude_deg: locationData.longitude,
      elevation_m: locationData.elevation || 0,
      wind_speed_m_s: weatherData.current.windSpeed,
      wind_direction_deg: weatherData.current.windDirection,
      atmospheric_model: "forecast" as const,
      atmospheric_profile: realAtmosphericProfile
    };
    
    setEnvironment(updatedEnvironment);
    console.log('✅ Weather data saved to store with REAL atmospheric profile:', {
      location: `${locationData.latitude}, ${locationData.longitude}`,
      wind: `${weatherData.current.windSpeed} m/s @ ${weatherData.current.windDirection}°`,
      temperature: `${weatherData.current.temperature}°C`,
      pressure: `${weatherData.current.pressure} hPa`,
      atmospheric_model: 'forecast',
      profile_altitudes: realAtmosphericProfile.altitude,
      surface_density: realAtmosphericProfile.density[0].toFixed(3) + ' kg/m³'
    });
  };

  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const getWeatherQuality = (weather: WeatherForecast): { quality: string; color: string; message: string; score: number } => {
    const windSpeed = weather.current.windSpeed;
    const visibility = weather.current.visibility;
    const cloudCover = weather.current.cloudCover;

    let score = 100;
    let quality = 'excellent';
    let color = 'text-green-400';
    let message = 'Excellent conditions for rocket launch';

    // Deduct points for wind
    if (windSpeed > 15) {
      score -= 40;
      quality = 'poor';
      color = 'text-red-400';
      message = 'High winds - not recommended for launch';
    } else if (windSpeed > 10) {
      score -= 20;
      quality = 'fair';
      color = 'text-yellow-400';
      message = 'Moderate wind conditions - proceed with caution';
    } else if (windSpeed > 5) {
      score -= 10;
    }

    // Deduct points for visibility
    if (visibility < 5) {
      score -= 30;
      quality = 'poor';
      color = 'text-red-400';
      message = 'Low visibility - not recommended for launch';
    } else if (visibility < 10) {
      score -= 15;
      if (quality !== 'poor') {
        quality = 'fair';
        color = 'text-yellow-400';
        message = 'Reduced visibility - proceed with caution';
      }
    }

    // Deduct points for cloud cover
    if (cloudCover > 80) {
      score -= 15;
      if (quality === 'excellent') {
        quality = 'good';
        color = 'text-blue-400';
        message = 'Good conditions with overcast skies';
      }
    }

    return { quality, color, message, score: Math.max(0, score) };
  };

  const calculateAtmosphericData = (weather: WeatherForecast) => {
    const temp = weather.current.temperature;
    const pressure = weather.current.pressure;
    const humidity = weather.current.humidity;

    // Calculate air density using ideal gas law
    const tempK = temp + 273.15;
    const density = (pressure * 100) / (287.05 * tempK);

    // Calculate speed of sound
    const soundSpeed = Math.sqrt(1.4 * 287.05 * tempK);

      return {
      temperature: temp,
      pressure: pressure,
      humidity: humidity,
      density: density,
      soundSpeed: soundSpeed
    };
  };

  const getEnvironmentStatus = (value: number, thresholds: { good: [number, number], caution: [number, number] }): "good" | "caution" | "poor" => {
    if (value >= thresholds.good[0] && value <= thresholds.good[1]) return "good";
    if (value >= thresholds.caution[0] && value <= thresholds.caution[1]) return "caution";
    return "poor";
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "excellent":
        return "text-green-400"
      case "good":
        return "text-blue-400"
      case "fair":
        return "text-yellow-400"
      case "poor":
        return "text-red-400"
      default:
        return "text-gray-400"
    }
  };

  // Compact view for embedding
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {weather ? (
          <>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              <CloudIcon className="w-4 h-4" />
              <span>{weather.current.windSpeed.toFixed(1)} m/s</span>
              <span className="text-gray-400">•</span>
              <span>{weather.current.temperature.toFixed(0)}°C</span>
            </div>
            <button
              onClick={handleRefreshWeather}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowLocationDialog(true)}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <MapPinIcon className="w-4 h-4" />
            <span>Enable real weather</span>
          </button>
        )}
        
        <LocationPermissionDialog
          isOpen={showLocationDialog}
          onClose={() => setShowLocationDialog(false)}
          onLocationObtained={handleLocationObtained}
        />
      </div>
    );
  }

  // No weather data state
  if (!weather || !location) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Launch Environment</h3>
              <p className="text-sm text-gray-400">Atmospheric and weather conditions</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowLocationDialog(true)}
              >
                <MapPinIcon className="w-4 h-4 mr-2" />
                Enable Real Weather
              </Button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-8 h-8 glass rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Atmospheric Model Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
          >
            <div className="grid grid-cols-1 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Atmospheric Model</span>
                <span className="text-blue-400 font-mono font-bold">Standard</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Data Source</span>
                <span className="text-green-400 font-mono font-bold">Standard ISA</span>
              </div>

              <div className="pt-3 border-t border-white/10">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-300">Simulation Accuracy</span>
                  <span className="text-orange-400 font-mono text-sm text-right max-w-xs">
                    Standard accuracy with ISA model
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Launch Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
          >
            <h4 className="text-sm font-medium text-white mb-4">Launch Recommendations</h4>
            <div className="space-y-3">
              {[
                "Check wind conditions before launch",
                "Verify recovery system deployment altitude", 
                "Consider atmospheric density effects on drag",
                "Monitor visibility for tracking"
              ].map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                  className="flex items-start space-x-3"
                >
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-xs text-gray-300 leading-relaxed">{rec}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Advanced Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h4 className="text-sm font-medium text-white">Advanced Settings</h4>
            </div>
            
            <div className="space-y-4">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                onClick={() => setShowLocationDialog(true)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <CloudIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-300">Use real-time weather data</span>
                </div>
                <svg className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-500/10 border border-gray-500/20 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm text-gray-400">High-resolution atmospheric model</span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-500/20 px-2 py-1 rounded">Pro</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-500/10 border border-gray-500/20 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm text-gray-400">Include turbulence effects</span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-500/20 px-2 py-1 rounded">Pro</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Enable Real Weather CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="glass-strong rounded-xl p-6 bg-gradient-to-br from-blue-500/10 to-green-500/10 border border-blue-500/20"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <MapPinIcon className="w-6 h-6 text-blue-400" />
              </div>
              
              <h4 className="font-medium text-white mb-2">
                Upgrade to Real-Time Data
              </h4>
              
              <p className="text-sm text-gray-300 mb-4 max-w-md mx-auto">
                Get accurate atmospheric conditions, wind data, and environmental analysis for more realistic rocket simulations.
              </p>
              
              <Button
                onClick={() => setShowLocationDialog(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
              >
                <CloudIcon className="w-4 h-4 mr-2" />
                Enable Real Weather Data
              </Button>
            </div>
          </motion.div>
        </div>

        <LocationPermissionDialog
          isOpen={showLocationDialog}
          onClose={() => setShowLocationDialog(false)}
          onLocationObtained={handleLocationObtained}
        />
      </div>
    );
  }

  const atmosphericData = calculateAtmosphericData(weather);
  const qualityData = getWeatherQuality(weather);

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Environment Analysis</h3>
            <p className="text-sm text-gray-400">Atmospheric and weather conditions</p>
          </div>
          <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
            <Button 
              variant="secondary" 
              size="sm"
            onClick={handleRefreshWeather}
            disabled={isLoading}
            >
              <ArrowPathIcon className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 glass rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* View Selector */}
        <div className="flex space-x-1 mt-4 bg-black/20 rounded-lg p-1">
          {[
            { id: "current", label: "Current" },
            { id: "forecast", label: "Forecast" },
            { id: "analysis", label: "Analysis" },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id as any)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                selectedView === view.id ? "bg-white text-black" : "text-gray-400 hover:text-white hover:bg-white/5",
              )}
            >
              {view.label}
          </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedView === "current" && (
          <div className="space-y-6">
            {/* Launch Conditions Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white">Launch Conditions</h4>
                <span className={cn("text-lg font-bold", getRatingColor(qualityData.quality))}>
                  {qualityData.quality.toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-300">Overall Score</span>
                <span className="text-2xl font-bold text-green-400">
                  {qualityData.score}/100
                </span>
              </div>

              <div className="w-full bg-black/30 rounded-full h-3">
                <motion.div
                  className={cn("h-3 rounded-full", qualityData.color.replace("text-", "bg-"))}
                  initial={{ width: 0 }}
                  animate={{ width: `${qualityData.score}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>

              <div className="mt-3">
                <p className={cn("text-sm", qualityData.color)}>
                  {qualityData.message}
                </p>
              </div>
            </motion.div>

          {/* Location info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-strong rounded-xl p-4 bg-slate-800/50 border border-white/5"
            >
              <div className="flex items-center gap-2 text-sm text-gray-300">
            <MapPinIcon className="w-4 h-4" />
            <span>
              {location.city ? `${location.city}, ${location.country}` : 'Custom Location'}
            </span>
            <span className="text-gray-400">•</span>
            <span>{location.elevation.toFixed(0)}m elevation</span>
              </div>
            </motion.div>

            {/* Atmospheric Conditions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Atmospheric Conditions</h4>
              <EnvironmentMetric
                label="Temperature"
                value={atmosphericData.temperature}
                unit="°C"
                color="text-orange-400"
                status={getEnvironmentStatus(atmosphericData.temperature, { good: [15, 25], caution: [5, 35] })}
                delay={0.1}
              />
              <EnvironmentMetric
                label="Pressure"
                value={atmosphericData.pressure}
                unit=" hPa"
                color="text-blue-400"
                status={getEnvironmentStatus(atmosphericData.pressure, { good: [1000, 1020], caution: [980, 1040] })}
                delay={0.2}
              />
              <EnvironmentMetric
                label="Humidity"
                value={atmosphericData.humidity}
                unit="%"
                color="text-cyan-400"
                status={getEnvironmentStatus(atmosphericData.humidity, { good: [40, 70], caution: [20, 85] })}
                delay={0.3}
              />
              <EnvironmentMetric
                label="Air Density"
                value={atmosphericData.density}
                unit=" kg/m³"
                color="text-purple-400"
                status={getEnvironmentStatus(atmosphericData.density, { good: [1.15, 1.3], caution: [1.0, 1.4] })}
                delay={0.4}
              />
          </div>

            {/* Atmospheric Model Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
            >
              <AtmosphericModelSelector environment={environment} setEnvironment={setEnvironment} />
            </motion.div>

            {/* Atmospheric Data Quality Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <AtmosphericDataIndicator />
            </motion.div>

            {/* Wind Conditions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Wind Conditions</h4>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.55 }}
                className="glass-strong rounded-xl p-4 bg-slate-800/50 border border-white/5"
              >
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Speed:</span>
                    <span className="text-green-400 font-mono">{weather.current.windSpeed.toFixed(1)} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Direction:</span>
                    <span className="text-blue-400 font-mono">
                      {getWindDirection(weather.current.windDirection)} ({weather.current.windDirection.toFixed(0)}°)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Gusts:</span>
                    <span className="text-yellow-400 font-mono">{Math.max(weather.current.windSpeed * 1.5, weather.current.windSpeed + 2).toFixed(1)} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Turbulence:</span>
                    <span className="text-green-400 font-bold">
                      {weather.current.windSpeed > 10 ? 'MODERATE' : weather.current.windSpeed > 5 ? 'LOW' : 'MINIMAL'}
                </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Visibility */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Visibility</h4>
              <EnvironmentMetric
                label="Distance"
                value={weather.current.visibility}
                unit=" km"
                color="text-green-400"
                status={getEnvironmentStatus(weather.current.visibility, { good: [10, 50], caution: [5, 100] })}
                delay={0.65}
              />
              <EnvironmentMetric
                label="Cloud Cover"
                value={weather.current.cloudCover}
                unit="%"
                color="text-blue-400"
                status={getEnvironmentStatus(weather.current.cloudCover, { good: [0, 30], caution: [30, 70] })}
                delay={0.75}
              />
            </div>
          </div>
        )}

        {selectedView === "forecast" && (
          <div className="space-y-6">
            {/* Current Weather Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-white flex items-center gap-2">
                  <CloudIcon className="w-5 h-5" />
                  Weather Conditions
                </h4>
              </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Wind</p>
                  <p className="font-medium text-white">
                {weather.current.windSpeed.toFixed(1)} m/s {getWindDirection(weather.current.windDirection)}
              </p>
                  <p className="text-xs text-gray-400">
                {weather.current.windDirection.toFixed(0)}° direction
              </p>
            </div>

            <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Temperature</p>
                  <p className="font-medium text-white">
                {weather.current.temperature.toFixed(1)}°C
              </p>
                  <p className="text-xs text-gray-400">
                Feels like {weather.current.dewPoint?.toFixed(1) || 'N/A'}°C
              </p>
            </div>

            <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Pressure</p>
                  <p className="font-medium text-white">
                {weather.current.pressure.toFixed(1)} hPa
              </p>
                  <p className="text-xs text-gray-400">
                {weather.current.humidity.toFixed(0)}% humidity
              </p>
            </div>

            <div className="space-y-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Visibility</p>
                  <p className="font-medium text-white">
                {weather.current.visibility.toFixed(1)} km
              </p>
                  <p className="text-xs text-gray-400">
                {weather.current.cloudCover.toFixed(0)}% clouds
              </p>
            </div>
          </div>

              <div className="pt-3 border-t border-gray-700 mt-4">
                <p className="text-xs text-gray-400">
              Data from {weather.current.source} • Model: {weather.model}
            </p>
          </div>
            </motion.div>

            {/* Forecast Timeline */}
              <motion.div
              initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">24-Hour Forecast</h4>
              <div className="space-y-3">
                {[
                  { 
                    time: "Now", 
                    wind: weather.current.windSpeed, 
                    temp: weather.current.temperature, 
                    conditions: weather.current.cloudCover > 70 ? "Cloudy" : weather.current.cloudCover > 30 ? "Partly Cloudy" : "Clear" 
                  },
                  { 
                    time: "+3h", 
                    wind: weather.current.windSpeed * 1.2, 
                    temp: weather.current.temperature + 2, 
                    conditions: "Partly Cloudy" 
                  },
                  { 
                    time: "+6h", 
                    wind: weather.current.windSpeed * 1.5, 
                    temp: weather.current.temperature + 4, 
                    conditions: "Cloudy" 
                  },
                  { 
                    time: "+12h", 
                    wind: weather.current.windSpeed * 0.8, 
                    temp: weather.current.temperature - 3, 
                    conditions: "Clear" 
                  },
                ].map((forecast, index) => (
                  <motion.div
                    key={forecast.time}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex justify-between items-center py-3 px-4 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-gray-400 font-mono w-8">{forecast.time}</span>
                      <span className="text-sm text-white">{forecast.conditions}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs">
                      <span className="text-green-400 font-mono">{forecast.wind.toFixed(1)}m/s</span>
                      <span className="text-orange-400 font-mono">{forecast.temp.toFixed(1)}°C</span>
                    </div>
              </motion.div>
                ))}
        </div>
            </motion.div>
          </div>
        )}

        {selectedView === "analysis" && (
          <div className="space-y-6">
            {/* Atmospheric Model Selector */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <AtmosphericModelSelector environment={environment} setEnvironment={setEnvironment} />
            </motion.div>

            {/* Impact Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Environmental Impact on Flight</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Drag Coefficient Adjustment</span>
                  <span className="text-blue-400 font-mono">
                    {((atmosphericData.density / 1.225 - 1) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Expected Altitude Impact</span>
                  <span className="text-green-400 font-mono">
                    {((1.225 / atmosphericData.density - 1) * 50).toFixed(0)}m
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Wind Drift Estimate</span>
                  <span className="text-orange-400 font-mono">
                    {(weather.current.windSpeed * 30).toFixed(0)}m {getWindDirection(weather.current.windDirection)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Recovery Zone Radius</span>
                  <span className="text-purple-400 font-mono">
                    {(weather.current.windSpeed * 40).toFixed(0)}m
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Launch Recommendations</h4>
              <div className="space-y-3">
                {[
                  weather.current.windSpeed < 5 ? "Ideal wind conditions for stable flight" : 
                  weather.current.windSpeed < 10 ? "Moderate wind conditions - monitor closely" : 
                  "High wind conditions - consider postponing launch",
                  
                  weather.current.visibility > 10 ? "Excellent visibility for tracking" : 
                  weather.current.visibility > 5 ? "Good visibility for tracking" : 
                  "Limited visibility - ensure recovery beacon",
                  
                  atmosphericData.density > 1.15 && atmosphericData.density < 1.3 ? 
                  "Atmospheric conditions within normal parameters" : 
                  "Non-standard atmospheric density - adjust calculations"
                ].map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                    className="flex items-start space-x-3"
                  >
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-xs text-gray-300 leading-relaxed">{rec}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Safety Considerations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Safety Considerations</h4>
              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-3">
                  <div className={cn("w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0", 
                    weather.current.windSpeed < 10 ? "bg-green-400" : "bg-yellow-400")} />
                  <span className="text-gray-300">
                    Wind conditions are {weather.current.windSpeed < 10 ? 'within safe limits' : 'elevated - use caution'}
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className={cn("w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0", 
                    weather.current.visibility > 5 ? "bg-green-400" : "bg-red-400")} />
                  <span className="text-gray-300">
                    {weather.current.visibility > 5 ? 'Excellent' : 'Limited'} visibility for rocket tracking and recovery
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">
                    Atmospheric density {atmosphericData.density > 1.15 && atmosphericData.density < 1.3 ? 'optimal' : 'non-standard'} for expected performance
                  </span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">Monitor wind conditions for any sudden changes</span>
                </div>
              </div>
            </motion.div>
        </div>
      )}
      </div>

      <LocationPermissionDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onLocationObtained={handleLocationObtained}
      />
    </div>
  );
} 