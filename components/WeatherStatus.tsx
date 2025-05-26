'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPinIcon, 
  CloudIcon, 
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { weatherService, type LocationData, type WeatherForecast } from '@/lib/services/weather';
import LocationPermissionDialog from './LocationPermissionDialog';

interface WeatherStatusProps {
  className?: string;
  compact?: boolean;
}

export default function WeatherStatus({ className = '', compact = false }: WeatherStatusProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
  };

  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const getWeatherQuality = (weather: WeatherForecast): { quality: string; color: string; message: string } => {
    const windSpeed = weather.current.windSpeed;
    const visibility = weather.current.visibility;
    const cloudCover = weather.current.cloudCover;

    if (windSpeed > 15 || visibility < 5) {
      return {
        quality: 'Poor',
        color: 'text-red-600 dark:text-red-400',
        message: 'High winds or low visibility - not recommended for launch'
      };
    } else if (windSpeed > 10 || cloudCover > 80) {
      return {
        quality: 'Fair',
        color: 'text-yellow-600 dark:text-yellow-400',
        message: 'Moderate conditions - proceed with caution'
      };
    } else {
      return {
        quality: 'Good',
        color: 'text-green-600 dark:text-green-400',
        message: 'Excellent conditions for rocket launch'
      };
    }
  };

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

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <CloudIcon className="w-5 h-5" />
          Weather Conditions
        </h3>
        
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          
          <button
            onClick={handleRefreshWeather}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh weather data"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {weather && location ? (
        <div className="space-y-4">
          {/* Location info */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <MapPinIcon className="w-4 h-4" />
            <span>
              {location.city ? `${location.city}, ${location.country}` : 'Custom Location'}
            </span>
            <span className="text-gray-400">•</span>
            <span>{location.elevation.toFixed(0)}m elevation</span>
          </div>

          {/* Weather quality indicator */}
          {(() => {
            const quality = getWeatherQuality(weather);
            return (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  quality.quality === 'Good' ? 'bg-green-500' :
                  quality.quality === 'Fair' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className={`font-medium ${quality.color}`}>
                  {quality.quality} Launch Conditions
                </span>
              </div>
            );
          })()}

          {/* Weather metrics grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Wind</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {weather.current.windSpeed.toFixed(1)} m/s {getWindDirection(weather.current.windDirection)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {weather.current.windDirection.toFixed(0)}° direction
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Temperature</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {weather.current.temperature.toFixed(1)}°C
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Feels like {weather.current.dewPoint?.toFixed(1) || 'N/A'}°C
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pressure</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {weather.current.pressure.toFixed(1)} hPa
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {weather.current.humidity.toFixed(0)}% humidity
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visibility</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {weather.current.visibility.toFixed(1)} km
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {weather.current.cloudCover.toFixed(0)}% clouds
              </p>
            </div>
          </div>

          {/* Data source */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Data from {weather.current.source} • Model: {weather.model}
            </p>
          </div>

          {/* Launch recommendation */}
          {(() => {
            const quality = getWeatherQuality(weather);
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg ${
                  quality.quality === 'Good' ? 'bg-green-50 dark:bg-green-900/20' :
                  quality.quality === 'Fair' ? 'bg-yellow-50 dark:bg-yellow-900/20' : 
                  'bg-red-50 dark:bg-red-900/20'
                }`}
              >
                <p className={`text-sm ${quality.color}`}>
                  {quality.message}
                </p>
              </motion.div>
            );
          })()}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <MapPinIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          
          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
            Enable Real Weather Data
          </h4>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Get accurate atmospheric conditions for more realistic rocket simulations.
          </p>
          
          <button
            onClick={() => setShowLocationDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Enable Location Access
          </button>
        </div>
      )}

      <LocationPermissionDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onLocationObtained={handleLocationObtained}
      />
    </div>
  );
} 