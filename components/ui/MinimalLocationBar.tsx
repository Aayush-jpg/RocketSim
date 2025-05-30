"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPinIcon, CheckIcon } from "@heroicons/react/24/outline"
import { requestLocationPermission, getCurrentWeather } from "@/lib/services/weather"

export function MinimalLocationBar() {
  const [isVisible, setIsVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    // Hide if location is already enabled
    if (window.environmentConditions?.latitude) {
      setIsVisible(false)
    }

    // Listen for location updates
    const handleLocationUpdate = () => {
      setIsEnabled(true)
      setTimeout(() => setIsVisible(false), 1500)
    }

    window.addEventListener("realWeatherLoaded", handleLocationUpdate)
    return () => window.removeEventListener("realWeatherLoaded", handleLocationUpdate)
  }, [])

  const handleEnable = async () => {
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

      setIsEnabled(true)
      setTimeout(() => setIsVisible(false), 1500)

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

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      >
        <div className="flex justify-center pt-4">
          <motion.div
            className="pointer-events-auto bg-black/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-hidden"
            whileHover={{ scale: 1.02 }}
            layout
          >
            <div className="px-6 py-3">
              <AnimatePresence mode="wait">
                {isEnabled ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-center space-x-3"
                  >
                    <CheckIcon className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-white font-medium">Real weather enabled</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="prompt"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <motion.div
                        animate={isLoading ? { rotate: 360 } : {}}
                        transition={isLoading ? { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" } : {}}
                      >
                        <MapPinIcon className="w-4 h-4 text-blue-400" />
                      </motion.div>
                      <span className="text-sm text-white">Enable real weather for accurate simulations</span>
                    </div>

                    <motion.button
                      onClick={handleEnable}
                      disabled={isLoading}
                      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1 rounded-full transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isLoading ? "..." : "Enable"}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
