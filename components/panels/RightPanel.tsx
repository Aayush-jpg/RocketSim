"use client"

import React, { useState, useEffect } from 'react'
import IntegratedChatPanel from '@/components/panels/IntegratedChatPanel'
import { useRocket } from '@/lib/store'
import { estimateRocketMass, calculateStability } from '@/lib/ai/actions'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// Import analysis components
import SimulationTab from './pro-mode/SimulationTab'
import StabilityTab from './pro-mode/StabilityTab'
import MonteCarloTab from './pro-mode/MonteCarloTab'
import MotorTab from './pro-mode/MotorTab'
import TrajectoryTab from './pro-mode/TrajectoryTab'
import RecoveryTab from './pro-mode/RecoveryTab'
import WeatherStatus from '@/components/WeatherStatus'
import VersionHistoryTab from './pro-mode/VersionHistoryTab'

// Enhanced motor database with more detailed properties
const MOTORS = {
  'mini-motor': {
    thrust: 15, // N
    burnTime: 1.8, // s
    isp: 180, // s
    type: 'solid',
    propellantMass: 0.010, // kg
    dryMass: 0.008, // kg
    totalImpulse: 27, // N·s
  },
  'default-motor': {
    thrust: 32, // N
    burnTime: 2.4, // s
    isp: 200, // s
    type: 'solid',
    propellantMass: 0.040, // kg
    dryMass: 0.015, // kg
    totalImpulse: 76.8, // N·s
  },
  'high-power': {
    thrust: 60, // N
    burnTime: 3.2, // s
    isp: 220, // s
    type: 'solid',
    propellantMass: 0.090, // kg
    dryMass: 0.025, // kg
    totalImpulse: 192, // N·s
  },
  'super-power': {
    thrust: 120, // N
    burnTime: 4.0, // s
    isp: 240, // s
    type: 'solid',
    propellantMass: 0.200, // kg
    dryMass: 0.050, // kg
    totalImpulse: 480, // N·s
  },
  'small-liquid': {
    thrust: 500, // N
    burnTime: 30, // s
    isp: 300, // s
    type: 'liquid',
    propellantMass: 1.5, // kg
    dryMass: 0.8, // kg
    totalImpulse: 15000, // N·s
    mixtureRatio: 2.1, // O/F ratio
  },
  'medium-liquid': {
    thrust: 2000, // N
    burnTime: 45, // s
    isp: 320, // s
    type: 'liquid',
    propellantMass: 6.5, // kg
    dryMass: 2.0, // kg
    totalImpulse: 90000, // N·s
    mixtureRatio: 2.3, // O/F ratio
  },
  'large-liquid': {
    thrust: 8000, // N
    burnTime: 15, // s - More realistic burn time
    isp: 280, // s - More realistic ISP for liquid propellant
    type: 'liquid',
    propellantMass: 8.0, // kg - Reduced propellant mass
    dryMass: 3.0, // kg - Adjusted dry mass
    totalImpulse: 120000, // N·s - Adjusted total impulse
    mixtureRatio: 2.4, // O/F ratio
  },
  'hybrid-engine': {
    thrust: 1200, // N
    burnTime: 20, // s
    isp: 280, // s
    type: 'hybrid',
    propellantMass: 4.5, // kg
    dryMass: 1.2, // kg
    totalImpulse: 24000, // N·s
  }
};

// Format numbers to prevent overflow
function formatNumber(value: number): string {
  return value.toFixed(value < 10 ? 2 : 1).replace(/\.?0+$/, '');
}

interface RightPanelProps {
  onCollapse: () => void;
  isCollapsed: boolean;
  loadSessionId?: string | null;
  onChatSessionLoad?: (sessionId: string | null) => void;
  projectId?: string | null;
}

const analysisTypes = [
  { id: "simulation", label: "Simulation", icon: "🚀", description: "Flight performance" },
  { id: "trajectory", label: "Trajectory", icon: "📈", description: "Flight path analysis" },
  { id: "stability", label: "Stability", icon: "⚖️", description: "Center of pressure analysis" },
  { id: "recovery", label: "Recovery", icon: "🪂", description: "Parachute deployment" },
  { id: "monte-carlo", label: "Monte Carlo", icon: "🎲", description: "Statistical analysis" },
  { id: "motor", label: "Motor", icon: "🔥", description: "Engine performance" },
  { id: "environment", label: "Environment", icon: "🌍", description: "Weather conditions" },
  { id: "versions", label: "Versions", icon: "🕐", description: "Design history" },
];

