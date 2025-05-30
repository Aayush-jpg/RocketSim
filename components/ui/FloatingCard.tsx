"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface FloatingCardProps {
  children: ReactNode
  className?: string
  depth?: "shallow" | "medium" | "deep"
  glow?: boolean
  magnetic?: boolean
  delay?: number
}

export function FloatingCard({
  children,
  className,
  depth = "medium",
  glow = false,
  magnetic = false,
  delay = 0,
}: FloatingCardProps) {
  const depthStyles = {
    shallow: "shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
    medium: "shadow-[0_16px_64px_rgba(0,0,0,0.4)]",
    deep: "shadow-[0_24px_96px_rgba(0,0,0,0.5)]",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay,
        type: "spring",
        stiffness: 100,
        damping: 15,
      }}
      whileHover={
        magnetic
          ? {
              scale: 1.02,
              y: -4,
              transition: { duration: 0.2 },
            }
          : undefined
      }
      className={cn(
        "relative backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-white/[0.08] to-white/[0.02]",
        depthStyles[depth],
        glow && "shadow-[0_0_40px_rgba(59,130,246,0.15)]",
        magnetic && "cursor-pointer transition-all duration-200",
        className,
      )}
    >
      {/* Ambient light effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      {/* Subtle border glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {children}
    </motion.div>
  )
}
