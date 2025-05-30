"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface GlowButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
  glow?: boolean
  magnetic?: boolean
  className?: string
  disabled?: boolean
}

export function GlowButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  glow = true,
  magnetic = true,
  className,
  disabled = false,
}: GlowButtonProps) {
  const variants = {
    primary: "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    secondary: "bg-white/10 backdrop-blur-xl border border-white/20 text-white",
    ghost: "text-white hover:bg-white/10",
  }

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative rounded-xl font-medium transition-all duration-200 overflow-hidden",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        variants[variant],
        sizes[size],
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      whileHover={
        magnetic && !disabled
          ? {
              scale: 1.05,
              y: -2,
              transition: { duration: 0.2 },
            }
          : undefined
      }
      whileTap={
        !disabled
          ? {
              scale: 0.98,
              transition: { duration: 0.1 },
            }
          : undefined
      }
    >
      {/* Animated background gradient */}
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"
          animate={{
            backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          style={{
            backgroundSize: "200% 200%",
          }}
        />
      )}

      {/* Glow effect */}
      {glow && variant === "primary" && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-xl opacity-30 -z-10" />
      )}

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        initial={{ x: "-100%" }}
        whileHover={{
          x: "100%",
          transition: { duration: 0.6 },
        }}
      />

      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}
