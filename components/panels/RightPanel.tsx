"use client"

import React, { useState, useEffect } from 'react'
import IntegratedChatPanel from '@/components/panels/IntegratedChatPanel'
import { useRocket } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getMotorOrDefault } from '@/lib/data/motors'

// Import analysis components
import SimulationTab from './pro-mode/SimulationTab'
import StabilityTab from './pro-mode/StabilityTab'
import MonteCarloTab from './pro-mode/MonteCarloTab'
import MotorTab from './pro-mode/MotorTab'
import TrajectoryTab from './pro-mode/TrajectoryTab'
import RecoveryTab from './pro-mode/RecoveryTab'
import PrintingTab from './pro-mode/PrintingTab'
import WeatherStatus from '@/components/WeatherStatus'
import VersionHistoryTab from './pro-mode/VersionHistoryTab'
import AtmosphericModelSelector from '@/components/AtmosphericModelSelector'

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
  { id: "3d-printing", label: "3D Printing", icon: "🖨️", description: "Export for printing" },
  { id: "environment", label: "Environment", icon: "🌍", description: "Weather conditions" },
  { id: "versions", label: "Versions", icon: "🕐", description: "Design history" },
];

export default function RightPanel({ onCollapse, isCollapsed, loadSessionId, onChatSessionLoad, projectId }: RightPanelProps) {
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  
  // Get rocket and simulation data from store
  const { sim: simData, rocket, environment, setEnvironment } = useRocket(state => ({
    sim: state.sim,
    rocket: state.rocket,
    environment: state.environment,
    setEnvironment: state.setEnvironment
  }));
  
  // Simple mass estimation from components
  const estimateRocketMass = (rocket: any): number => {
    let totalMass = 0.5; // Base mass
    
    // Count components and estimate mass
    if (rocket.nose_cone) totalMass += 0.1;
    totalMass += rocket.body_tubes.length * 0.2;
    totalMass += rocket.fins.length * 0.05;
    totalMass += rocket.parachutes.length * 0.03;
    
    return totalMass;
  };
  
  // Simple stability calculation
  const calculateStability = (rocket: any): number => {
    const finCount = rocket.fins.reduce((sum: number, fin: any) => sum + (fin.fin_count || 3), 0);
    return 1.0 + finCount * 0.3;
  };
  
  // Calculate mass using our estimation function
  const mass = estimateRocketMass(rocket);
  
  // Get motor data from centralized database
  const motorSpec = getMotorOrDefault(rocket.motor?.motor_database_id || 'default-motor');
  const motorThrust = motorSpec.avgThrust_N;
  const burnTime = motorSpec.burnTime_s;
  const motorIsp = motorSpec.isp_s;
  
  // Calculate thrust-to-weight ratio
  const thrustToWeight = motorThrust / (mass * 9.81);
  
  // Calculate total delta-V using the rocket equation
  const exhaustVelocity = motorIsp * 9.81; // m/s
  const totalMass = mass + motorSpec.mass.propellant_kg;
  const dryMass = mass + (motorSpec.mass.total_kg - motorSpec.mass.propellant_kg);
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
    dragCoefficient: 0.4, // Default drag coefficient
    apogee: simData?.maxAltitude || estimatedAltitude,
    burnTime: burnTime,
    thrustToWeight: thrustToWeight,
    deltaV: deltaV,
    recoveryTime: estimatedRecoveryTime,
    motorId: rocket.motor?.motor_database_id || 'default-motor',
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
    // Safety check for window object and proper cleanup
    if (typeof window === 'undefined') return;
    
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

    // Add event listeners with proper error handling
    try {
      window.addEventListener('trajectoryAnalysis', handleTrajectoryAnalysis as EventListener);
      window.addEventListener('monteCarloComplete', handleMonteCarloComplete as EventListener);
      window.addEventListener('stabilityAnalysis', handleStabilityAnalysis as EventListener);
      window.addEventListener('motorAnalysis', handleMotorAnalysis as EventListener);
      window.addEventListener('recoveryPrediction', handleRecoveryPrediction as EventListener);
      window.addEventListener('closeAnalysis', handleCloseAnalysis);
    } catch (error) {
      console.warn('Failed to add event listeners:', error);
    }

    // Cleanup function with safety checks
    return () => {
      if (typeof window === 'undefined') return;
      
      try {
        window.removeEventListener('trajectoryAnalysis', handleTrajectoryAnalysis as EventListener);
        window.removeEventListener('monteCarloComplete', handleMonteCarloComplete as EventListener);
        window.removeEventListener('stabilityAnalysis', handleStabilityAnalysis as EventListener);
        window.removeEventListener('motorAnalysis', handleMotorAnalysis as EventListener);
        window.removeEventListener('recoveryPrediction', handleRecoveryPrediction as EventListener);
        window.removeEventListener('closeAnalysis', handleCloseAnalysis);
      } catch (error) {
        console.warn('Failed to remove event listeners:', error);
      }
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
      case "3d-printing":
        return <PrintingTab />
      case "environment":
        return <EnvironmentTab environment={environment} setEnvironment={setEnvironment} />
      case "versions":
        return <VersionHistoryTab />
      default:
        return null
    }
  };

  // TODO: Replace with backend API calls for precise calculations
  const componentCount = (rocket.body_tubes?.length || 0) + (rocket.fins?.length || 0) + (rocket.parachutes?.length || 0) + 1 // +1 for nose cone
  const complexity = componentCount > 5 ? 'Advanced' : componentCount > 3 ? 'Intermediate' : 'Simple'

  // Handle collapsed state
  if (isCollapsed) {
    return (
      <div className="w-full h-full flex flex-col bg-black border-l border-white/10">
        {/* Collapsed Header - Larger clickable area for mobile */}
        <div className="p-2 border-b border-white/5">
          <button
            onClick={onCollapse}
            className="w-full h-16 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors group touch-manipulation"
            title="Expand AI Assistant"
          >
            <div className="flex flex-col items-center space-y-1">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="transform group-hover:scale-110 transition-transform"
              >
                <path d="M15 18l-6-6 6-6"></path>
              </svg>
              <div className="w-6 h-0.5 bg-white/60 rounded"></div>
            </div>
          </button>
        </div>
        
        {/* Vertical AI Icon */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="white" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4-4 4-4h12a2 2 0 0 1 2 2z"></path>
              <path d="M11 9l3 3-3 3"></path>
            </svg>
          </div>
          
          {/* Vertical Analysis Icons */}
          <div className="flex flex-col space-y-3">
            {analysisTypes.slice(0, 4).map((analysis, index) => (
              <div
                key={analysis.id}
                className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-sm opacity-60 border border-white/10"
                title={analysis.label}
              >
                {analysis.icon}
              </div>
            ))}
          </div>
          
          {/* Status Indicator */}
          <div className="flex flex-col items-center space-y-2">
            <div className={`w-3 h-3 rounded-full ${
              simData?.maxAltitude ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            } shadow-lg`} />
            <div className="text-xs text-gray-400 -rotate-90 whitespace-nowrap">
              {simData?.maxAltitude ? 'Active' : 'Ready'}
            </div>
          </div>
        </div>
        
        {/* Bottom visual indicator for expand */}
        <div className="p-2 flex justify-center">
          <div className="w-8 h-1 bg-white/20 rounded-full"></div>
        </div>
      </div>
    );
  }

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

import { EnvironmentConfig } from '@/types/rocket';

// ... (rest of the imports)

// ... (RightPanel component)

// Environment Tab Component
interface EnvironmentTabProps {
  environment: EnvironmentConfig;
  setEnvironment: (env: EnvironmentConfig) => void;
}

function EnvironmentTab({ environment, setEnvironment }: EnvironmentTabProps) {
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

      {/* Atmospheric Model Selector */}
      <AtmosphericModelSelector environment={environment} setEnvironment={setEnvironment} />
      
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
                {environment.atmospheric_model || 'Standard'}
              </p>
            </div>
            
            <div>
              <p className="text-gray-400">Data Source</p>
              <p className="font-medium text-white">
                {environment.atmospheric_model === 'forecast' ? 'Real-time' : 'Standard ISA'}
              </p>
            </div>
          </div>

          {/* Environment Quality Indicator */}
          <div className="bg-black/40 rounded-lg p-3 border border-gray-600/30">
            <h4 className="font-medium text-gray-100 mb-2">
              Simulation Accuracy
            </h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                environment.atmospheric_model === 'forecast' 
                  ? 'bg-green-400' 
                  : 'bg-yellow-400'
              }`} />
              <span className="text-sm text-gray-200">
                {environment.atmospheric_model === 'forecast' 
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
              environment.atmospheric_model === 'forecast' 
                ? 'bg-green-500' 
                : 'bg-gray-600'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${
                environment.atmospheric_model === 'forecast' 
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