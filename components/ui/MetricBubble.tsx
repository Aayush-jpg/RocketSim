"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MetricBubbleProps {
  value: number
  unit: string
  label: string
  color: string
  size?: "sm" | "md" | "lg"
  animated?: boolean
  delay?: number
}

export function MetricBubble({
  value,
  unit,
  label,
  color,
  size = "md",
  animated = true,
  delay = 0,
}: MetricBubbleProps) {
  const sizes = {
    sm: "w-16 h-16 text-xs",
    md: "w-20 h-20 text-sm",
    lg: "w-24 h-24 text-base",
  }

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: 0.5,
        delay,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 },
      }}
      className={cn(
        "relative rounded-full backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center cursor-pointer group",
        "bg-gradient-to-br from-white/10 to-white/5",
        "shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
        sizes[size],
      )}
    >
      {/* Floating particles effect */}
      {animated && (
        <>
          <motion.div
            className="absolute w-1 h-1 bg-white/40 rounded-full"
            animate={{
              y: [-10, -20, -10],
              x: [-5, 5, -5],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              delay: delay + 0.5,
            }}
          />
          <motion.div
            className="absolute w-0.5 h-0.5 bg-white/30 rounded-full"
            animate={{
              y: [-8, -16, -8],
              x: [3, -3, 3],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: delay + 1,
            }}
          />
        </>
      )}

      {/* Glow effect */}
      <div
        className={cn(
          "absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          `bg-gradient-to-br ${color.replace("text-", "from-")}/20 to-transparent`,
        )}
      />

      <motion.div
        className={cn("font-bold font-mono", color)}
        animate={
          animated
            ? {
                scale: [1, 1.05, 1],
              }
            : undefined
        }
        transition={
          animated
            ? {
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: delay + 0.2,
              }
            : undefined
        }
      >
        {value.toFixed(1)}
      </motion.div>
      <div className="text-xs text-white/60 font-medium">{unit}</div>
      <div className="absolute -bottom-6 text-xs text-white/40 whitespace-nowrap">{label}</div>
    </motion.div>
  )
}
