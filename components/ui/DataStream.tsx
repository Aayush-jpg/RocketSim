"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

interface DataPoint {
  id: string
  value: number
  timestamp: number
}

interface DataStreamProps {
  data: DataPoint[]
  color?: string
  height?: number
  animated?: boolean
  showGrid?: boolean
  className?: string
}

export function DataStream({
  data,
  color = "#3B82F6",
  height = 100,
  animated = true,
  showGrid = true,
  className,
}: DataStreamProps) {
  const [animatedData, setAnimatedData] = useState<DataPoint[]>([])

  useEffect(() => {
    if (animated) {
      setAnimatedData([])
      data.forEach((point, index) => {
        setTimeout(() => {
          setAnimatedData((prev) => [...prev, point])
        }, index * 100)
      })
    } else {
      setAnimatedData(data)
    }
  }, [data, animated])

  const maxValue = Math.max(...data.map((d) => d.value))
  const minValue = Math.min(...data.map((d) => d.value))
  const range = maxValue - minValue

  const getY = (value: number) => {
    return height - ((value - minValue) / range) * height
  }

  const pathData = animatedData
    .map((point, index) => {
      const x = (index / (data.length - 1)) * 300
      const y = getY(point.value)
      return `${index === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <div className={cn("relative", className)}>
      <svg width="100%" height={height} className="overflow-visible">
        {/* Grid lines */}
        {showGrid && (
          <g className="opacity-20">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
              <line
                key={index}
                x1="0"
                y1={height * ratio}
                x2="100%"
                y2={height * ratio}
                stroke="white"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            ))}
          </g>
        )}

        {/* Data line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          style={{
            filter: `drop-shadow(0 0 4px ${color}40)`,
          }}
        />

        {/* Glow effect */}
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut", delay: 0.1 }}
          style={{
            opacity: 0.3,
            filter: "blur(2px)",
          }}
        />

        {/* Data points */}
        {animatedData.map((point, index) => {
          const x = (index / (data.length - 1)) * 300
          const y = getY(point.value)

          return (
            <motion.circle
              key={point.id}
              cx={x}
              cy={y}
              r="3"
              fill={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.3,
                delay: index * 0.1 + 1,
                type: "spring",
                stiffness: 200,
              }}
              style={{
                filter: `drop-shadow(0 0 6px ${color}60)`,
              }}
            />
          )
        })}

        {/* Animated cursor */}
        {animatedData.length > 0 && (
          <motion.line
            x1={((animatedData.length - 1) / (data.length - 1)) * 300}
            y1="0"
            x2={((animatedData.length - 1) / (data.length - 1)) * 300}
            y2={height}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="4,4"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
              strokeDashoffset: [0, -8],
            }}
            transition={{
              opacity: { duration: 1, repeat: Number.POSITIVE_INFINITY },
              strokeDashoffset: { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" },
            }}
          />
        )}
      </svg>

      {/* Floating value indicator */}
      {animatedData.length > 0 && (
        <motion.div
          className="absolute top-0 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            left: `${((animatedData.length - 1) / (data.length - 1)) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {animatedData[animatedData.length - 1]?.value.toFixed(1)}
        </motion.div>
      )}
    </div>
  )
}
