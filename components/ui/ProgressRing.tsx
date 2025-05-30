"use client"

import type React from "react"

import { motion } from "framer-motion"

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  animated?: boolean
  delay?: number
  children?: React.ReactNode
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  color = "#3B82F6",
  backgroundColor = "rgba(255,255,255,0.1)",
  animated = true,
  delay = 0,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={animated ? { strokeDashoffset } : undefined}
          transition={
            animated
              ? {
                  duration: 1.5,
                  delay,
                  ease: "easeInOut",
                }
              : undefined
          }
          style={{
            filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.4))",
            strokeDashoffset: animated ? undefined : strokeDashoffset,
          }}
        />

        {/* Glow effect */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth / 2}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={animated ? { strokeDashoffset } : undefined}
          transition={
            animated
              ? {
                  duration: 1.5,
                  delay: delay + 0.1,
                  ease: "easeInOut",
                }
              : undefined
          }
          style={{
            opacity: 0.3,
            filter: "blur(2px)",
            strokeDashoffset: animated ? undefined : strokeDashoffset,
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
