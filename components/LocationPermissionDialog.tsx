'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPinIcon, 
  CloudIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { requestLocationPermission, getCurrentWeather, type LocationData, type WeatherForecast } from '@/lib/services/weather';
import { useRocket } from '@/lib/store';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LocationPermissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationObtained?: (location: LocationData, weather: WeatherForecast) => void;
}

export default function LocationPermissionDialog({ 
  isOpen, 
  onClose, 
  onLocationObtained 
}: LocationPermissionDialogProps) {
  const [step, setStep] = useState<'request' | 'loading' | 'success' | 'error'>('request');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const { updateRocket } = useRocket();

  useEffect(() => {
    if (isOpen) {
      setStep('request');
      setError('');
      setLocation(null);
      setWeather(null);
    }
  }, [isOpen]);

  const handleRequestLocation = async () => {
    setStep('loading');
    setError('');

    try {
      // Request user location
      const locationData = await requestLocationPermission();
      setLocation(locationData);
      
      // Get weather data for the location
      setIsLoadingWeather(true);
      const weatherData = await getCurrentWeather(locationData);
      setWeather(weatherData);
      
      setStep('success');
      
      // Notify parent component
      if (onLocationObtained) {
        onLocationObtained(locationData, weatherData);
      }

      // Update rocket environment with real data
      updateEnvironmentWithRealData(locationData, weatherData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setStep('error');
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const updateEnvironmentWithRealData = (locationData: LocationData, weatherData: WeatherForecast) => {
    // Calculate real atmospheric data
    const temp = weatherData.current.temperature;
    const pressure = weatherData.current.pressure;
    const humidity = weatherData.current.humidity;
    
    // Calculate air density using ideal gas law
    const tempK = temp + 273.15;
    const density = (pressure * 100) / (287.05 * tempK);
    
    // Calculate speed of sound
    const soundSpeed = Math.sqrt(1.4 * 287.05 * tempK);

    // Update global environment conditions with real data
    const environmentConfig = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      elevation: locationData.elevation,
      windSpeed: weatherData.current.windSpeed,
      windDirection: weatherData.current.windDirection,
      atmosphericModel: "forecast" as const,
      date: new Date().toISOString(),
      temperature: weatherData.current.temperature,
      pressure: weatherData.current.pressure,
      humidity: weatherData.current.humidity,
      visibility: weatherData.current.visibility,
      cloudCover: weatherData.current.cloudCover,
      airDensity: density,
      soundSpeed: soundSpeed
    };

    // Update global environment conditions with real data
    window.environmentConditions = {
      ...environmentConfig,
      atmosphericModel: "forecast"
    };

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('realWeatherLoaded', {
      detail: { location: locationData, weather: weatherData }
    }));
  };

  const handleRetry = () => {
    setStep('request');
    setError('');
  };

  const handleUseManualLocation = () => {
    // For now, close dialog. In future, could show manual location input
    onClose();
  };

  const getWindDirection = (degrees: number): string => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const calculateLaunchScore = (weather: WeatherForecast): number => {
    let score = 100;
    const windSpeed = weather.current.windSpeed;
    const visibility = weather.current.visibility;
    const cloudCover = weather.current.cloudCover;

    // Deduct points for wind
    if (windSpeed > 15) score -= 40;
    else if (windSpeed > 10) score -= 20;
    else if (windSpeed > 5) score -= 10;

    // Deduct points for visibility
    if (visibility < 5) score -= 30;
    else if (visibility < 10) score -= 15;

    // Deduct points for cloud cover
    if (cloudCover > 80) score -= 15;

    return Math.max(0, score);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-strong bg-black/90 border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {/* Content based on step */}
          {step === 'request' && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <MapPinIcon className="w-8 h-8 text-blue-400" />
              </motion.div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Enable Real Weather Data
              </h3>
              
              <p className="text-gray-300 mb-6 leading-relaxed">
                Get accurate atmospheric conditions for your rocket simulations using real-time weather data from your location.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-strong bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6"
              >
                <h4 className="font-medium text-blue-300 mb-3">
                  Real-time Environmental Data:
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm text-blue-200">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    <span>Wind speed & direction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    <span>Atmospheric pressure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                    <span>Temperature profile</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                    <span>Humidity & visibility</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                    <span>Launch site elevation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
                    <span>Air density calculations</span>
                  </div>
                </div>
              </motion.div>

              <div className="space-y-3">
                <Button
                  onClick={handleRequestLocation}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
                  size="lg"
                >
                  <MapPinIcon className="w-5 h-5 mr-2" />
                  Allow Location Access
                </Button>
                
                <button
                  onClick={handleUseManualLocation}
                  className="w-full text-gray-400 hover:text-white font-medium py-2 transition-colors text-sm"
                >
                  Enter location manually
                </button>
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <ArrowPathIcon className="w-8 h-8 text-blue-400" />
              </motion.div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Getting Your Location
              </h3>
              
              <p className="text-gray-300 mb-6">
                {isLoadingWeather ? 'Fetching real-time weather data...' : 'Requesting location permission...'}
              </p>

              <div className="space-y-3">
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: isLoadingWeather ? "90%" : "45%" }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <p className="text-sm text-gray-400">
                  {isLoadingWeather ? 'Analyzing atmospheric conditions...' : 'Accessing GPS location...'}
                </p>
              </div>
            </div>
          )}

          {step === 'success' && location && weather && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircleIcon className="w-8 h-8 text-green-400" />
              </motion.div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Real Weather Data Loaded!
              </h3>
              
              <p className="text-gray-300 mb-6">
                Your simulations will now use accurate atmospheric conditions with a launch score of <span className="text-green-400 font-bold">{calculateLaunchScore(weather)}/100</span>.
              </p>

              {/* Location and weather summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-strong bg-white/5 border border-white/10 rounded-lg p-4 mb-6 text-left"
              >
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider">Location</p>
                    <p className="font-medium text-white">
                      {location.city ? `${location.city}, ${location.country}` : 'Custom Location'}
                    </p>
                    <p className="text-xs text-gray-400 font-mono">
                      {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider">Elevation</p>
                    <p className="font-medium text-white">
                      {location.elevation.toFixed(0)} m
                    </p>
                    <p className="text-xs text-gray-400">
                      Above sea level
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider">Wind</p>
                    <p className="font-medium text-white">
                      {weather.current.windSpeed.toFixed(1)} m/s
                    </p>
                    <p className="text-xs text-gray-400">
                      {getWindDirection(weather.current.windDirection)} ({weather.current.windDirection.toFixed(0)}°)
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wider">Conditions</p>
                    <p className="font-medium text-white">
                      {weather.current.temperature.toFixed(1)}°C
                    </p>
                    <p className="text-xs text-gray-400">
                      {weather.current.pressure.toFixed(0)} hPa, {weather.current.humidity.toFixed(0)}% RH
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">
                      Data source: {weather.current.source}
                    </span>
                    <span className="text-gray-400">
                      Model: {weather.model}
                    </span>
                  </div>
                </div>

                {/* Launch condition indicator */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Launch Conditions</span>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", 
                        calculateLaunchScore(weather) > 80 ? "bg-green-400" :
                        calculateLaunchScore(weather) > 60 ? "bg-yellow-400" : "bg-red-400"
                      )} />
                      <span className={cn("text-xs font-bold",
                        calculateLaunchScore(weather) > 80 ? "text-green-400" :
                        calculateLaunchScore(weather) > 60 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {calculateLaunchScore(weather) > 80 ? "EXCELLENT" :
                         calculateLaunchScore(weather) > 60 ? "GOOD" : "CAUTION"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <Button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                Start Simulation with Real Data
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
              </motion.div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Location Access Failed
              </h3>
              
              <p className="text-gray-300 mb-2">
                {error}
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-strong bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6"
              >
                <p className="text-sm text-yellow-200">
                  <strong>Don't worry!</strong> Your simulations will use standard atmospheric conditions (ISA). 
                  You can try again or enter your location manually for more accurate results.
                </p>
              </motion.div>

              <div className="space-y-3">
                <Button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                
                <button
                  onClick={handleUseManualLocation}
                  className="w-full text-gray-400 hover:text-white font-medium py-2 transition-colors text-sm"
                >
                  Enter location manually
                </button>
                
                <button
                  onClick={onClose}
                  className="w-full text-gray-500 hover:text-gray-300 font-medium py-2 transition-colors text-sm"
                >
                  Continue with standard atmosphere
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 