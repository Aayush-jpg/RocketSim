"use client"

import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StabilityAnalysisProps {
  onClose?: () => void
}

export default function StabilityTab({ onClose }: StabilityAnalysisProps = {}) {
  const { stabilityAnalysis, rocket } = useRocket();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState('comprehensive');

  const runStabilityAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze/stability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rocket,
          environment: {
            windSpeed: 0,
            windDirection: 0
          },
          analysisType
        }),
      });

      if (!response.ok) {
        throw new Error(`Stability analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      useRocket.getState().setStabilityAnalysis(result);
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('stabilityAnalysis', { 
        detail: { result } 
      }));
      
    } catch (error) {
      console.error('Stability analysis failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Stability analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStabilityColor = (margin: number) => {
    if (margin < 1) return "text-red-400"
    if (margin > 3) return "text-yellow-400"
    return "text-green-400"
  }

  const getStabilityBg = (margin: number) => {
    if (margin < 1) return "bg-red-500"
    if (margin > 3) return "bg-yellow-500"
    return "bg-green-500"
  }

  // Extract real data from stabilityAnalysis
  const staticMargin = stabilityAnalysis?.static_margin || stabilityAnalysis?.staticMargin || 0;
  const centerOfPressure = stabilityAnalysis?.center_of_pressure || 0;
  const centerOfMass = stabilityAnalysis?.center_of_mass || 0;
  const stabilityRating = stabilityAnalysis?.stability_rating || stabilityAnalysis?.rating || 'unknown';
  const recommendations = stabilityAnalysis?.recommendation ? [stabilityAnalysis.recommendation] : 
                         stabilityAnalysis?.recommendations || [];

  // If no stability data and not analyzing, show analysis controls
  if (!stabilityAnalysis && !isAnalyzing) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Stability Analysis</h3>
              <p className="text-sm text-gray-400">Center of pressure and mass analysis</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 bg-slate-800/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-slate-700/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Analysis Controls */}
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
              <span className="text-2xl">⚖️</span>
            </motion.div>
            
            <h3 className="text-lg font-medium text-white mb-2">
              No Stability Analysis Available
            </h3>
            <p className="text-gray-400 text-sm">
              Run stability analysis to evaluate rocket center of pressure and mass locations
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h4 className="text-white font-medium">Stability Analysis Options</h4>
            </div>
            
            <div className="space-y-4">
              {/* Analysis Type Selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="space-y-4"
              >
                <label className="block text-sm font-medium text-slate-300">
                  Analysis Type
                </label>
                <select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  className="w-full bg-slate-700/70 border border-white/10 text-white text-sm rounded-lg px-4 py-3 hover:bg-slate-700 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                >
                  <option value="comprehensive">Comprehensive Analysis • Complete stability evaluation</option>
                  <option value="static">Static Margin Only • Basic center of pressure analysis</option>
                  <option value="dynamic">Dynamic Stability • Advanced flight dynamics</option>
                </select>
                
                <div className="grid grid-cols-1 gap-3 mt-4">
                  {[
                    { 
                      value: 'comprehensive', 
                      title: 'Comprehensive Analysis', 
                      description: 'Complete stability evaluation including static margin, dynamic stability, and flight characteristics',
                      icon: '🎯',
                      color: 'text-green-400',
                      recommended: true
                    },
                    { 
                      value: 'static', 
                      title: 'Static Margin Only', 
                      description: 'Basic center of pressure vs center of mass analysis for passive stability',
                      icon: '📏',
                      color: 'text-blue-400'
                    },
                    { 
                      value: 'dynamic', 
                      title: 'Dynamic Stability', 
                      description: 'Advanced analysis including oscillation modes and damping characteristics',
                      icon: '🌊',
                      color: 'text-purple-400'
                    }
                  ].map((option, index) => (
                    <motion.div
                      key={option.value}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                      className={cn(
                        "p-4 rounded-lg border transition-all cursor-pointer relative",
                        analysisType === option.value 
                          ? "bg-slate-700/50 border-blue-500/50 ring-1 ring-blue-500/20" 
                          : "bg-slate-700/20 border-white/5 hover:bg-slate-700/30 hover:border-white/10"
                      )}
                      onClick={() => setAnalysisType(option.value)}
                    >
                      {option.recommended && (
                        <div className="absolute -top-2 -right-2">
                          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            Recommended
                          </span>
                        </div>
                      )}
                      <div className="flex items-start space-x-3">
                        <span className="text-xl">{option.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={cn("text-sm font-medium", option.color)}>{option.title}</span>
                            {analysisType === option.value && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{option.description}</p>
                        </div>
                      </div>
                    </motion.div>
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
                  onClick={runStabilityAnalysis}
                  className="w-full py-4 text-base font-semibold transition-all duration-300 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg shadow-lg hover:shadow-teal-500/25 flex items-center justify-center space-x-3"
                >
                  <span className="text-xl">🔍</span>
                  <span>Analyze Stability</span>
                  <span className="text-sm opacity-80">({analysisType})</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // If analyzing, show progress
  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Stability Analysis</h3>
              <p className="text-sm text-gray-400">Analyzing stability...</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 bg-slate-800/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-slate-700/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center text-slate-400 py-8">
            <div className="text-4xl mb-2">⏳</div>
            <p>Analyzing stability...</p>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
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
            <h3 className="text-xl font-semibold text-white">Stability Analysis</h3>
            <p className="text-sm text-gray-400">Center of pressure and mass analysis</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={runStabilityAnalysis}
              className="bg-slate-800/50 backdrop-blur-sm text-white rounded-lg text-sm hover:bg-slate-700/50 transition-colors border border-slate-700/50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Re-analyze
            </Button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 bg-slate-800/50 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-slate-700/50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Static Margin */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-300">Static Margin</span>
            <span className={cn("text-2xl font-bold font-mono", getStabilityColor(staticMargin))}>
              {staticMargin.toFixed(2)} cal
            </span>
          </div>

          <div className="w-full bg-black/30 rounded-full h-3 mb-3">
            <motion.div
              className={cn("h-3 rounded-full", getStabilityBg(staticMargin))}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(staticMargin * 20, 100)}%` }}
              transition={{ duration: 1, delay: 0.3 }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span>
            <span>1.0 (min)</span>
            <span>3.0 (max)</span>
            <span>5.0+</span>
          </div>
        </motion.div>

        {/* Stability Rating */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-300">Stability Rating</span>
            <span className={cn("text-lg font-semibold capitalize", getStabilityColor(staticMargin))}>
              {stabilityRating.replace('_', ' ')}
            </span>
          </div>

          <div className="text-xs text-gray-400">
            {stabilityRating === 'unstable' && 'Rocket may tumble or become uncontrollable'}
            {stabilityRating === 'marginally_stable' && 'Minimal stability, sensitive to disturbances'}
            {stabilityRating === 'stable' && 'Rocket exhibits good stability for normal flight conditions'}
            {stabilityRating === 'overstable' && 'Very stable but may reduce altitude performance'}
            {stabilityRating === 'unknown' && 'Stability rating not determined'}
          </div>
        </motion.div>

        {/* Center Analysis */}
        {(centerOfPressure > 0 || centerOfMass > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
          >
            <h4 className="text-sm font-medium text-white mb-4">Center Analysis</h4>
            <div className="space-y-4">
              {centerOfPressure > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Center of Pressure</span>
                  <span className="text-sm font-mono text-blue-400">{centerOfPressure.toFixed(2)} m</span>
                </div>
              )}
              {centerOfMass > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Center of Mass</span>
                  <span className="text-sm font-mono text-green-400">{centerOfMass.toFixed(2)} m</span>
                </div>
              )}
              {centerOfPressure > 0 && centerOfMass > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Separation</span>
                  <span className="text-sm font-mono text-purple-400">
                    {Math.abs(centerOfPressure - centerOfMass).toFixed(2)} m
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Analysis Details */}
        {stabilityAnalysis?.analysisType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
          >
            <h4 className="text-sm font-medium text-white mb-4">Analysis Details</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Type:</span>
                <span className="text-blue-400 capitalize">{stabilityAnalysis.analysisType}</span>
              </div>
              {stabilityAnalysis.flight_phase && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Flight Phase:</span>
                  <span className="text-green-400 capitalize">{stabilityAnalysis.flight_phase}</span>
                </div>
              )}
              {typeof stabilityAnalysis.includeStatic === 'boolean' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Static Analysis:</span>
                  <span className="text-cyan-400">{stabilityAnalysis.includeStatic ? 'Enabled' : 'Disabled'}</span>
                </div>
              )}
              {typeof stabilityAnalysis.includeDynamic === 'boolean' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Dynamic Analysis:</span>
                  <span className="text-purple-400">{stabilityAnalysis.includeDynamic ? 'Enabled' : 'Disabled'}</span>
                </div>
              )}
              {stabilityAnalysis.timestamp && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Timestamp:</span>
                  <span className="text-slate-400">{new Date(stabilityAnalysis.timestamp).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Wind Conditions */}
        {stabilityAnalysis?.windConditions && Object.keys(stabilityAnalysis.windConditions).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.27 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
          >
            <h4 className="text-sm font-medium text-white mb-4">Wind Conditions</h4>
            <div className="space-y-2 text-xs">
              {Object.entries(stabilityAnalysis.windConditions).map(([key, value], index) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400 capitalize">{key.replace('_', ' ')}:</span>
                  <span className="text-orange-400">{typeof value === 'number' ? value.toFixed(1) : value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
          >
            <h4 className="text-sm font-medium text-white mb-4">Analysis Results</h4>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 + index * 0.1 }}
                  className="flex items-start space-x-3"
                >
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-xs text-gray-300 leading-relaxed">{rec}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stability Guidelines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50"
        >
          <h4 className="text-sm font-medium text-white mb-4">Stability Guidelines</h4>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-start space-x-3">
              <span className="text-green-400">•</span>
              <span>Optimal stability margin: 1.0-2.0 calibers</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-400">•</span>
              <span>Center of pressure must be aft of center of mass</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-purple-400">•</span>
              <span>Increase fin area to move CP aft if needed</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
} 