"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRocket } from '@/lib/store';
import { cn } from "@/lib/utils"

interface SimulationAnalysisProps {
  onClose?: () => void
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  color,
  delay = 0,
}: {
  label: string
  value: number
  unit: string
  icon: string
  color: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 hover:bg-slate-800/70 transition-all duration-300 border border-slate-700/50"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={cn("text-2xl font-bold font-mono", color)}>
        {value.toFixed(1)}
        {unit}
      </div>
    </motion.div>
  )
}

export default function SimulationTab({ onClose }: SimulationAnalysisProps = {}) {
  const { 
    sim, 
    rocket, 
    isSimulating, 
    simulationProgress, 
    simulationMessage,
    monteCarloResult,
    stabilityAnalysis,
    motorAnalysis,
    recoveryPrediction
  } = useRocket();
  const [selectedView, setSelectedView] = useState<"overview" | "detailed" | "events" | "analysis">("overview")
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);

  const runSimulation = async (fidelity: string) => {
    setIsRunningSimulation(true);
    
    // Reset progress
    useRocket.getState().setSimulationProgress(0);
    useRocket.getState().setSimulating(true);
    
    // For enhanced simulations, show incremental progress
    let progressInterval: NodeJS.Timeout | null = null;
    let isCancelled = false; // Track if simulation was cancelled
    
    // Cleanup function to ensure interval is always cleared
    const cleanupProgress = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    };
    
    // Set up cleanup on component unmount or navigation away
    const handleBeforeUnload = () => {
      isCancelled = true;
      cleanupProgress();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    if (fidelity === "enhanced" || fidelity === "professional") {
      let progress = 0;
      let stageMessage = "";
      const startTime = Date.now();
      
      // Professional mode stages
      const professionalStages = [
        { progress: 10, message: "Initializing flight computer..." },
        { progress: 25, message: "Computing aerodynamic properties..." },
        { progress: 40, message: "Analyzing stability derivatives..." },
        { progress: 55, message: "Simulating atmospheric conditions..." },
        { progress: 70, message: "Running trajectory optimization..." },
        { progress: 85, message: "Computing recovery system deployment..." },
        { progress: 95, message: "Finalizing flight analysis..." }
      ];
      
      let currentStageIndex = 0;
      let stageStartTime = startTime;
      
      // Set up progress interval with proper bounds checking
      progressInterval = setInterval(() => {
        // Early exit if cancelled
        if (isCancelled) {
          cleanupProgress();
          return;
        }
        
        const progressStep = fidelity === "professional" ? 0.8 : 1.2;
        const maxProgress = fidelity === "professional" ? 95 : 90;
        
        // For professional mode, use staged progress
        if (fidelity === "professional") {
          const now = Date.now();
          const elapsedTime = now - stageStartTime;
          
          // Move to next stage after certain time
          if (currentStageIndex < professionalStages.length && 
              elapsedTime > (currentStageIndex + 1) * 8000) { // ~8 seconds per stage
            currentStageIndex++;
            stageStartTime = now;
            
            if (currentStageIndex < professionalStages.length) {
              stageMessage = professionalStages[currentStageIndex].message;
              progress = professionalStages[currentStageIndex].progress;
            }
          } else if (currentStageIndex < professionalStages.length) {
            // Within a stage, progress smoothly
            const currentStage = professionalStages[currentStageIndex];
            const nextStage = professionalStages[Math.min(currentStageIndex + 1, professionalStages.length - 1)];
            const stageProgress = Math.min(elapsedTime / 8000, 1); // 8 seconds per stage
            
            progress = currentStage.progress + 
              (nextStage.progress - currentStage.progress) * stageProgress;
            
            stageMessage = currentStage.message;
          }
          
          // Store message for display (with null check)
          if (!isCancelled) {
            useRocket.getState().setSimulationMessage(stageMessage);
          }
        } else {
          // For enhanced, use simpler progression
          progress += (100 - progress) * progressStep;
        }
        
        // Update progress (with null check)
        if (!isCancelled) {
          useRocket.getState().setSimulationProgress(Math.min(maxProgress, progress));
        }
      }, 500);
    } else {
      // For standard simulation, set a fixed progress
      useRocket.getState().setSimulationProgress(50);
    }
    
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rocket,
          fidelity,
          environment: {
            latitude: 0,
            longitude: 0,
            elevation: 0,
            windSpeed: 0,
            windDirection: 0,
            atmosphericModel: "standard"
          },
          launchParameters: {
            railLength: 5.0,
            inclination: 85.0,
            heading: 0.0
          }
        }),
      });

      // Clear progress interval on response
      cleanupProgress();

      if (!response.ok) {
        throw new Error(`Simulation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Don't update state if cancelled
      if (!isCancelled) {
        // Complete progress
        useRocket.getState().setSimulationProgress(100);
        
        // Update state
        useRocket.getState().setSim(result);
        useRocket.getState().setLastSimulationType(fidelity);
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('simulationComplete', { 
          detail: { result, fidelity } 
        }));
      }
      
    } catch (error) {
      console.error('Simulation failed:', error);
      
      // Clear progress interval on error
      cleanupProgress();
      
      if (!isCancelled) {
        // Reset progress
        useRocket.getState().setSimulationProgress(0);
        
        // Show error notification
        window.dispatchEvent(new CustomEvent('notification', {
          detail: { 
            message: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
            type: 'error' 
          }
        }));
      }
    } finally {
      // Ensure cleanup happens in all cases
      cleanupProgress();
      
      // Remove event listener
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      
      // Only update state if not cancelled
      if (!isCancelled) {
        setIsRunningSimulation(false);
        useRocket.getState().setSimulating(false);
      }
      
      // Mark as cancelled to prevent any further updates
      isCancelled = true;
    }
  };

  // If no simulation data and not running, show simulation controls
  if (!sim && !isRunningSimulation) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Flight Simulation</h3>
              <p className="text-sm text-gray-400">Run a simulation to see results</p>
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
              <span className="text-2xl">🚀</span>
            </motion.div>
            
            <h3 className="text-lg font-medium text-white mb-2">
              No Simulation Data Available
            </h3>
            <p className="text-gray-400 text-sm">
              Run a simulation to analyze your rocket's performance and flight characteristics
            </p>
          </motion.div>

          {/* Simulation Options */}
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
              <h4 className="text-white font-medium">Simulation Models</h4>
            </div>
            
            <div className="space-y-4">
              {/* Standard Simulation */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                onClick={() => runSimulation('standard')}
                className="w-full group relative overflow-hidden rounded-xl p-4 glass-strong bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-white/10 hover:border-blue-400/30 transition-all duration-300 hover:bg-blue-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 border border-blue-400/30 rounded-lg flex items-center justify-center">
                      <span className="text-blue-400">🚀</span>
                    </div>
                    <div className="text-left">
                      <h5 className="text-white font-medium group-hover:text-blue-300 transition-colors">
                        Standard Simulation
                      </h5>
                      <p className="text-gray-400 text-xs">Basic trajectory analysis with 3-DOF physics</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.button>

              {/* Enhanced 6-DOF */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                onClick={() => runSimulation('enhanced')}
                className="w-full group relative overflow-hidden rounded-xl p-4 glass-strong bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-white/10 hover:border-purple-400/30 transition-all duration-300 hover:bg-purple-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500/20 border border-purple-400/30 rounded-lg flex items-center justify-center">
                      <span className="text-purple-400">⚡</span>
                    </div>
                    <div className="text-left">
                      <h5 className="text-white font-medium group-hover:text-purple-300 transition-colors">
                        Enhanced 6-DOF
                      </h5>
                      <p className="text-gray-400 text-xs">Advanced 6-degree-of-freedom simulation</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.button>

              {/* Professional Grade */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                onClick={() => runSimulation('professional')}
                className="w-full group relative overflow-hidden rounded-xl p-4 glass-strong bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-white/10 hover:border-green-400/30 transition-all duration-300 hover:bg-green-500/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 border border-green-400/30 rounded-lg flex items-center justify-center">
                      <span className="text-green-400">🔬</span>
                    </div>
                    <div className="text-left">
                      <h5 className="text-white font-medium group-hover:text-green-300 transition-colors">
                        Professional Grade
                      </h5>
                      <p className="text-gray-400 text-xs">High-fidelity simulation with Monte Carlo analysis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-400 bg-amber-400/20 px-2 py-1 rounded border border-amber-400/30">
                      Pro
                    </span>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-green-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.button>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-strong rounded-xl p-6 bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h4 className="text-sm font-medium text-white">Quick Actions</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left group"
              >
                <div className="text-xs text-gray-400 mb-1">Load Sample</div>
                <div className="text-white text-sm group-hover:text-blue-300 transition-colors">
                  📋 Example Rocket
                </div>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left group"
              >
                <div className="text-xs text-gray-400 mb-1">Reset All</div>
                <div className="text-white text-sm group-hover:text-red-300 transition-colors">
                  🔄 Clear Results
                </div>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // If simulation is running, show progress
  if (isRunningSimulation) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Flight Simulation</h3>
              <p className="text-sm text-gray-400">Running simulation...</p>
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
            <p>Running simulation...</p>
            <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${simulationProgress}%` }}
              />
            </div>
            <p className="text-xs mt-2">{Math.round(simulationProgress)}% complete</p>
            {useRocket.getState().lastSimulationType === 'professional' && (
              <p className="text-xs mt-2 text-yellow-400">
                Professional-grade simulations can take up to 5 minutes to complete.
              </p>
            )}
            {simulationMessage && (
              <p className="text-sm mt-3 text-blue-300">
                {simulationMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Calculate flight time from flight events or estimate
  const flightTime = sim?.flightEvents?.find(event => 
    event.name.toLowerCase().includes('landing') || 
    event.name.toLowerCase().includes('impact')
  )?.time || (sim?.apogeeTime ? sim.apogeeTime * 2 : 0);

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Flight Simulation</h3>
            <p className="text-sm text-gray-400">Comprehensive performance analysis</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => runSimulation(sim?.simulationFidelity || 'standard')}
              className="px-3 py-1.5 bg-slate-800/50 backdrop-blur-sm text-white rounded-lg text-sm hover:bg-slate-700/50 transition-colors border border-slate-700/50 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Re-run</span>
            </button>
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

        {/* View Selector */}
        <div className="flex space-x-1 mt-4 bg-black/20 rounded-lg p-1">
          {[
            { id: "overview", label: "Overview" },
            { id: "detailed", label: "Detailed" },
            { id: "events", label: "Events" },
            { id: "analysis", label: "Analysis" },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.id as any)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                selectedView === view.id ? "bg-white text-black" : "text-gray-400 hover:text-white hover:bg-white/5",
              )}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedView === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="Max Altitude"
                value={sim?.maxAltitude || 0}
                unit="m"
                icon="🎯"
                color="text-green-400"
                delay={0}
              />
              <MetricCard
                label="Max Velocity"
                value={sim?.maxVelocity || 0}
                unit="m/s"
                icon="⚡"
                color="text-blue-400"
                delay={0.1}
              />
              <MetricCard
                label="Max Acceleration"
                value={sim?.maxAcceleration || 0}
                unit="m/s²"
                icon="🚀"
                color="text-orange-400"
                delay={0.2}
              />
              <MetricCard
                label="Apogee Time"
                value={sim?.apogeeTime || 0}
                unit="s"
                icon="⏱️"
                color="text-purple-400"
                delay={0.3}
              />
            </div>

            {/* Stability Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-300">Stability Margin</span>
                <span className={`text-lg font-bold font-mono ${
                  (sim?.stabilityMargin || stabilityAnalysis?.staticMargin || stabilityAnalysis?.static_margin || 0) < 1 ? 'text-red-400' :
                  (sim?.stabilityMargin || stabilityAnalysis?.staticMargin || stabilityAnalysis?.static_margin || 0) > 3 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {(sim?.stabilityMargin || stabilityAnalysis?.staticMargin || stabilityAnalysis?.static_margin || 0).toFixed(1)} cal
                </span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <motion.div
                  className={`h-2 rounded-full ${
                    (sim?.stabilityMargin || stabilityAnalysis?.staticMargin || stabilityAnalysis?.static_margin || 0) < 1 ? 'bg-red-500' :
                    (sim?.stabilityMargin || stabilityAnalysis?.staticMargin || stabilityAnalysis?.static_margin || 0) > 3 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((sim?.stabilityMargin || stabilityAnalysis?.staticMargin || stabilityAnalysis?.static_margin || 0) * 30, 100)}%` }}
                  transition={{ duration: 1, delay: 0.6 }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0</span>
                <span>1.0 (min)</span>
                <span>3.0 (optimal)</span>
                <span>5.0+</span>
              </div>
            </motion.div>

            {/* Performance Rating */}
            {sim?.performanceRating && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Performance Rating</span>
                  <span className={`text-lg font-bold ${
                    sim.performanceRating === 'Excellent' ? 'text-green-400' :
                    sim.performanceRating === 'Good' ? 'text-blue-400' :
                    sim.performanceRating === 'Fair' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {sim.performanceRating}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Thrust Curve */}
            {sim?.thrustCurve && sim.thrustCurve.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <h4 className="text-sm font-medium text-white mb-4">Thrust Profile</h4>
                <div className="h-24 bg-black/30 rounded-lg relative overflow-hidden">
                  <svg className="w-full h-full">
                    {sim.thrustCurve.map((point, index) => {
                      if (index === 0) return null
                      const prevPoint = sim.thrustCurve![index - 1]
                      const maxTime = Math.max(...sim.thrustCurve!.map((p) => p[0]))
                      const maxThrust = Math.max(...sim.thrustCurve!.map((p) => p[1]))

                      const x1 = (prevPoint[0] / maxTime) * 100
                      const y1 = 100 - (prevPoint[1] / maxThrust) * 80
                      const x2 = (point[0] / maxTime) * 100
                      const y2 = 100 - (point[1] / maxThrust) * 80

                      return (
                        <motion.line
                          key={index}
                          x1={`${x1}%`}
                          y1={`${y1}%`}
                          x2={`${x2}%`}
                          y2={`${y2}%`}
                          stroke="#3B82F6"
                          strokeWidth="2"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                        />
                      )
                    })}
                  </svg>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>0s</span>
                  <span>Thrust vs Time</span>
                  <span>{sim.thrustCurve[sim.thrustCurve.length - 1]?.[0]?.toFixed(1) || '0.0'}s</span>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {selectedView === "detailed" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "Flight Time", value: flightTime, unit: "s", color: "text-cyan-400" },
                { label: "Impact Velocity", value: sim?.impactVelocity || 0, unit: "m/s", color: "text-yellow-400" },
                { label: "Drift Distance", value: sim?.driftDistance || 0, unit: "m", color: "text-pink-400" },
              ].map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">{metric.label}</span>
                    <span className={cn("text-lg font-bold font-mono", metric.color)}>
                      {metric.value.toFixed(1)}
                      {metric.unit}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Motor Analysis */}
            {motorAnalysis && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <div className="text-sm text-gray-300 mb-2">Motor Analysis</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Thrust-to-Weight:</span>
                    <span className="text-orange-400">{motorAnalysis.thrustToWeight?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Impulse:</span>
                    <span className="text-blue-400">{motorAnalysis.totalImpulse?.toFixed(1) || 'N/A'} N·s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Specific Impulse:</span>
                    <span className="text-green-400">{motorAnalysis.specificImpulse?.toFixed(0) || 'N/A'} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impulse Class:</span>
                    <span className="text-purple-400">{motorAnalysis.impulseClass || 'N/A'}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Recovery Prediction */}
            {recoveryPrediction && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <div className="text-sm text-gray-300 mb-2">Recovery Analysis</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Deployment Altitude:</span>
                    <span className="text-cyan-400">{recoveryPrediction.deploymentAltitude?.toFixed(0) || 'N/A'} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Terminal Velocity:</span>
                    <span className="text-yellow-400">{recoveryPrediction.terminalVelocity?.toFixed(1) || 'N/A'} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Descent Time:</span>
                    <span className="text-green-400">{recoveryPrediction.descentTime?.toFixed(1) || 'N/A'} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Landing Velocity:</span>
                    <span className="text-red-400">{recoveryPrediction.landingVelocity?.toFixed(1) || 'N/A'} m/s</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Additional simulation details */}
            {sim?.simulationFidelity && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <div className="text-sm text-gray-300 mb-2">Simulation Details</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Fidelity:</span>
                    <span className="text-blue-400 capitalize">{sim.simulationFidelity}</span>
                  </div>
                  {sim?.timestamp && (
                    <div className="flex justify-between">
                      <span>Timestamp:</span>
                      <span className="text-slate-400">{new Date(sim.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {selectedView === "events" && (
          <div className="space-y-3">
            {sim?.flightEvents && sim.flightEvents.length > 0 ? (
              sim.flightEvents.map((event, index) => (
                <motion.div
                  key={event.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          (event.name.toLowerCase().includes("liftoff") || event.name.toLowerCase().includes("ignition")) && "bg-green-400",
                          (event.name.toLowerCase().includes("burnout") || event.name.toLowerCase().includes("motor")) && "bg-orange-400",
                          event.name.toLowerCase().includes("apogee") && "bg-blue-400",
                          (event.name.toLowerCase().includes("parachute") || event.name.toLowerCase().includes("deploy")) && "bg-purple-400",
                          (event.name.toLowerCase().includes("landing") || event.name.toLowerCase().includes("impact")) && "bg-red-400",
                        )}
                      />
                      <span className="text-sm font-medium text-white">{event.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-gray-300">{(event.time || 0).toFixed(1)}s</div>
                      <div className="text-xs text-gray-500">{(event.altitude || 0).toFixed(0)}m</div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-8">
                <p>No flight events available</p>
                <p className="text-sm mt-2">Run an enhanced simulation to see detailed events</p>
              </div>
            )}
          </div>
        )}

        {selectedView === "analysis" && (
          <div className="space-y-4">
            {/* Stability Analysis */}
            {stabilityAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <h4 className="text-sm font-medium text-white mb-3">Stability Analysis</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Static Margin:</span>
                    <span className="text-green-400">{(stabilityAnalysis.staticMargin || stabilityAnalysis.static_margin || 0).toFixed(2)} cal</span>
                  </div>
                  {stabilityAnalysis.center_of_pressure && (
                    <div className="flex justify-between">
                      <span>Center of Pressure:</span>
                      <span className="text-blue-400">{stabilityAnalysis.center_of_pressure.toFixed(2)} m</span>
                    </div>
                  )}
                  {stabilityAnalysis.center_of_mass && (
                    <div className="flex justify-between">
                      <span>Center of Mass:</span>
                      <span className="text-orange-400">{stabilityAnalysis.center_of_mass.toFixed(2)} m</span>
                    </div>
                  )}
                  {(stabilityAnalysis.rating || stabilityAnalysis.stability_rating) && (
                    <div className="flex justify-between">
                      <span>Rating:</span>
                      <span className="text-purple-400">{stabilityAnalysis.rating || stabilityAnalysis.stability_rating}</span>
                    </div>
                  )}
                </div>
                {(stabilityAnalysis.recommendations || stabilityAnalysis.recommendation) && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="text-xs text-gray-300">
                      {Array.isArray(stabilityAnalysis.recommendations) 
                        ? stabilityAnalysis.recommendations.map((rec: string, i: number) => (
                            <div key={i} className="mb-1">{rec}</div>
                          ))
                        : <div>{stabilityAnalysis.recommendation}</div>
                      }
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Monte Carlo Summary */}
            {monteCarloResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <h4 className="text-sm font-medium text-white mb-3">Monte Carlo Analysis</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Iterations:</span>
                    <span className="text-blue-400">{monteCarloResult.iterations?.length || 0}</span>
                  </div>
                  {monteCarloResult.statistics?.maxAltitude && (
                    <>
                      <div className="flex justify-between">
                        <span>Mean Altitude:</span>
                        <span className="text-green-400">{monteCarloResult.statistics.maxAltitude.mean.toFixed(1)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Altitude Std Dev:</span>
                        <span className="text-yellow-400">±{monteCarloResult.statistics.maxAltitude.std.toFixed(1)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Altitude Range:</span>
                        <span className="text-cyan-400">
                          {monteCarloResult.statistics.maxAltitude.min.toFixed(0)} - {monteCarloResult.statistics.maxAltitude.max.toFixed(0)} m
                        </span>
                      </div>
                    </>
                  )}
                  {monteCarloResult.landingDispersion && (
                    <>
                      <div className="flex justify-between">
                        <span>Landing CEP:</span>
                        <span className="text-orange-400">{monteCarloResult.landingDispersion.cep.toFixed(1)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Drift:</span>
                        <span className="text-red-400">{monteCarloResult.landingDispersion.maxDrift.toFixed(1)} m</span>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* Performance Analysis */}
            {sim?.performanceAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <h4 className="text-sm font-medium text-white mb-3">Performance Analysis</h4>
                <div className="text-xs text-gray-300">
                  {typeof sim.performanceAnalysis === 'string' 
                    ? sim.performanceAnalysis 
                    : JSON.stringify(sim.performanceAnalysis, null, 2)
                  }
                </div>
              </motion.div>
            )}

            {/* Requirements Validation */}
            {sim?.requirementsValidation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
              >
                <h4 className="text-sm font-medium text-white mb-3">Requirements Validation</h4>
                <div className="text-xs text-gray-300">
                  {typeof sim.requirementsValidation === 'string' 
                    ? sim.requirementsValidation 
                    : JSON.stringify(sim.requirementsValidation, null, 2)
                  }
                </div>
              </motion.div>
            )}

            {/* No Analysis Data */}
            {!stabilityAnalysis && !monteCarloResult && !sim?.performanceAnalysis && !sim?.requirementsValidation && (
              <div className="text-center text-slate-400 py-8">
                <p>No analysis data available</p>
                <p className="text-sm mt-2">Run an enhanced or professional simulation to see detailed analysis</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 