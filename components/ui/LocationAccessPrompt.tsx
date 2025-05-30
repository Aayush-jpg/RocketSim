"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPinIcon, XMarkIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { requestLocationPermission, getCurrentWeather } from "@/lib/services/weather"

export function LocationAccessPrompt() {
  const [isVisible, setIsVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [hasLocationAccess, setHasLocationAccess] = useState(false)

  useEffect(() => {
    // Check if location is already enabled
    const checkLocationAccess = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {
            setHasLocationAccess(true)
            setIsVisible(false)
          },
          () => {
            setHasLocationAccess(false)
          },
          { timeout: 1000 },
        )
      }
    }

    checkLocationAccess()
  }, [])

  const handleEnableLocation = async () => {
    setIsLoading(true)
    try {
      const location = await requestLocationPermission()
      const weather = await getCurrentWeather(location)

      // Update global environment conditions
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

      setIsEnabled(true)
      setTimeout(() => setIsVisible(false), 2000)

      // Dispatch event for other components
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

  if (hasLocationAccess || !isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
        className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="relative">
          {/* Main prompt card */}
          <motion.div
            className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-green-500/10" />

            <div className="relative px-6 py-4">
              <div className="flex items-center space-x-4">
                {/* Icon */}
                <motion.div
                  className="flex-shrink-0"
                  animate={isLoading ? { rotate: 360 } : {}}
                  transition={isLoading ? { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" } : {}}
                >
                  {isEnabled ? (
                    <CheckCircleIcon className="w-6 h-6 text-green-400" />
                  ) : (
                    <MapPinIcon className="w-6 h-6 text-blue-400" />
                  )}
                </motion.div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {isEnabled ? "Real weather enabled!" : "Enable real weather"}
                      </p>
                      <p className="text-xs text-white/60">
                        {isEnabled ? "Using live atmospheric data" : "Get accurate atmospheric conditions"}
                      </p>
                    </div>

                    {/* Action button */}
                    {!isEnabled && (
                      <motion.button
                        onClick={handleEnableLocation}
                        disabled={isLoading}
                        className="flex-shrink-0 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {isLoading ? "..." : "Enable"}
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setIsVisible(false)}
                  className="flex-shrink-0 p-1 text-white/40 hover:text-white/80 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Loading bar */}
            {isLoading && (
              <motion.div
                className="absolute bottom-0 left-0 h-0.5 bg-blue-400"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 2 }}
              />
            )}
          </motion.div>

          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl -z-10 opacity-50" />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
