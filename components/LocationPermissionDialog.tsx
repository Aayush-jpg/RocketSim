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
    // Update global environment conditions with real data
    window.environmentConditions = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      elevation: locationData.elevation,
      windSpeed: weatherData.current.windSpeed,
      windDirection: weatherData.current.windDirection,
      atmosphericModel: "standard",
      date: new Date().toISOString(),
      temperature: weatherData.current.temperature,
      pressure: weatherData.current.pressure,
      humidity: weatherData.current.humidity,
      visibility: weatherData.current.visibility,
      cloudCover: weatherData.current.cloudCover
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
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {/* Content based on step */}
          {step === 'request' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPinIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Enable Real Weather Data
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Get accurate atmospheric conditions for your rocket simulations using real-time weather data from your location.
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  What we'll get:
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Current wind speed and direction</li>
                  <li>• Atmospheric pressure and temperature</li>
                  <li>• Humidity and visibility conditions</li>
                  <li>• Multi-level atmospheric profile</li>
                  <li>• Launch site elevation</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleRequestLocation}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <MapPinIcon className="w-5 h-5" />
                  Allow Location Access
                </button>
                
                <button
                  onClick={handleUseManualLocation}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 transition-colors"
                >
                  Enter location manually
                </button>
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowPathIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Getting Your Location
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {isLoadingWeather ? 'Fetching real-time weather data...' : 'Requesting location permission...'}
              </p>

              <div className="space-y-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div
                    className="bg-blue-600 h-2 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: isLoadingWeather ? "75%" : "25%" }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isLoadingWeather ? 'Loading weather data...' : 'Getting location...'}
                </p>
              </div>
            </div>
          )}

          {step === 'success' && location && weather && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Real Weather Data Loaded!
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your simulations will now use accurate atmospheric conditions.
              </p>

              {/* Location and weather summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-left">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Location</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {location.city ? `${location.city}, ${location.country}` : 'Custom Location'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Elevation</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {location.elevation.toFixed(0)} m
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Wind</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {weather.current.windSpeed.toFixed(1)} m/s
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {weather.current.windDirection.toFixed(0)}°
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Conditions</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {weather.current.temperature.toFixed(1)}°C
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {weather.current.pressure.toFixed(0)} hPa
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Data source: {weather.current.source} • Model: {weather.model}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Start Simulation with Real Data
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Location Access Failed
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {error}
              </p>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Don't worry! Your simulations will use standard atmospheric conditions. 
                  You can try again or enter your location manually for more accurate results.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Try Again
                </button>
                
                <button
                  onClick={handleUseManualLocation}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium py-2 transition-colors"
                >
                  Enter location manually
                </button>
                
                <button
                  onClick={onClose}
                  className="w-full text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium py-2 transition-colors"
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