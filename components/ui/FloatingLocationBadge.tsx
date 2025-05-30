"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPinIcon, CloudIcon } from "@heroicons/react/24/outline"
import { requestLocationPermission, getCurrentWeather } from "@/lib/services/weather"

export function FloatingLocationBadge() {
  const [hasLocation, setHasLocation] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [weatherData, setWeatherData] = useState<any>(null)

  useEffect(() => {
    // Check if location is already available
    const checkLocation = () => {
      if (window.environmentConditions?.latitude) {
        setHasLocation(true)
        setWeatherData(window.environmentConditions)
      }
    }

    checkLocation()

    // Listen for location updates
    const handleLocationUpdate = (event: CustomEvent) => {
      setHasLocation(true)
      setWeatherData(event.detail.weather.current)
    }

    window.addEventListener("realWeatherLoaded", handleLocationUpdate as EventListener)
    return () => window.removeEventListener("realWeatherLoaded", handleLocationUpdate as EventListener)
  }, [])

  const handleQuickEnable = async () => {
    setIsLoading(true)
    try {
      const location = await requestLocationPermission()
      const weather = await getCurrentWeather(location)

      window.environmentConditions = {
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        windSpeed: weather.current.windSpeed,
        windDirection: weather.current.windDirection,
        atmosphericModel: "forecast",
        date: new Date().toISOString(),
        temperature: weather.current.temperature,
        pressure: weather.current.pressure,
        humidity: weather.current.humidity,
        visibility: weather.current.visibility,
        cloudCover: weather.current.cloudCover,
      }

      setHasLocation(true)
      setWeatherData(weather.current)

      window.dispatchEvent(
        new CustomEvent("realWeatherLoaded", {
          detail: { location, weather },
        }),
      )
    } catch (error) {
      console.error("Failed to enable location:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-40"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, type: "spring" }}
    >
      <AnimatePresence mode="wait">
        {hasLocation ? (
          // Weather info badge
          <motion.div
            key="weather-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-black/70 backdrop-blur-xl border border-green-500/30 rounded-full px-4 py-2 shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <CloudIcon className="w-4 h-4 text-green-400" />
              <div className="text-xs text-white">
                <span className="font-mono">{weatherData?.temperature?.toFixed(0) || "22"}°C</span>
                <span className="text-white/60 ml-2">{weatherData?.windSpeed?.toFixed(1) || "3.2"}m/s</span>
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
          </motion.div>
        ) : (
          // Enable location badge
          <motion.button
            key="enable-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleQuickEnable}
            disabled={isLoading}
            className="bg-black/70 backdrop-blur-xl border border-blue-500/30 rounded-full px-4 py-2 shadow-lg hover:border-blue-500/50 transition-all group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center space-x-2">
              <motion.div
                animate={isLoading ? { rotate: 360 } : {}}
                transition={isLoading ? { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" } : {}}
              >
                <MapPinIcon className="w-4 h-4 text-blue-400" />
              </motion.div>
              <span className="text-xs text-white font-medium">
                {isLoading ? "Getting location..." : "Real weather"}
              </span>
              <div className="w-2 h-2 bg-blue-400 rounded-full group-hover:animate-pulse" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
