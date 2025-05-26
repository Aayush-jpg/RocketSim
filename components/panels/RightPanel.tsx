"use client"

import React, { useState, useEffect, useRef } from 'react'
import ChatPanel from '@/components/ChatPanel'
import { useRocket } from '@/lib/store'
import { estimateRocketMass, calculateStability } from '@/lib/ai/actions'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import IntegratedChatPanel from './IntegratedChatPanel'
import SimulationTab from './pro-mode/SimulationTab'
import StabilityTab from './pro-mode/StabilityTab'
import MonteCarloTab from './pro-mode/MonteCarloTab'
import MotorTab from './pro-mode/MotorTab'
import TrajectoryTab from './pro-mode/TrajectoryTab'
import RecoveryTab from './pro-mode/RecoveryTab'
import WeatherStatus from '@/components/WeatherStatus'

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

type RightPanelProps = {
  onCollapse: () => void;
  isCollapsed: boolean;
}

// Intelligent metrics summary that appears inline with chat
function InlineMetricsSummary({ metrics, isExpanded, onToggle }: {
  metrics: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div 
      className="mx-3 mb-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-white/10 overflow-hidden"
      layout
    >
      {/* Always visible compact header */}
      <motion.div 
        className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
        layout
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-sm font-medium text-white">Flight Performance</span>
          </div>
          <div className="flex items-center space-x-4">
            {/* Key metrics always visible */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-blue-300">{formatNumber(metrics.apogee)}m</span>
              <span className="text-green-300">{formatNumber(metrics.thrust)}N</span>
              <span className="text-purple-300">{formatNumber(metrics.thrustToWeight)}T/W</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Expandable detailed metrics */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Performance grid */}
              <div className="grid grid-cols-3 gap-2">
                <MetricCard title="Apogee" value={metrics.apogee} unit="m" color="bg-blue-500/20" />
                <MetricCard title="Max Speed" value={metrics.velocity} unit="m/s" color="bg-green-500/20" />
                <MetricCard title="Thrust" value={metrics.thrust} unit="N" color="bg-orange-500/20" />
                <MetricCard title="Mass" value={metrics.mass} unit="kg" color="bg-purple-500/20" />
                <MetricCard title="T/W Ratio" value={metrics.thrustToWeight} unit="" color="bg-pink-500/20" />
                <MetricCard title="Stability" value={metrics.stability} unit="cal" color="bg-cyan-500/20" />
              </div>

              {/* Engine specs in compact form */}
              <div className="bg-black/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/70">Engine: {metrics.motorId}</span>
                  <span className="text-xs text-white/50">{MOTORS[metrics.motorId as keyof typeof MOTORS]?.type || 'solid'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60">Burn Time:</span>
                    <span className="text-white font-mono">{formatNumber(metrics.burnTime)}s</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60">Delta-V:</span>
                    <span className="text-white font-mono">{formatNumber(metrics.deltaV)}m/s</span>
                  </div>
                </div>
              </div>

              {/* Performance bars */}
              <div className="space-y-2">
                <PerformanceBar 
                  title="Altitude Performance" 
                  value={metrics.altitude} 
                  max={metrics.motorId?.includes('liquid') ? 50000 : 5000}
                  color="#3B82F6"
                />
                <PerformanceBar 
                  title="Thrust Efficiency" 
                  value={metrics.thrustToWeight} 
                  max={20}
                  color="#10B981"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Compact metric card component
function MetricCard({ title, value, unit, color }: {
  title: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg p-2 text-center`}>
      <div className="text-xs text-white/70 mb-1">{title}</div>
      <div className="text-sm font-mono text-white">
        {formatNumber(value)}<span className="text-xs ml-1 text-white/60">{unit}</span>
      </div>
    </div>
  );
}

// Performance bar component
function PerformanceBar({ title, value, max, color }: {
  title: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
        <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/70">{title}</span>
        <span className="text-white">{formatNumber(value)}</span>
        </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function RightPanel({ onCollapse, isCollapsed }: RightPanelProps) {
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [showProMode, setShowProMode] = useState(false);
  
  // Get rocket and simulation data from store
  const simData = useRocket(state => state.sim);
  const rocket = useRocket(state => state.rocket);
  
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

  const { 
    monteCarloResult, 
    stabilityAnalysis, 
    motorAnalysis, 
    recoveryPrediction,
    isSimulating,
    simulationProgress,
    lastSimulationType
  } = useRocket();
  
  const [activeTab, setActiveTab] = useState('simulation');
  const [trajectoryMode, setTrajectoryMode] = useState('3d');
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Event listeners for advanced simulation events
  useEffect(() => {
    const handleTrajectoryAnalysis = (event: CustomEvent) => {
      console.log('📈 Trajectory analysis event:', event.detail);
      setShowProMode(true);
      setActiveTab('trajectory');
    };

    const handleMonteCarloComplete = (event: CustomEvent) => {
      console.log('🎲 Monte Carlo complete:', event.detail);
      setShowProMode(true);
      setActiveTab('monte-carlo');
    };

    const handleStabilityAnalysis = (event: CustomEvent) => {
      console.log('⚖️ Stability analysis:', event.detail);
      setShowProMode(true);
      setActiveTab('stability');
    };

    const handleMotorAnalysis = (event: CustomEvent) => {
      console.log('🔥 Motor analysis:', event.detail);
      setShowProMode(true);
      setActiveTab('motor');
    };

    const handleRecoveryPrediction = (event: CustomEvent) => {
      console.log('🪂 Recovery prediction:', event.detail);
      setShowProMode(true);
      setActiveTab('recovery');
    };

    window.addEventListener('trajectoryAnalysis', handleTrajectoryAnalysis as EventListener);
    window.addEventListener('monteCarloComplete', handleMonteCarloComplete as EventListener);
    window.addEventListener('stabilityAnalysis', handleStabilityAnalysis as EventListener);
    window.addEventListener('motorAnalysis', handleMotorAnalysis as EventListener);
    window.addEventListener('recoveryPrediction', handleRecoveryPrediction as EventListener);

    return () => {
      window.removeEventListener('trajectoryAnalysis', handleTrajectoryAnalysis as EventListener);
      window.removeEventListener('monteCarloComplete', handleMonteCarloComplete as EventListener);
      window.removeEventListener('stabilityAnalysis', handleStabilityAnalysis as EventListener);
      window.removeEventListener('motorAnalysis', handleMotorAnalysis as EventListener);
      window.removeEventListener('recoveryPrediction', handleRecoveryPrediction as EventListener);
    };
  }, []);

  const tabs = [
    { id: 'simulation', label: '🚀 Simulation', icon: '📊' },
    { id: 'trajectory', label: '📈 Trajectory', icon: '🛤️' },
    { id: 'monte-carlo', label: '🎲 Monte Carlo', icon: '📈' },
    { id: 'stability', label: '⚖️ Stability', icon: '🎯' },
    { id: 'motor', label: '🔥 Motor', icon: '⚡' },
    { id: 'recovery', label: '🪂 Recovery', icon: '🎯' },
    { id: 'environment', label: '🌍 Environment', icon: '🌤️' }
  ];

  // Show Pro Mode (Advanced Analysis) or Chat Mode
  if (showProMode) {
    return (
      <div className="h-full bg-slate-900 border-l border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">Pro Mode - Advanced Analysis</h2>
            <button
              onClick={() => setShowProMode(false)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              💬 Back to Chat
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tab.icon}
              </button>
            ))}
          </div>

          {/* Simulation Status */}
          {isSimulating && (
            <div className="mb-3">
              <div className="flex justify-between text-sm text-slate-300 mb-1">
                <span>Simulating...</span>
                <span>{Math.round(simulationProgress)}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${simulationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'simulation' && <SimulationTab />}
          {activeTab === 'trajectory' && <TrajectoryTab />}
          {activeTab === 'monte-carlo' && <MonteCarloTab />}
          {activeTab === 'stability' && <StabilityTab />}
          {activeTab === 'motor' && <MotorTab />}
          {activeTab === 'recovery' && <RecoveryTab />}
          {activeTab === 'environment' && <EnvironmentTab />}
        </div>
      </div>
    );
  }

  // Default: Show Agentic Chat Interface
  return (
    <div className="h-full bg-slate-900 border-l border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">🤖 Rocket AI Assistant</h2>
          <button
            onClick={() => setShowProMode(true)}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            🔬 Pro Mode
          </button>
        </div>
        <p className="text-sm text-slate-400">Chat with AI to design, simulate, and optimize your rocket</p>
      </div>

      {/* Integrated Chat Panel with Metrics */}
      <div className="flex-1 min-h-0">
        <IntegratedChatPanel 
          metrics={metrics}
          metricsExpanded={metricsExpanded}
          onToggleMetrics={() => setMetricsExpanded(!metricsExpanded)}
        />
      </div>
    </div>
  );
}

// Placeholder components for tabs that haven't been created yet
function PerformanceTab() {
  return (
    <div className="text-center text-slate-400 py-8">
      <div className="text-4xl mb-2">📊</div>
      <p>Performance analysis coming soon</p>
    </div>
  );
}

function EnvironmentTab() {
  return (
    <div className="space-y-6">
      {/* Weather Status Component */}
      <WeatherStatus />
      
      {/* Environment Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🌍</span>
          Launch Environment
        </h3>
        
        <div className="space-y-4">
          {/* Current Environment Display */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Atmospheric Model</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {window.environmentConditions?.atmosphericModel || 'Standard'}
              </p>
            </div>
            
            <div>
              <p className="text-gray-500 dark:text-gray-400">Data Source</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {window.environmentConditions?.atmosphericModel === 'forecast' ? 'Real-time' : 'Standard ISA'}
              </p>
            </div>
          </div>

          {/* Environment Quality Indicator */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Simulation Accuracy
            </h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                window.environmentConditions?.atmosphericModel === 'forecast' 
                  ? 'bg-green-500' 
                  : 'bg-yellow-500'
              }`} />
              <span className="text-sm text-blue-800 dark:text-blue-200">
                {window.environmentConditions?.atmosphericModel === 'forecast' 
                  ? 'High accuracy with real atmospheric data'
                  : 'Standard accuracy with ISA model'
                }
              </span>
            </div>
          </div>

          {/* Launch Recommendations */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Launch Recommendations
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Check wind conditions before launch</li>
              <li>• Verify recovery system deployment altitude</li>
              <li>• Consider atmospheric density effects on drag</li>
              <li>• Monitor visibility for tracking</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Advanced Environment Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>⚙️</span>
          Advanced Settings
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Use real-time weather data</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${
              window.environmentConditions?.atmosphericModel === 'forecast' 
                ? 'bg-green-500' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${
                window.environmentConditions?.atmosphericModel === 'forecast' 
                  ? 'translate-x-5' 
                  : 'translate-x-1'
              }`} />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">High-resolution atmospheric model</span>
            <div className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full">
              <div className="w-4 h-4 bg-white rounded-full mt-1 translate-x-1" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Include turbulence effects</span>
            <div className="w-10 h-6 bg-gray-300 dark:bg-gray-600 rounded-full">
              <div className="w-4 h-4 bg-white rounded-full mt-1 translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 