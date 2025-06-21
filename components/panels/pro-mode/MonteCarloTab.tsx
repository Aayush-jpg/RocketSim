"use client"

import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatisticCardProps {
  label: string;
  statistic: {
    mean: number;
    std: number;
    min: number;
    max: number;
    percentiles: {
      "5": number;
      "25": number;
      "50": number;
      "75": number;
      "95": number;
    };
  };
  unit: string;
  color: string;
  delay?: number;
}

function StatisticCard({
  label,
  statistic,
  unit,
  color,
  delay = 0,
}: StatisticCardProps) {
  // Add null/undefined checks for all numeric values
  const safeMean = statistic?.mean ?? 0;
  const safeMin = statistic?.min ?? 0;
  const safeMax = statistic?.max ?? 0;
  const safeStd = statistic?.std ?? 0;
  const safePercentiles = {
    "5": statistic?.percentiles?.["5"] ?? 0,
    "25": statistic?.percentiles?.["25"] ?? 0,
    "50": statistic?.percentiles?.["50"] ?? 0,
    "75": statistic?.percentiles?.["75"] ?? 0,
    "95": statistic?.percentiles?.["95"] ?? 0,
  };

  // Check if we have valid data to display
  const hasValidData = statistic && 
    typeof statistic.mean === 'number' && 
    !isNaN(statistic.mean) &&
    typeof statistic.max === 'number' && 
    !isNaN(statistic.max) &&
    typeof statistic.min === 'number' && 
    !isNaN(statistic.min);

  if (!hasValidData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        className="glass-strong rounded-xl p-4 hover:bg-white/10 transition-all duration-300"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
          <span className="text-lg font-bold text-mono text-red-400">
            N/A{unit}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          Insufficient data for statistics
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-strong rounded-xl p-4 hover:bg-white/10 transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        <span className={cn("text-lg font-bold text-mono", color)}>
          {safeMean.toFixed(1)}
          {unit}
        </span>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-gray-500">Min</span>
          <span className="text-white font-mono">{safeMin.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Max</span>
          <span className="text-white font-mono">{safeMax.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Std Dev</span>
          <span className="text-white font-mono">±{safeStd.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Median</span>
          <span className="text-white font-mono">{safePercentiles["50"].toFixed(1)}</span>
        </div>
      </div>

      {/* Percentile Distribution - Box Plot Style */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>5%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>95%</span>
        </div>
        <div className="relative h-3 bg-black/30 rounded-sm overflow-hidden">
          {safeMax > safeMin && (
            <>
              {/* Full range line (5th to 95th percentile) */}
              <motion.div
                className="absolute top-1/2 h-0.5 bg-gray-400 transform -translate-y-1/2"
                initial={{ width: 0 }}
                animate={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["5"] - safeMin) / (safeMax - safeMin)) * 100))}%`,
                  width: `${Math.max(0, Math.min(100, ((safePercentiles["95"] - safePercentiles["5"]) / (safeMax - safeMin)) * 100))}%`,
                }}
                transition={{ duration: 1, delay: delay + 0.2 }}
              />
              
              {/* Interquartile range box (Q1 to Q3) */}
              <motion.div
                className="absolute h-3 bg-white/30 border border-white/40 rounded-sm"
                initial={{ width: 0 }}
                animate={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["25"] - safeMin) / (safeMax - safeMin)) * 100))}%`,
                  width: `${Math.max(0, Math.min(100, ((safePercentiles["75"] - safePercentiles["25"]) / (safeMax - safeMin)) * 100))}%`,
                }}
                transition={{ duration: 1, delay: delay + 0.4 }}
              />
              
              {/* Median line (Q2) */}
              <motion.div
                className="absolute w-0.5 h-3 bg-white shadow-sm"
                initial={{ left: 0 }}
                animate={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["50"] - safeMin) / (safeMax - safeMin)) * 100))}%`,
                }}
                transition={{ duration: 1, delay: delay + 0.6 }}
              />
              
              {/* Whisker caps at 5th and 95th percentiles */}
              <motion.div
                className="absolute w-0.5 h-2 bg-gray-400 top-0.5"
                initial={{ left: 0 }}
                animate={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["5"] - safeMin) / (safeMax - safeMin)) * 100))}%`,
                }}
                transition={{ duration: 1, delay: delay + 0.3 }}
              />
              <motion.div
                className="absolute w-0.5 h-2 bg-gray-400 top-0.5"
                initial={{ left: 0 }}
                animate={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["95"] - safeMin) / (safeMax - safeMin)) * 100))}%`,
                }}
                transition={{ duration: 1, delay: delay + 0.3 }}
              />
            </>
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>{safePercentiles["5"].toFixed(0)}</span>
          <span>{safePercentiles["25"].toFixed(0)}</span>
          <span>{safePercentiles["50"].toFixed(0)}</span>
          <span>{safePercentiles["75"].toFixed(0)}</span>
          <span>{safePercentiles["95"].toFixed(0)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function MonteCarloTab() {
  const { monteCarloResult, rocket, environment, launchParameters } = useRocket();
  const [isRunning, setIsRunning] = useState(false);
  const [iterations, setIterations] = useState(100);
  const [selectedVariations, setSelectedVariations] = useState([
    'environment.wind_speed_m_s',
    'rocket.Cd',
    'launch.inclination_deg'
  ]);

  const runMonteCarloAnalysis = async () => {
    setIsRunning(true);
    
    try {
      // Calculate drag coefficient using the same methods as RocketService
      const calculateNoseDrag = (nose: any): number => {
        const baseCoeff: { [key: string]: number } = {
          'ogive': 0.15,
          'conical': 0.18,
          'elliptical': 0.12,
          'parabolic': 0.14
        };
        return baseCoeff[nose.shape] || 0.15;
      };

      const calculateBodyDrag = (bodies: any[]): number => {
        return 0.02 * bodies.length;
      };

      const calculateFinDrag = (fins: any[]): number => {
        let totalDrag = 0;
        fins.forEach(fin => {
          const finArea = fin.root_chord_m * fin.span_m * fin.fin_count;
          totalDrag += 0.01 * finArea;
        });
        return totalDrag;
      };

      const calculateDragCoefficient = (rocket: any): number => {
        const noseDrag = calculateNoseDrag(rocket.nose_cone);
        const bodyDrag = calculateBodyDrag(rocket.body_tubes);
        const finDrag = calculateFinDrag(rocket.fins);
        
        return noseDrag + bodyDrag + finDrag;
      };
      
      const rocketCd = calculateDragCoefficient(rocket);
      
      const variations = [
        {
          parameter: "environment.wind_speed_m_s",
          distribution: "uniform",
          parameters: [0, 10]
        },
        {
          parameter: "rocket.Cd",
          distribution: "normal",
          parameters: [rocketCd, rocketCd * 0.1]
        },
        {
          parameter: "launch.inclination_deg",
          distribution: "normal",
          parameters: [85, 2]
        }
      ].filter(v => selectedVariations.includes(v.parameter));

      const response = await fetch('/api/simulate/monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rocket: { ...rocket, Cd: rocketCd },
          environment,
          launchParameters,
          variations,
          iterations
        }),
      });

      if (!response.ok) {
        throw new Error(`Monte Carlo analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      useRocket.getState().setMonteCarloResult(result);
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('monteCarloComplete', { 
        detail: { result } 
      }));
      
    } catch (error) {
      console.error('Monte Carlo analysis failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Monte Carlo analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsRunning(false);
    }
  };

  // Calculate reliability and success rate from our data
  const getReliabilityScore = () => {
    if (!monteCarloResult?.iterations || !monteCarloResult?.statistics) return 0;
    
    // Calculate reliability based on coefficient of variation (lower CV = higher reliability)
    // A good rocket should have low variability in key performance metrics
    const altitudeStats = monteCarloResult.statistics.maxAltitude;
    const velocityStats = monteCarloResult.statistics.maxVelocity;
    
    if (!altitudeStats || !velocityStats) return 0;
    
    // Add safety checks for valid numbers
    if (typeof altitudeStats.mean !== 'number' || typeof altitudeStats.std !== 'number' ||
        typeof velocityStats.mean !== 'number' || typeof velocityStats.std !== 'number' ||
        isNaN(altitudeStats.mean) || isNaN(altitudeStats.std) ||
        isNaN(velocityStats.mean) || isNaN(velocityStats.std) ||
        altitudeStats.mean <= 0 || velocityStats.mean <= 0) {
      return 0;
    }
    
    // Calculate coefficient of variation for altitude and velocity
    const altitudeCv = Math.abs(altitudeStats.std) / Math.abs(altitudeStats.mean);
    const velocityCv = Math.abs(velocityStats.std) / Math.abs(velocityStats.mean);
    
    // Average CV (lower is better)
    const avgCv = (altitudeCv + velocityCv) / 2;
    
    // Debug logging (remove in production)
    console.log('Reliability Debug:', {
      altitudeStats: { mean: altitudeStats.mean, std: altitudeStats.std },
      velocityStats: { mean: velocityStats.mean, std: velocityStats.std },
      altitudeCv,
      velocityCv,
      avgCv
    });
    
    // More realistic reliability scale for Monte Carlo rocket simulations:
    // For rockets, higher CV is more common due to environmental factors
    // CV < 0.20 (20%) = Excellent (85-100%) - Very consistent performance
    // CV < 0.40 (40%) = Very Good (70-85%) - Good consistency  
    // CV < 0.60 (60%) = Good (55-70%) - Acceptable variation
    // CV < 0.80 (80%) = Fair (40-55%) - High variation but usable
    // CV < 1.20 (120%) = Poor (25-40%) - Very high variation
    // CV >= 1.20 = Very Poor (0-25%) - Extreme variation
    
    let reliability;
    if (avgCv < 0.20) {
      reliability = 85 + (0.20 - avgCv) * 75; // 85-100%
    } else if (avgCv < 0.40) {
      reliability = 70 + (0.40 - avgCv) * 75; // 70-85%
    } else if (avgCv < 0.60) {
      reliability = 55 + (0.60 - avgCv) * 75; // 55-70%
    } else if (avgCv < 0.80) {
      reliability = 40 + (0.80 - avgCv) * 75; // 40-55%
    } else if (avgCv < 1.20) {
      reliability = 25 + (1.20 - avgCv) * 37.5; // 25-40%
    } else {
      reliability = Math.max(0, 25 - (avgCv - 1.20) * 20.8); // 0-25%
    }
    
    return Math.round(Math.min(100, Math.max(0, reliability)) * 10) / 10;
  };

  const getSuccessRate = () => {
    if (!monteCarloResult?.iterations) return 0;
    
    const totalIterations = monteCarloResult.iterations.length;
    if (totalIterations === 0) return 0;
    
    // Count successful iterations based on criteria:
    // 1. Altitude > 30m (reasonable minimum for model rocket)
    // 2. Stability margin > 1.0 caliber (if available)
    // 3. No simulation failures
    
    let successfulIterations = 0;
    
    monteCarloResult.iterations.forEach((iteration: any) => {
      let isSuccessful = true;
      
      // Check minimum altitude - use the correct property name from RocketPy
      if (iteration.apogee && iteration.apogee < 30) {
        isSuccessful = false;
      }
      
      // Check stability if available - use the correct property name
      if (iteration.initial_stability_margin && iteration.initial_stability_margin < 1.0) {
        isSuccessful = false;
      }
      
      // Check for simulation errors/failures
      if (iteration.error || iteration.failed) {
        isSuccessful = false;
      }
      
      if (isSuccessful) {
        successfulIterations++;
      }
    });
    
    const successRate = (successfulIterations / totalIterations) * 100;
    return Math.round(successRate * 10) / 10;
  };

  if (!monteCarloResult && !isRunning) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Monte Carlo Analysis</h3>
              <p className="text-sm text-gray-400">Statistical performance evaluation</p>
            </div>
          </div>
        </div>

        {/* Simulation Controls */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* No Data State */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-strong rounded-xl p-8 bg-slate-800/50 border border-white/5 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-slate-500/20 border border-slate-400/30 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-2xl">🎲</span>
            </motion.div>
            
            <h3 className="text-lg font-medium text-white mb-2">
              No Monte Carlo Data Available
            </h3>
            <p className="text-gray-400 text-sm">
              Run statistical analysis to evaluate rocket performance under varying conditions
            </p>
          </motion.div>

          {/* Analysis Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="text-white font-medium">Statistical Analysis Configuration</h4>
            </div>
            
            <div className="space-y-4">
              {/* Iterations Selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="space-y-3"
              >
                <label className="block text-sm font-medium text-slate-300">
                  Number of Iterations
                </label>
                <select
                  value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))}
                  className="w-full bg-slate-700/70 border border-white/10 text-white text-sm rounded-lg px-4 py-3 hover:bg-slate-700 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                >
                  <option value={50}>50 iterations • Fast analysis (~30s)</option>
                  <option value={100}>100 iterations • Standard analysis (~1m)</option>
                  <option value={250}>250 iterations • Detailed analysis (~2.5m)</option>
                  <option value={500}>500 iterations • Comprehensive analysis (~5m)</option>
                </select>
              </motion.div>

              {/* Parameter Variations */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="space-y-4"
              >
                <label className="block text-sm font-medium text-slate-300">
                  Parameter Variations
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { 
                      id: 'environment.wind_speed_m_s', 
                      label: 'Wind Speed Variation', 
                      description: 'Random wind speeds (0-10 m/s)',
                      icon: '💨',
                      color: 'text-blue-400'
                    },
                    { 
                      id: 'rocket.Cd', 
                      label: 'Drag Coefficient Uncertainty', 
                      description: 'Manufacturing tolerance (±10%)',
                      icon: '⚡',
                      color: 'text-orange-400'
                    },
                    { 
                      id: 'launch.inclination_deg', 
                      label: 'Launch Angle Variation', 
                      description: 'Launch setup precision (85° ±2°)',
                      icon: '🎯',
                      color: 'text-green-400'
                    }
                  ].map((param, index) => (
                    <motion.label 
                      key={param.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                      className="flex items-start space-x-4 p-4 rounded-lg bg-slate-700/30 border border-white/5 hover:bg-slate-700/50 transition-all cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedVariations.includes(param.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVariations([...selectedVariations, param.id]);
                          } else {
                            setSelectedVariations(selectedVariations.filter(v => v !== param.id));
                          }
                        }}
                        className="mt-1 w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-lg group-hover:scale-110 transition-transform">{param.icon}</span>
                          <span className={cn("text-sm font-medium", param.color)}>{param.label}</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{param.description}</p>
                      </div>
                    </motion.label>
                  ))}
                </div>
              </motion.div>

              {/* Run Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.7 }}
                className="pt-4"
              >
                <button
                  onClick={runMonteCarloAnalysis}
                  disabled={selectedVariations.length === 0}
                  className={cn(
                    "w-full py-4 text-base font-semibold transition-all duration-300 rounded-lg",
                    selectedVariations.length === 0 
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
                      : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-teal-500/25"
                  )}
                >
                  <span className="mr-3 text-xl">🎲</span>
                  Run Monte Carlo Analysis
                  <span className="ml-2 text-sm opacity-80">({iterations} iterations)</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Monte Carlo Analysis</h3>
              <p className="text-sm text-gray-400">Running statistical analysis...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 py-8">
            <div className="text-4xl mb-2">⏳</div>
            <p>Running Monte Carlo analysis...</p>
            <p className="text-sm mt-2">{iterations} iterations</p>
            <div className="w-full max-w-xs bg-slate-700 rounded-full h-2 mt-4">
              <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Monte Carlo Analysis</h3>
            <p className="text-sm text-gray-400">Statistical performance evaluation</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="secondary" size="sm" onClick={runMonteCarloAnalysis}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Re-run
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Analysis Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-white">Analysis Overview</h4>
            <span className="text-xs text-gray-400">{monteCarloResult?.iterations?.length || 0} iterations</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Reliability Score</span>
                <span className="text-green-400 font-bold">{getReliabilityScore()}%</span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <motion.div
                  className="bg-green-400 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${getReliabilityScore()}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Success Rate</span>
                <span className="text-blue-400 font-bold">{getSuccessRate()}%</span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <motion.div
                  className="bg-blue-400 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${getSuccessRate()}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Statistical Results */}
        <div className="space-y-4">
          {monteCarloResult?.statistics?.maxAltitude && (
            <StatisticCard
              label="Maximum Altitude"
              statistic={monteCarloResult.statistics.maxAltitude}
              unit="m"
              color="text-green-400"
              delay={0.1}
            />
          )}
          {monteCarloResult?.statistics?.maxVelocity && (
            <StatisticCard
              label="Maximum Velocity"
              statistic={monteCarloResult.statistics.maxVelocity}
              unit="m/s"
              color="text-blue-400"
              delay={0.2}
            />
          )}
          {monteCarloResult?.statistics?.apogeeTime && (
            <StatisticCard
              label="Apogee Time"
              statistic={monteCarloResult.statistics.apogeeTime}
              unit="s"
              color="text-purple-400"
              delay={0.3}
            />
          )}
          {monteCarloResult?.statistics?.stabilityMargin && (
            <StatisticCard
              label="Stability Margin"
              statistic={monteCarloResult.statistics.stabilityMargin}
              unit=" cal"
              color="text-yellow-400"
              delay={0.4}
            />
          )}
        </div>

        {/* Confidence Intervals */}
        {monteCarloResult?.statistics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="glass-strong rounded-xl p-6"
          >
            <h4 className="text-sm font-medium text-white mb-4">Confidence Intervals</h4>
            <div className="space-y-3 text-xs">
              {monteCarloResult.statistics.maxAltitude && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">90% Confidence (Altitude)</span>
                  <span className="text-green-400 font-mono">
                    {(monteCarloResult.statistics.maxAltitude.percentiles?.["5"] ?? 0).toFixed(0)}m -{" "}
                    {(monteCarloResult.statistics.maxAltitude.percentiles?.["95"] ?? 0).toFixed(0)}m
                  </span>
                </div>
              )}
              {monteCarloResult.statistics.maxVelocity && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">90% Confidence (Velocity)</span>
                  <span className="text-blue-400 font-mono">
                    {(monteCarloResult.statistics.maxVelocity.percentiles?.["5"] ?? 0).toFixed(1)}m/s -{" "}
                    {(monteCarloResult.statistics.maxVelocity.percentiles?.["95"] ?? 0).toFixed(1)}m/s
                  </span>
                </div>
              )}
              {monteCarloResult.statistics.apogeeTime && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">90% Confidence (Time)</span>
                  <span className="text-purple-400 font-mono">
                    {(monteCarloResult.statistics.apogeeTime.percentiles?.["5"] ?? 0).toFixed(1)}s -{" "}
                    {(monteCarloResult.statistics.apogeeTime.percentiles?.["95"] ?? 0).toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Risk Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="glass-strong rounded-xl p-6"
        >
          <h4 className="text-sm font-medium text-white mb-4">Risk Assessment</h4>
          <div className="space-y-3">
            {monteCarloResult?.statistics?.maxAltitude && 
             typeof monteCarloResult.statistics.maxAltitude.std === 'number' && 
             typeof monteCarloResult.statistics.maxAltitude.mean === 'number' && (
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                <span className="text-xs text-gray-300">
                  Altitude varies by ±{monteCarloResult.statistics.maxAltitude.std.toFixed(0)}m 
                  ({((monteCarloResult.statistics.maxAltitude.std / monteCarloResult.statistics.maxAltitude.mean) * 100).toFixed(1)}% coefficient of variation)
                </span>
              </div>
            )}
            {monteCarloResult?.landingDispersion && 
             typeof monteCarloResult.landingDispersion.cep === 'number' && 
             monteCarloResult.landingDispersion.cep > 50 && (
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 flex-shrink-0" />
                <span className="text-xs text-gray-300">Large landing dispersion - consider dual-deploy recovery system</span>
              </div>
            )}
            {monteCarloResult?.statistics?.stabilityMargin && 
             typeof monteCarloResult.statistics.stabilityMargin.min === 'number' && 
             monteCarloResult.statistics.stabilityMargin.min < 1.0 && (
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                <span className="text-xs text-gray-300">Some iterations show marginal stability - increase fin area</span>
              </div>
            )}
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-xs text-gray-300">{getSuccessRate()}% of simulations achieved target performance criteria</span>
            </div>
          </div>
        </motion.div>

        {/* Landing Dispersion */}
        {monteCarloResult?.landingDispersion && (
          <motion.div 
            className="glass-strong rounded-xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <div className="text-sm text-white font-medium mb-4">Landing Dispersion</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">CEP (50%):</span>
                <span className="text-orange-400 font-mono">{(monteCarloResult.landingDispersion.cep ?? 0).toFixed(1)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Drift:</span>
                <span className="text-red-400 font-mono">{(monteCarloResult.landingDispersion.maxDrift ?? 0).toFixed(1)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mean Drift:</span>
                <span className="text-blue-400 font-mono">{(monteCarloResult.landingDispersion.meanDrift ?? 0).toFixed(1)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ellipse Ratio:</span>
                <span className="text-green-400 font-mono">{
                  (monteCarloResult.landingDispersion.majorAxis && monteCarloResult.landingDispersion.minorAxis && monteCarloResult.landingDispersion.minorAxis !== 0) 
                    ? (monteCarloResult.landingDispersion.majorAxis / monteCarloResult.landingDispersion.minorAxis).toFixed(1) 
                    : '1.0'
                }:1</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 