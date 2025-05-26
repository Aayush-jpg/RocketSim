"use client"

import React, { useState, useEffect, useRef } from 'react'
import ChatPanel from '@/components/ChatPanel'
import { useRocket } from '@/lib/store'
import { estimateRocketMass, calculateStability } from '@/lib/ai/actions'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'

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

// Enhanced chat panel wrapper with metrics integration
function IntegratedChatPanel({ metrics, metricsExpanded, onToggleMetrics }: {
  metrics: any;
  metricsExpanded: boolean;
  onToggleMetrics: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Metrics summary that sits above chat */}
      <InlineMetricsSummary 
        metrics={metrics}
        isExpanded={metricsExpanded}
        onToggle={onToggleMetrics}
      />
      
      {/* Chat panel takes remaining space */}
      <div className="flex-1 min-h-0">
        <ChatPanel />
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

// Simulation Results Tab
function SimulationTab() {
  const { sim } = useRocket();

  if (!sim) {
    return (
      <div className="text-center text-slate-400 py-8">
        <div className="text-4xl mb-2">🚀</div>
        <p>No simulation data available</p>
        <p className="text-sm mt-2">Run a simulation to see results</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold mb-3">Flight Performance</h3>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <SimulationMetricCard 
          label="Max Altitude" 
          value={`${sim.maxAltitude.toFixed(1)} m`}
          icon="🎯"
          color="text-green-400"
        />
        <SimulationMetricCard 
          label="Max Velocity" 
          value={`${sim.maxVelocity.toFixed(1)} m/s`}
          icon="⚡"
          color="text-blue-400"
        />
        <SimulationMetricCard 
          label="Max Acceleration" 
          value={`${sim.maxAcceleration?.toFixed(1) || 'N/A'} m/s²`}
          icon="🚀"
          color="text-red-400"
        />
        <SimulationMetricCard 
          label="Apogee Time" 
          value={`${sim.apogeeTime.toFixed(1)} s`}
          icon="⏱️"
          color="text-yellow-400"
        />
      </div>

      {/* Stability Indicator */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Stability Margin</span>
          <span className={`text-sm font-semibold ${
            sim.stabilityMargin < 1 ? 'text-red-400' :
            sim.stabilityMargin > 3 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {sim.stabilityMargin.toFixed(2)} cal
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              sim.stabilityMargin < 1 ? 'bg-red-500' :
              sim.stabilityMargin > 3 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(sim.stabilityMargin * 20, 100)}%` }}
          />
        </div>
      </div>

      {/* Advanced Metrics */}
      {sim.simulationFidelity && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Simulation Details</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Fidelity:</span>
              <span className="text-blue-400 capitalize">{sim.simulationFidelity}</span>
            </div>
            {sim.impactVelocity && (
              <div className="flex justify-between">
                <span>Impact Velocity:</span>
                <span className="text-yellow-400">{sim.impactVelocity.toFixed(1)} m/s</span>
              </div>
            )}
            {sim.driftDistance && (
              <div className="flex justify-between">
                <span>Drift Distance:</span>
                <span className="text-purple-400">{sim.driftDistance.toFixed(1)} m</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flight Events */}
      {sim.flightEvents && sim.flightEvents.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Flight Events</div>
          <div className="space-y-1">
            {sim.flightEvents.map((event, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-slate-400">{event.name}</span>
                <span className="text-slate-300">
                  {event.time.toFixed(1)}s @ {event.altitude.toFixed(0)}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Trajectory Analysis Tab
function TrajectoryTab() {
  const { sim } = useRocket();
  const [viewMode, setViewMode] = useState('3d');

  if (!sim?.trajectory) {
    return (
      <div className="text-center text-slate-400 py-8">
        <div className="text-4xl mb-2">📈</div>
        <p>No trajectory data available</p>
        <p className="text-sm mt-2">Run a high-fidelity simulation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Trajectory Analysis</h3>
        <select 
          value={viewMode} 
          onChange={(e) => setViewMode(e.target.value)}
          className="bg-slate-700 text-white text-sm rounded px-2 py-1"
        >
          <option value="3d">3D View</option>
          <option value="altitude">Altitude vs Time</option>
          <option value="velocity">Velocity vs Time</option>
          <option value="acceleration">Acceleration vs Time</option>
        </select>
      </div>

      {viewMode === '3d' && (
        <div className="h-64 bg-slate-800 rounded-lg">
          <Canvas camera={{ position: [10, 10, 10] }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <OrbitControls />
            <TrajectoryPath trajectory={sim.trajectory} />
          </Canvas>
        </div>
      )}

      {viewMode !== '3d' && (
        <div className="h-64 bg-slate-800 rounded-lg p-3">
          <TrajectoryChart trajectory={sim.trajectory} mode={viewMode} />
        </div>
      )}

      {/* Trajectory Statistics */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Trajectory Statistics</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span>Flight Time:</span>
            <span className="text-blue-400">
              {sim.trajectory.time[sim.trajectory.time.length - 1]?.toFixed(1)}s
            </span>
          </div>
          <div className="flex justify-between">
            <span>Data Points:</span>
            <span className="text-green-400">{sim.trajectory.time.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Max Range:</span>
            <span className="text-purple-400">
              {Math.max(...sim.trajectory.position.map(p => Math.sqrt(p[0]**2 + p[1]**2))).toFixed(1)}m
            </span>
          </div>
          <div className="flex justify-between">
            <span>Resolution:</span>
            <span className="text-yellow-400">
              {(sim.trajectory.time[1] - sim.trajectory.time[0]).toFixed(3)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Monte Carlo Analysis Tab
function MonteCarloTab() {
  const { monteCarloResult } = useRocket();

  if (!monteCarloResult) {
    return (
      <div className="text-center text-slate-400 py-8">
        <div className="text-4xl mb-2">🎲</div>
        <p>No Monte Carlo data available</p>
        <p className="text-sm mt-2">Run a Monte Carlo analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold">Monte Carlo Analysis</h3>
      
      {/* Statistics */}
      {Object.entries(monteCarloResult.statistics).map(([metric, stats]) => (
        <div key={metric} className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2 capitalize">
            {metric.replace(/([A-Z])/g, ' $1').trim()}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Mean:</span>
              <span className="text-blue-400">{stats.mean.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Std Dev:</span>
              <span className="text-green-400">±{stats.std.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Min/Max:</span>
              <span className="text-red-400">
                {stats.min.toFixed(1)}/{stats.max.toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>95% Range:</span>
              <span className="text-purple-400">
                {stats.percentiles["5"].toFixed(1)}-{stats.percentiles["95"].toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Landing Dispersion */}
      {monteCarloResult.landingDispersion && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Landing Dispersion</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>CEP (50%):</span>
              <span className="text-blue-400">
                {monteCarloResult.landingDispersion.cep.toFixed(1)}m
              </span>
            </div>
            <div className="flex justify-between">
              <span>Mean Drift:</span>
              <span className="text-green-400">
                {monteCarloResult.landingDispersion.meanDrift.toFixed(1)}m
              </span>
            </div>
            <div className="flex justify-between">
              <span>Max Drift:</span>
              <span className="text-red-400">
                {monteCarloResult.landingDispersion.maxDrift.toFixed(1)}m
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stability Analysis Tab
function StabilityTab() {
  const { stabilityAnalysis } = useRocket();

  if (!stabilityAnalysis) {
    return (
      <div className="text-center text-slate-400 py-8">
        <div className="text-4xl mb-2">⚖️</div>
        <p>No stability analysis available</p>
        <p className="text-sm mt-2">Request stability analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold">Stability Analysis</h3>
      
      {/* Static Margin */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Static Margin</span>
          <span className={`text-lg font-bold ${
            stabilityAnalysis.staticMargin < 1 ? 'text-red-400' :
            stabilityAnalysis.staticMargin > 3 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {stabilityAnalysis.staticMargin.toFixed(2)} cal
          </span>
        </div>
        
        {/* Stability Bar */}
        <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
          <div 
            className={`h-3 rounded-full ${
              stabilityAnalysis.staticMargin < 1 ? 'bg-red-500' :
              stabilityAnalysis.staticMargin > 3 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(stabilityAnalysis.staticMargin * 20, 100)}%` }}
          />
        </div>
        
        {/* Reference lines */}
        <div className="flex justify-between text-xs text-slate-400">
          <span>0</span>
          <span>1.0 (min)</span>
          <span>3.0 (max)</span>
          <span>5.0+</span>
        </div>
      </div>

      {/* Recommendations */}
      {stabilityAnalysis.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Recommendations</div>
          <div className="space-y-1">
            {stabilityAnalysis.recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-slate-400 flex items-start">
                <span className="mr-2">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Motor Analysis Tab
function MotorTab() {
  const { motorAnalysis } = useRocket();

  if (!motorAnalysis) {
    return (
      <div className="text-center text-slate-400 py-8">
        <div className="text-4xl mb-2">🔥</div>
        <p>No motor analysis available</p>
        <p className="text-sm mt-2">Request motor analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold">Motor Performance</h3>
      
      {/* Motor Info */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">{motorAnalysis.motor.name}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Impulse Class:</span>
            <span className="text-blue-400">{motorAnalysis.impulseClass}</span>
          </div>
          <div className="flex justify-between">
            <span>Average Thrust:</span>
            <span className="text-green-400">{motorAnalysis.averageThrust.toFixed(1)}N</span>
          </div>
          <div className="flex justify-between">
            <span>Burn Time:</span>
            <span className="text-yellow-400">{motorAnalysis.burnTime.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span>Total Impulse:</span>
            <span className="text-purple-400">{motorAnalysis.totalImpulse.toFixed(0)}Ns</span>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Performance Metrics</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Thrust-to-Weight:</span>
            <span className={`${
              motorAnalysis.thrustToWeight < 5 ? 'text-red-400' :
              motorAnalysis.thrustToWeight > 15 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {motorAnalysis.thrustToWeight.toFixed(1)}:1
            </span>
          </div>
          <div className="flex justify-between">
            <span>Specific Impulse:</span>
            <span className="text-blue-400">{motorAnalysis.specificImpulse.toFixed(0)}s</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {motorAnalysis.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Recommendations</div>
          <div className="space-y-1">
            {motorAnalysis.recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-slate-400 flex items-start">
                <span className="mr-2">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Recovery Prediction Tab
function RecoveryTab() {
  const { recoveryPrediction } = useRocket();

  if (!recoveryPrediction) {
    return (
      <div className="text-center text-slate-400 py-8">
        <div className="text-4xl mb-2">🪂</div>
        <p>No recovery prediction available</p>
        <p className="text-sm mt-2">Request recovery analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold">Recovery Prediction</h3>
      
      {/* Recovery Metrics */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Descent Profile</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Deployment Alt:</span>
            <span className="text-blue-400">{recoveryPrediction.deploymentAltitude}m</span>
          </div>
          <div className="flex justify-between">
            <span>Terminal Velocity:</span>
            <span className="text-green-400">{recoveryPrediction.terminalVelocity.toFixed(1)}m/s</span>
          </div>
          <div className="flex justify-between">
            <span>Descent Time:</span>
            <span className="text-yellow-400">{recoveryPrediction.descentTime.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span>Drift Distance:</span>
            <span className="text-purple-400">{recoveryPrediction.driftDistance.toFixed(1)}m</span>
          </div>
          <div className="flex justify-between">
            <span>Landing Velocity:</span>
            <span className={`${
              recoveryPrediction.landingVelocity > 6 ? 'text-red-400' :
              recoveryPrediction.landingVelocity < 3 ? 'text-blue-400' : 'text-green-400'
            }`}>
              {recoveryPrediction.landingVelocity.toFixed(1)}m/s
            </span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recoveryPrediction.recommendations.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Recommendations</div>
          <div className="space-y-1">
            {recoveryPrediction.recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-slate-400 flex items-start">
                <span className="mr-2">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Environment Configuration Tab
function EnvironmentTab() {
  const { environment, setEnvironment } = useRocket();

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold">Environment Settings</h3>
      
      {/* Location */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Launch Location</div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Latitude (°)</label>
            <input
              type="number"
              step="0.1"
              value={environment.latitude}
              onChange={(e) => setEnvironment({...environment, latitude: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-700 text-white text-sm rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Longitude (°)</label>
            <input
              type="number"
              step="0.1"
              value={environment.longitude}
              onChange={(e) => setEnvironment({...environment, longitude: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-700 text-white text-sm rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Elevation (m)</label>
            <input
              type="number"
              step="1"
              value={environment.elevation}
              onChange={(e) => setEnvironment({...environment, elevation: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-700 text-white text-sm rounded px-2 py-1"
            />
          </div>
        </div>
      </div>

      {/* Weather */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Weather Conditions</div>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Wind Speed (m/s)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={environment.windSpeed}
              onChange={(e) => setEnvironment({...environment, windSpeed: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-700 text-white text-sm rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Wind Direction (°)</label>
            <input
              type="number"
              step="1"
              min="0"
              max="360"
              value={environment.windDirection}
              onChange={(e) => setEnvironment({...environment, windDirection: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-700 text-white text-sm rounded px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Atmospheric Model</label>
            <select
              value={environment.atmosphericModel}
              onChange={(e) => setEnvironment({...environment, atmosphericModel: e.target.value as any})}
              className="w-full bg-slate-700 text-white text-sm rounded px-2 py-1"
            >
              <option value="standard">Standard Atmosphere</option>
              <option value="forecast">Weather Forecast</option>
              <option value="custom">Custom Profile</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components (renamed to avoid conflicts)
function SimulationMetricCard({ label, value, icon, color }: { 
  label: string; 
  value: string; 
  icon: string; 
  color: string; 
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

// 3D Trajectory Component
function TrajectoryPath({ trajectory }: { trajectory: any }) {
  const points = trajectory.position.map((pos: number[]) => [pos[0], pos[2], -pos[1]]);
  
  return (
    <Line
      points={points}
      color="cyan"
      lineWidth={2}
    />
  );
}

// Trajectory Chart Component
function TrajectoryChart({ trajectory, mode }: { trajectory: any; mode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up drawing
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';

    // Get data based on mode
    let xData = trajectory.time;
    let yData: number[] = [];
    let label = '';

    switch (mode) {
      case 'altitude':
        yData = trajectory.position.map((pos: number[]) => pos[2]);
        label = 'Altitude (m)';
        break;
      case 'velocity':
        yData = trajectory.velocity.map((vel: number[]) => Math.sqrt(vel[0]**2 + vel[1]**2 + vel[2]**2));
        label = 'Velocity (m/s)';
        break;
      case 'acceleration':
        yData = trajectory.acceleration.map((acc: number[]) => Math.sqrt(acc[0]**2 + acc[1]**2 + acc[2]**2));
        label = 'Acceleration (m/s²)';
        break;
    }

    if (yData.length === 0) return;

    // Calculate bounds
    const xMin = Math.min(...xData);
    const xMax = Math.max(...xData);
    const yMin = Math.min(...yData);
    const yMax = Math.max(...yData);

    const margin = 40;
    const width = canvas.width - 2 * margin;
    const height = canvas.height - 2 * margin;

    // Draw axes
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, margin + height);
    ctx.lineTo(margin + width, margin + height);
    ctx.stroke();

    // Draw data
    ctx.beginPath();
    for (let i = 0; i < xData.length; i++) {
      const x = margin + (xData[i] - xMin) / (xMax - xMin) * width;
      const y = margin + height - (yData[i] - yMin) / (yMax - yMin) * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw labels
    ctx.fillText(`Time (s)`, margin + width/2, margin + height + 30);
    ctx.save();
    ctx.translate(15, margin + height/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText(label, 0, 0);
    ctx.restore();

    // Draw values
    ctx.fillText(xMin.toFixed(1), margin, margin + height + 15);
    ctx.fillText(xMax.toFixed(1), margin + width - 20, margin + height + 15);
    ctx.fillText(yMax.toFixed(1), 5, margin + 5);
    ctx.fillText(yMin.toFixed(1), 5, margin + height - 5);

  }, [trajectory, mode]);

  return <canvas ref={canvasRef} width={320} height={200} className="w-full h-full" />;
} 