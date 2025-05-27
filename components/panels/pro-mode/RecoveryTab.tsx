import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface RecoveryMetricProps {
  label: string;
  value: number;
  unit: string;
  color: string;
  warning?: boolean;
}

function RecoveryMetric({ label, value, unit, color, warning }: RecoveryMetricProps) {
  return (
    <div className={`flex justify-between items-center py-1 px-2 rounded ${warning ? 'bg-yellow-600/10 border border-yellow-600/30' : ''}`}>
      <span className="text-slate-400 text-xs">{label}:</span>
      <span className={`text-sm font-mono ${color}`}>
        {(value ?? 0).toFixed(1)}{unit}
        {warning && <span className="ml-1 text-yellow-400">⚠</span>}
      </span>
    </div>
  );
}

export default function RecoveryTab() {
  const { recoveryPrediction, sim, rocket } = useRocket();
  const [parachuteDiameter, setParachuteDiameter] = useState(30); // cm
  const [deploymentAltitude, setDeploymentAltitude] = useState(150); // m
  const [deploymentDelay, setDeploymentDelay] = useState(2); // s
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Calculate recovery metrics based on current rocket and simulation data
  const calculateRecoveryMetrics = () => {
    if (!sim?.maxAltitude) return null;

    // Estimate rocket mass
    let rocketMass = 0.5; // Base mass in kg
    rocket.parts.forEach((part: any) => {
      switch (part.type) {
        case 'nose':
          rocketMass += 0.05 * (part.length / 10);
          break;
        case 'body':
          rocketMass += 0.1 * (part.length / 10) * part.Ø;
          break;
        case 'fin':
          rocketMass += 0.01 * part.root * part.span;
          break;
      }
    });

    // Parachute calculations
    const parachuteArea = Math.PI * (parachuteDiameter / 100 / 2) ** 2; // m²
    const parachuteCd = 1.3; // Typical drag coefficient for parachute
    const airDensity = 1.225; // kg/m³ at sea level

    // Terminal velocity calculation: v = sqrt(2mg / (ρ * Cd * A))
    const terminalVelocity = Math.sqrt((2 * rocketMass * 9.81) / (airDensity * parachuteCd * parachuteArea));

    // Descent calculations
    const apogeeAltitude = sim.maxAltitude;
    const descentDistance = Math.max(0, apogeeAltitude - deploymentAltitude);
    const freefall = descentDistance > 0;
    
    // Free fall time (if any)
    const freefallTime = freefall ? Math.sqrt(2 * descentDistance / 9.81) : 0;
    const freefallVelocity = freefall ? Math.sqrt(2 * 9.81 * descentDistance) : 0;
    
    // Parachute descent time
    const parachuteDescentTime = deploymentAltitude / terminalVelocity;
    
    // Total descent time
    const totalDescentTime = freefallTime + parachuteDescentTime + deploymentDelay;

    // Wind drift calculation (assuming 5 m/s wind)
    const windSpeed = 5; // m/s
    const driftDistance = windSpeed * totalDescentTime;

    // Landing velocity (should be terminal velocity under parachute)
    const landingVelocity = terminalVelocity;

    // Recovery system recommendations
    const recommendations = [];
    if (terminalVelocity > 6) {
      recommendations.push("Terminal velocity is high - consider larger parachute");
    }
    if (terminalVelocity < 3) {
      recommendations.push("Very gentle landing - parachute may be oversized");
    }
    if (driftDistance > 300) {
      recommendations.push("Large drift distance - consider dual-deploy system");
    }
    if (freefallVelocity > 50) {
      recommendations.push("High freefall velocity - consider lower deployment altitude");
    }
    if (deploymentAltitude < 100) {
      recommendations.push("Low deployment altitude - may not allow full parachute inflation");
    }

    return {
      rocketMass,
      parachuteArea,
      terminalVelocity,
      freefallTime,
      freefallVelocity,
      parachuteDescentTime,
      totalDescentTime,
      driftDistance,
      landingVelocity,
      deploymentAltitude,
      recommendations
    };
  };

  const recoveryMetrics = calculateRecoveryMetrics();

  const runRecoveryAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      // Simulate recovery analysis (in a real implementation, this might call a backend)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (recoveryMetrics) {
        const prediction = {
          deploymentAltitude: recoveryMetrics.deploymentAltitude,
          terminalVelocity: recoveryMetrics.terminalVelocity,
          descentTime: recoveryMetrics.totalDescentTime,
          driftDistance: recoveryMetrics.driftDistance,
          landingVelocity: recoveryMetrics.landingVelocity,
          recommendations: recoveryMetrics.recommendations
        };
        
        useRocket.getState().setRecoveryPrediction(prediction);
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('recoveryPrediction', { 
          detail: { prediction } 
        }));
      }
      
    } catch (error) {
      console.error('Recovery analysis failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Recovery analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!sim?.maxAltitude && !isAnalyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">🪂</div>
          <p>No flight data available</p>
          <p className="text-sm mt-2">Run a simulation to analyze recovery system</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Recovery Analysis Features</div>
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex items-start">
              <span className="mr-2 text-blue-400">•</span>
              <span>Parachute sizing and performance analysis</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2 text-green-400">•</span>
              <span>Landing velocity and safety predictions</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2 text-purple-400">•</span>
              <span>Wind drift and landing dispersion</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2 text-orange-400">•</span>
              <span>Deployment timing optimization</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">⏳</div>
          <p>Analyzing recovery system...</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
            <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Recovery Analysis</h3>
        <button
          onClick={runRecoveryAnalysis}
          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
        >
          🔄 Re-analyze
        </button>
      </div>

      {/* Recovery System Configuration */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-sm text-slate-300 mb-2">Recovery System Configuration</div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Parachute Diameter (cm)</label>
            <input
              type="range"
              min="20"
              max="100"
              value={parachuteDiameter}
              onChange={(e) => setParachuteDiameter(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>20cm</span>
              <span className="text-white">{parachuteDiameter}cm</span>
              <span>100cm</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Deployment Altitude (m)</label>
            <input
              type="range"
              min="50"
              max="500"
              value={deploymentAltitude}
              onChange={(e) => setDeploymentAltitude(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>50m</span>
              <span className="text-white">{deploymentAltitude}m</span>
              <span>500m</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Deployment Delay (s)</label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={deploymentDelay}
              onChange={(e) => setDeploymentDelay(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>0s</span>
              <span className="text-white">{deploymentDelay}s</span>
              <span>10s</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recovery Metrics */}
      {recoveryMetrics && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="text-sm text-slate-300 mb-2">Recovery Performance</div>
          <div className="space-y-1">
            <RecoveryMetric
              label="Terminal Velocity"
              value={recoveryMetrics.terminalVelocity}
              unit="m/s"
              color="text-green-400"
              warning={recoveryMetrics.terminalVelocity > 6}
            />
            <RecoveryMetric
              label="Landing Velocity"
              value={recoveryMetrics.landingVelocity}
              unit="m/s"
              color="text-blue-400"
              warning={recoveryMetrics.landingVelocity > 6}
            />
            <RecoveryMetric
              label="Descent Time"
              value={recoveryMetrics.totalDescentTime}
              unit="s"
              color="text-purple-400"
            />
            <RecoveryMetric
              label="Drift Distance"
              value={recoveryMetrics.driftDistance}
              unit="m"
              color="text-orange-400"
              warning={recoveryMetrics.driftDistance > 300}
            />
          </div>
        </motion.div>
      )}

      {/* Parachute Specifications */}
      {recoveryMetrics && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="text-sm text-slate-300 mb-2">Parachute Specifications</div>
          <div className="space-y-1">
            <RecoveryMetric
              label="Diameter"
              value={parachuteDiameter}
              unit="cm"
              color="text-cyan-400"
            />
            <RecoveryMetric
              label="Area"
              value={recoveryMetrics.parachuteArea}
              unit="m²"
              color="text-yellow-400"
            />
            <RecoveryMetric
              label="Rocket Mass"
              value={recoveryMetrics.rocketMass}
              unit="kg"
              color="text-pink-400"
            />
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 text-xs">Loading:</span>
              <span className="text-sm font-mono text-indigo-400">
                {((recoveryMetrics.rocketMass ?? 0) / (recoveryMetrics.parachuteArea ?? 1)).toFixed(1)}kg/m²
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Flight Profile */}
      {recoveryMetrics && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="text-sm text-slate-300 mb-2">Descent Profile</div>
          <div className="space-y-2">
            {/* Descent phases */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Apogee to Deployment:</span>
                <span className="text-red-400">
                  {(recoveryMetrics.freefallTime ?? 0).toFixed(1)}s @ {(recoveryMetrics.freefallVelocity ?? 0).toFixed(1)}m/s
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Parachute Descent:</span>
                <span className="text-green-400">
                  {(recoveryMetrics.parachuteDescentTime ?? 0).toFixed(1)}s @ {(recoveryMetrics.terminalVelocity ?? 0).toFixed(1)}m/s
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Deployment Delay:</span>
                <span className="text-blue-400">{deploymentDelay}s</span>
              </div>
            </div>

            {/* Visual descent profile */}
            <div className="h-16 bg-slate-700 rounded relative overflow-hidden">
              <div className="absolute inset-0 flex">
                {/* Freefall phase */}
                <div 
                  className="bg-red-500/60 h-full flex items-center justify-center text-xs text-white"
                  style={{ width: `${(recoveryMetrics.freefallTime / recoveryMetrics.totalDescentTime) * 100}%` }}
                >
                  Freefall
                </div>
                {/* Delay phase */}
                <div 
                  className="bg-yellow-500/60 h-full flex items-center justify-center text-xs text-white"
                  style={{ width: `${(deploymentDelay / recoveryMetrics.totalDescentTime) * 100}%` }}
                >
                  Deploy
                </div>
                {/* Parachute phase */}
                <div 
                  className="bg-green-500/60 h-full flex items-center justify-center text-xs text-white"
                  style={{ width: `${(recoveryMetrics.parachuteDescentTime / recoveryMetrics.totalDescentTime) * 100}%` }}
                >
                  Parachute
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommendations */}
      {recoveryMetrics?.recommendations && recoveryMetrics.recommendations.length > 0 && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <div className="text-sm text-slate-300 mb-2">Recommendations</div>
          <div className="space-y-2">
            {recoveryMetrics.recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-slate-400 flex items-start">
                <span className="mr-2 text-green-400">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Safety Guidelines */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <div className="text-sm text-slate-300 mb-2">Safety Guidelines</div>
        <div className="space-y-1 text-xs text-slate-400">
          <div className="flex items-start">
            <span className="mr-2 text-green-400">✓</span>
            <span>Landing velocity should be under 6 m/s for safe recovery</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-400">✓</span>
            <span>Deploy parachute at least 100m above ground for full inflation</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-purple-400">✓</span>
            <span>Consider dual-deploy for high-altitude flights (&gt;500m)</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-orange-400">✓</span>
            <span>Account for wind drift when selecting launch site</span>
          </div>
          {recoveryMetrics && recoveryMetrics.terminalVelocity > 8 && (
            <div className="flex items-start">
              <span className="mr-2 text-red-400">⚠</span>
              <span>High landing velocity - consider larger parachute or dual-deploy system</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
} 