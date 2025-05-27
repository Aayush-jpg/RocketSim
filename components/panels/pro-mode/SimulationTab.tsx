import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface SimulationMetricCardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
}

function SimulationMetricCard({ label, value, icon, color }: SimulationMetricCardProps) {
  return (
    <motion.div 
      className="bg-slate-800 rounded-lg p-3"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>
        {value}
      </div>
    </motion.div>
  );
}

export default function SimulationTab() {
  const { sim, rocket, isSimulating, simulationProgress } = useRocket();
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);

  const runSimulation = async (fidelity: string) => {
    setIsRunningSimulation(true);
    
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

      if (!response.ok) {
        throw new Error(`Simulation failed: ${response.statusText}`);
      }

      const result = await response.json();
      useRocket.getState().setSim(result);
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('simulationComplete', { 
        detail: { result, fidelity } 
      }));
      
    } catch (error) {
      console.error('Simulation failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsRunningSimulation(false);
    }
  };

  if (!sim && !isRunningSimulation) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">🚀</div>
          <p>No simulation data available</p>
          <p className="text-sm mt-2">Run a simulation to see results</p>
        </div>
        
        {/* Simulation Controls */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Run Simulation</h4>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => runSimulation('standard')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              🚀 Standard Simulation
            </button>
            <button
              onClick={() => runSimulation('enhanced')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
            >
              ⚡ Enhanced 6-DOF
            </button>
            <button
              onClick={() => runSimulation('professional')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
            >
              🔬 Professional Grade
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isRunningSimulation) {
    return (
      <div className="space-y-4">
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold mb-3">Flight Performance</h3>
        <button
          onClick={() => runSimulation(sim?.simulationFidelity || 'standard')}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
        >
          🔄 Re-run
        </button>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <SimulationMetricCard 
          label="Max Altitude" 
          value={`${sim?.maxAltitude?.toFixed(1) || 'N/A'} m`}
          icon="🎯"
          color="text-green-400"
        />
        <SimulationMetricCard 
          label="Max Velocity" 
          value={`${sim?.maxVelocity?.toFixed(1) || 'N/A'} m/s`}
          icon="⚡"
          color="text-blue-400"
        />
        <SimulationMetricCard 
          label="Max Acceleration" 
          value={`${sim?.maxAcceleration?.toFixed(1) || 'N/A'} m/s²`}
          icon="🚀"
          color="text-red-400"
        />
        <SimulationMetricCard 
          label="Apogee Time" 
          value={`${sim?.apogeeTime?.toFixed(1) || 'N/A'} s`}
          icon="⏱️"
          color="text-yellow-400"
        />
      </div>

      {/* Stability Indicator */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Stability Margin</span>
          <span className={`text-sm font-semibold ${
            (sim?.stabilityMargin || 0) < 1 ? 'text-red-400' :
            (sim?.stabilityMargin || 0) > 3 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {sim?.stabilityMargin?.toFixed(2) || 'N/A'} cal
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              (sim?.stabilityMargin || 0) < 1 ? 'bg-red-500' :
              (sim?.stabilityMargin || 0) > 3 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min((sim?.stabilityMargin || 0) * 20, 100)}%` }}
          />
        </div>
      </div>

      {/* Advanced Metrics */}
      {sim?.simulationFidelity && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Simulation Details</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Fidelity:</span>
              <span className="text-blue-400 capitalize">{sim.simulationFidelity}</span>
            </div>
            {sim?.impactVelocity && (
              <div className="flex justify-between">
                <span>Impact Velocity:</span>
                <span className="text-yellow-400">{(sim.impactVelocity ?? 0).toFixed(1)} m/s</span>
              </div>
            )}
            {sim?.driftDistance && (
              <div className="flex justify-between">
                <span>Drift Distance:</span>
                <span className="text-purple-400">{(sim.driftDistance ?? 0).toFixed(1)} m</span>
              </div>
            )}
            {sim?.timestamp && (
              <div className="flex justify-between">
                <span>Timestamp:</span>
                <span className="text-slate-400">{new Date(sim.timestamp).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flight Events */}
      {sim?.flightEvents && sim.flightEvents.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Flight Events</div>
          <div className="space-y-1">
            {sim.flightEvents.map((event, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-slate-400">{event.name}</span>
                <span className="text-white">
                  {(event.time ?? 0).toFixed(1)}s @ {(event.altitude ?? 0).toFixed(1)}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thrust Curve Preview */}
      {sim?.thrustCurve && sim.thrustCurve.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Thrust Curve</div>
          <div className="h-20 bg-slate-700 rounded relative overflow-hidden">
            <svg className="w-full h-full">
              {sim?.thrustCurve.map((point, index) => {
                if (index === 0) return null;
                const prevPoint = sim.thrustCurve![index - 1];
                const maxTime = Math.max(...sim.thrustCurve!.map(p => p[0]));
                const maxThrust = Math.max(...sim.thrustCurve!.map(p => p[1]));
                
                const x1 = (prevPoint[0] / maxTime) * 100;
                const y1 = 100 - (prevPoint[1] / maxThrust) * 80;
                const x2 = (point[0] / maxTime) * 100;
                const y2 = 100 - (point[1] / maxThrust) * 80;
                
                return (
                  <line
                    key={index}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke="#3B82F6"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>0s</span>
            <span>Thrust vs Time</span>
            <span>{sim?.thrustCurve?.[sim.thrustCurve.length - 1]?.[0]?.toFixed(1) || '0.0'}s</span>
          </div>
        </div>
      )}
    </div>
  );
} 