export default function RightPanel({ onCollapse, isCollapsed, loadSessionId, onChatSessionLoad, projectId }: RightPanelProps) {
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  
  // Get rocket and simulation data from store
  const simData = useRocket(state => state.sim);
  const rocket = useRocket(state => state.rocket);
  const { 
    monteCarloResult, 
    stabilityAnalysis, 
    motorAnalysis, 
    recoveryPrediction,
    isSimulating,
    simulationProgress,
    lastSimulationType
  } = useRocket();
  
  // Calculate mass using our estimation function
  const mass = estimateRocketMass(rocket);
  
  // Get motor data based on motorId
  const motorData = MOTORS[rocket.motorId as keyof typeof MOTORS] || MOTORS['default-motor'];
  const motorThrust = motorData.thrust;
  const burnTime = motorData.burnTime;
  const motorIsp = motorData.isp;
  
  // Calculate thrust-to-weight ratio
  const thrustToWeight = motorThrust / (mass * 9.81);
  
  // Calculate total delta-V using the rocket equation
  const exhaustVelocity = motorIsp * 9.81; // m/s
  const totalMass = mass + motorData.propellantMass;
  const dryMass = mass + motorData.dryMass;
  const deltaV = exhaustVelocity * Math.log(totalMass / dryMass);
  
  // Calculate estimated performance if no simulation data
  const estimatedAltitude = (deltaV * deltaV) / (2 * 9.81) * 0.7; // Rough estimate with efficiency factor
  const estimatedVelocity = deltaV * 0.8; // Rough estimate accounting for drag
  const estimatedRecoveryTime = (estimatedAltitude / 5) + 30; // Rough descent time estimate
  
  // Real metrics calculation - always use calculated values
  const metrics = {
    thrust: motorThrust,
    isp: motorIsp,
    mass: mass,
    altitude: simData?.maxAltitude || estimatedAltitude,
    velocity: simData?.maxVelocity || estimatedVelocity,
    stability: simData?.stabilityMargin || calculateStability(rocket),
    dragCoefficient: rocket.Cd,
    apogee: simData?.maxAltitude || estimatedAltitude,
    burnTime: burnTime,
    thrustToWeight: thrustToWeight,
    deltaV: deltaV,
    recoveryTime: estimatedRecoveryTime,
    motorId: rocket.motorId,
  };

  // Auto-expand metrics when simulation data changes
  useEffect(() => {
    if (simData?.maxAltitude && simData.maxAltitude > 0) {
      setMetricsExpanded(true);
      // Auto-collapse after 10 seconds to keep chat visible
      const timer = setTimeout(() => {
        setMetricsExpanded(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [simData?.maxAltitude]);
  
  // Event listeners for advanced simulation events
  useEffect(() => {
    const handleTrajectoryAnalysis = (event: CustomEvent) => {
      console.log('📈 Trajectory analysis event:', event.detail);
      setActiveAnalysis('trajectory');
    };

    const handleMonteCarloComplete = (event: CustomEvent) => {
      console.log('🎲 Monte Carlo complete:', event.detail);
      setActiveAnalysis('monte-carlo');
    };

    const handleStabilityAnalysis = (event: CustomEvent) => {
      console.log('⚖️ Stability analysis:', event.detail);
      setActiveAnalysis('stability');
    };

    const handleMotorAnalysis = (event: CustomEvent) => {
      console.log('🔥 Motor analysis:', event.detail);
      setActiveAnalysis('motor');
    };

    const handleRecoveryPrediction = (event: CustomEvent) => {
      console.log('🪂 Recovery prediction:', event.detail);
      setActiveAnalysis('recovery');
    };

    const handleCloseAnalysis = () => {
      setActiveAnalysis(null);
    };

    window.addEventListener('trajectoryAnalysis', handleTrajectoryAnalysis as EventListener);
    window.addEventListener('monteCarloComplete', handleMonteCarloComplete as EventListener);
    window.addEventListener('stabilityAnalysis', handleStabilityAnalysis as EventListener);
    window.addEventListener('motorAnalysis', handleMotorAnalysis as EventListener);
    window.addEventListener('recoveryPrediction', handleRecoveryPrediction as EventListener);
    window.addEventListener('closeAnalysis', handleCloseAnalysis);

    return () => {
      window.removeEventListener('trajectoryAnalysis', handleTrajectoryAnalysis as EventListener);
      window.removeEventListener('monteCarloComplete', handleMonteCarloComplete as EventListener);
      window.removeEventListener('stabilityAnalysis', handleStabilityAnalysis as EventListener);
      window.removeEventListener('motorAnalysis', handleMotorAnalysis as EventListener);
      window.removeEventListener('recoveryPrediction', handleRecoveryPrediction as EventListener);
      window.removeEventListener('closeAnalysis', handleCloseAnalysis);
    };
  }, []);

  const handleAnalysisClick = (analysisId: string) => {
    setActiveAnalysis(activeAnalysis === analysisId ? null : analysisId);
  };

  const renderAnalysisComponent = () => {
    switch (activeAnalysis) {
      case "simulation":
        return <SimulationTab />
      case "trajectory":
        return <TrajectoryTab />
      case "stability":
        return <StabilityTab />
      case "recovery":
        return <RecoveryTab />
      case "monte-carlo":
        return <MonteCarloTab />
      case "motor":
        return <MotorTab />
      case "environment":
        return <EnvironmentTab />
      case "versions":
        return <VersionHistoryTab />
      default:
        return null
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-black min-w-0">
      {/* Floating Analysis Tabs */}
      <div className="absolute top-6 right-0 z-20 pr-6">
        <div className="flex flex-col space-y-3">
          {analysisTypes.map((analysis, index) => (
            <motion.div
              key={analysis.id}
              className={cn(
                "group relative transition-all duration-300 ease-out",
                activeAnalysis === analysis.id ? "scale-110" : "hover:scale-105",
              )}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => handleAnalysisClick(analysis.id)}
                className={cn(
                  "w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center text-lg backdrop-blur-xl border shadow-lg relative overflow-hidden",
                  activeAnalysis === analysis.id
                    ? "bg-white text-black border-white/20 shadow-white/20"
                    : "bg-black/40 text-white border-white/10 hover:bg-white/10 hover:border-white/20",
                )}
              >
                <span className="relative z-10">{analysis.icon}</span>
                {activeAnalysis === analysis.id && (
                  <motion.div
                    className="absolute inset-0 bg-white"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </button>

              {/* Enhanced Tooltip */}
              <div className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-2 text-sm whitespace-nowrap">
                  <div className="font-medium text-white">{analysis.label}</div>
                  <div className="text-gray-400 text-xs">{analysis.description}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="p-6 border-b border-white/5 backdrop-blur-xl bg-black/50 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
              <p className="text-sm text-gray-400">Advanced rocket design intelligence</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Neural network active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Chat or Analysis */}
        <div className="flex-1 relative overflow-hidden w-full min-w-0 pr-20">
          {/* Chat View */}
          <div
            className={cn(
              "absolute inset-0 transition-all duration-500 ease-in-out w-full min-w-0",
              activeAnalysis ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0",
            )}
          >
            <IntegratedChatPanel 
              metrics={metrics}
              metricsExpanded={metricsExpanded}
              onToggleMetrics={() => setMetricsExpanded(!metricsExpanded)}
              activeAnalysis={activeAnalysis}
              onAnalysisClick={handleAnalysisClick}
              loadSessionId={loadSessionId}
              projectId={projectId}
            />
          </div>

          {/* Analysis Views */}
          <div
            className={cn(
              "absolute inset-0 transition-all duration-500 ease-in-out w-full min-w-0",
              activeAnalysis ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full",
            )}
          >
            <div className="w-full h-full min-w-0">
              {renderAnalysisComponent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Environment Tab Component
function EnvironmentTab() {
  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto w-full">
      {/* Close button */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Environment Analysis</h3>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('closeAnalysis'))}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Weather Status Component */}
      <WeatherStatus />
      
      {/* Environment Configuration */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <span>🌍</span>
          Launch Environment
        </h3>
        
        <div className="space-y-4">
          {/* Current Environment Display */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Atmospheric Model</p>
              <p className="font-medium text-white">
                {window.environmentConditions?.atmosphericModel || 'Standard'}
              </p>
            </div>
            
            <div>
              <p className="text-gray-400">Data Source</p>
              <p className="font-medium text-white">
                {window.environmentConditions?.atmosphericModel === 'forecast' ? 'Real-time' : 'Standard ISA'}
              </p>
            </div>
          </div>

          {/* Environment Quality Indicator */}
          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
            <h4 className="font-medium text-blue-100 mb-2">
              Simulation Accuracy
            </h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                window.environmentConditions?.atmosphericModel === 'forecast' 
                  ? 'bg-green-400' 
                  : 'bg-yellow-400'
              }`} />
              <span className="text-sm text-blue-200">
                {window.environmentConditions?.atmosphericModel === 'forecast' 
                  ? 'High accuracy with real atmospheric data'
                  : 'Standard accuracy with ISA model'
                }
              </span>
            </div>
          </div>

          {/* Launch Recommendations */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h4 className="font-medium text-white mb-2">
              Launch Recommendations
            </h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Check wind conditions before launch</li>
              <li>• Verify recovery system deployment altitude</li>
              <li>• Consider atmospheric density effects on drag</li>
              <li>• Monitor visibility for tracking</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Advanced Environment Settings */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <span>⚙️</span>
          Advanced Settings
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Use real-time weather data</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${
              window.environmentConditions?.atmosphericModel === 'forecast' 
                ? 'bg-green-500' 
                : 'bg-gray-600'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${
                window.environmentConditions?.atmosphericModel === 'forecast' 
                  ? 'translate-x-5' 
                  : 'translate-x-1'
              }`} />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">High-resolution atmospheric model</span>
            <div className="w-10 h-6 bg-gray-600 rounded-full">
              <div className="w-4 h-4 bg-white rounded-full mt-1 translate-x-1" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Include turbulence effects</span>
            <div className="w-10 h-6 bg-gray-600 rounded-full">
              <div className="w-4 h-4 bg-white rounded-full mt-1 translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}