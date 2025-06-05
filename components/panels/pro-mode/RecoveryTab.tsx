"use client"

import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function RecoveryMetric({
  label,
  value,
  unit,
  color,
  warning = false,
  delay = 0,
}: {
  label: string
  value: number
  unit: string
  color: string
  warning?: boolean
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "glass-strong rounded-xl p-4 transition-all duration-300 bg-slate-800/50 border border-white/5",
        warning ? "border border-yellow-500/20 bg-yellow-500/5" : "hover:bg-white/10",
      )}
    >
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center space-x-2">
          <span className={cn("text-lg font-bold font-mono", color)}>
            {value.toFixed(1)}
            {unit}
      </span>
          {warning && <span className="text-yellow-400 text-sm">⚠</span>}
        </div>
    </div>
    </motion.div>
  )
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
    
    // Nose cone mass
    if (rocket.nose_cone) {
      const baseRadius = rocket.nose_cone.base_radius_m || 0.05;
      const length = rocket.nose_cone.length_m || 0.1;
      const density = rocket.nose_cone.material_density_kg_m3 || 1600;
      const volume = Math.PI * Math.pow(baseRadius, 2) * length / 3;
      rocketMass += volume * density;
    }
    
    // Body tubes mass
    rocket.body_tubes.forEach((body) => {
      const radius = body.outer_radius_m || 0.05;
      const length = body.length_m || 0.3;
      const thickness = body.wall_thickness_m || 0.003;
      const density = body.material_density_kg_m3 || 1600;
      const volume = Math.PI * Math.pow(radius, 2) * length * thickness;
      rocketMass += volume * density;
    });
    
    // Fins mass
    rocket.fins.forEach((fin) => {
      const rootChord = fin.root_chord_m || 0.08;
      const tipChord = fin.tip_chord_m || rootChord;
      const span = fin.span_m || 0.05;
      const thickness = fin.thickness_m || 0.006;
      const finCount = fin.fin_count || 3;
      const density = fin.material_density_kg_m3 || 650;
      const finArea = 0.5 * (rootChord + tipChord) * span;
      const volume = finArea * thickness * finCount;
      rocketMass += volume * density;
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

    // Kinetic energy calculation
    const kineticEnergy = 0.5 * rocketMass * landingVelocity ** 2;

    // Safety ratings
    const velocityRating = landingVelocity > 8 ? "unsafe" : landingVelocity > 6 ? "caution" : "safe";
    const energyRating = kineticEnergy > 50 ? "unsafe" : kineticEnergy > 25 ? "caution" : "safe";
    const overallRating = velocityRating === "unsafe" || energyRating === "unsafe" ? "unsafe" : 
                         velocityRating === "caution" || energyRating === "caution" ? "caution" : "safe";

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
      kineticEnergy,
      velocityRating,
      energyRating,
      overallRating,
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

  const getSafetyColor = (rating: string) => {
    switch (rating) {
      case "safe":
        return "text-green-400"
      case "caution":
        return "text-yellow-400"
      case "unsafe":
        return "text-red-400"
      default:
        return "text-gray-400"
    }
  }

  // No data state
  if (!sim?.maxAltitude && !isAnalyzing) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Recovery Analysis</h3>
              <p className="text-sm text-gray-400">Parachute and landing system evaluation</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 space-y-4">
          <div className="text-4xl mb-2">🪂</div>
          <p>No flight data available</p>
          <p className="text-sm mt-2">Run a simulation to analyze recovery system</p>
        
            <div className="bg-slate-800/50 rounded-lg p-4 mt-6 max-w-md">
          <div className="text-sm text-slate-300 mb-2">Recovery Analysis Features</div>
              <div className="space-y-2 text-xs text-slate-400">
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
        </div>
      </div>
    );
  }

  // Loading state
  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Recovery Analysis</h3>
              <p className="text-sm text-gray-400">Parachute and landing system evaluation</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
          <div className="text-4xl mb-2">⏳</div>
          <p>Analyzing recovery system...</p>
            <div className="w-64 bg-slate-700 rounded-full h-2 mt-4">
            <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
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
            <h3 className="text-xl font-semibold text-white">Recovery Analysis</h3>
            <p className="text-sm text-gray-400">Parachute and landing system evaluation</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="secondary" 
              size="sm"
          onClick={runRecoveryAnalysis}
              disabled={isAnalyzing}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Safety Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-white">Safety Assessment</h4>
            <span className={cn("text-lg font-bold", getSafetyColor(recoveryMetrics?.overallRating || "safe"))}>
              {(recoveryMetrics?.overallRating || "safe").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="text-center">
              <div className={cn("text-sm font-bold", getSafetyColor(recoveryMetrics?.velocityRating || "safe"))}>
                {(recoveryMetrics?.velocityRating || "safe").toUpperCase()}
              </div>
              <div className="text-gray-400 mt-1">Landing Velocity</div>
            </div>
            <div className="text-center">
              <div className={cn("text-sm font-bold", getSafetyColor(recoveryMetrics?.energyRating || "safe"))}>
                {(recoveryMetrics?.energyRating || "safe").toUpperCase()}
          </div>
              <div className="text-gray-400 mt-1">Impact Energy</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-blue-400">
                {deploymentAltitude > 100 ? "OPTIMAL" : "LOW"}
          </div>
              <div className="text-gray-400 mt-1">Deployment</div>
          </div>
        </div>
      </motion.div>

        {/* Recovery Performance */}
      {recoveryMetrics && (
          <div className="space-y-3">
            <RecoveryMetric
              label="Terminal Velocity"
              value={recoveryMetrics.terminalVelocity}
              unit="m/s"
              color="text-green-400"
              warning={recoveryMetrics.terminalVelocity > 6}
              delay={0.1}
            />
            <RecoveryMetric
              label="Landing Velocity"
              value={recoveryMetrics.landingVelocity}
              unit="m/s"
              color="text-blue-400"
              warning={recoveryMetrics.landingVelocity > 6}
              delay={0.2}
            />
            <RecoveryMetric
              label="Descent Time"
              value={recoveryMetrics.totalDescentTime}
              unit="s"
              color="text-purple-400"
              delay={0.3}
            />
            <RecoveryMetric
              label="Drift Distance"
              value={recoveryMetrics.driftDistance}
              unit="m"
              color="text-orange-400"
              warning={recoveryMetrics.driftDistance > 200}
              delay={0.4}
            />
          </div>
      )}

        {/* Parachute Configuration */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
        >
          <h4 className="text-sm font-medium text-white mb-4">Parachute Configuration</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Diameter: {parachuteDiameter}cm</span>
                <span className="text-gray-400">
                  Area: {((Math.PI * (parachuteDiameter / 100) ** 2) / 4).toFixed(3)}m²
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
              value={parachuteDiameter}
                onChange={(e) => setParachuteDiameter(Number(e.target.value))}
                className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((parachuteDiameter - 20) / 80) * 100}%, rgba(255,255,255,0.1) ${((parachuteDiameter - 20) / 80) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>20cm</span>
                <span>100cm</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Deployment Altitude: {deploymentAltitude}m</span>
                <span className="text-gray-400">Safety margin: {deploymentAltitude > 100 ? "Good" : "Low"}</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                value={deploymentAltitude}
                onChange={(e) => setDeploymentAltitude(Number(e.target.value))}
                className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #10B981 0%, #10B981 ${((deploymentAltitude - 50) / 450) * 100}%, rgba(255,255,255,0.1) ${((deploymentAltitude - 50) / 450) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50m</span>
                <span>500m</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Deployment Delay: {deploymentDelay}s</span>
                <span className="text-gray-400">Recovery timing</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={deploymentDelay}
                onChange={(e) => setDeploymentDelay(Number(e.target.value))}
                className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${(deploymentDelay / 10) * 100}%, rgba(255,255,255,0.1) ${(deploymentDelay / 10) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0s</span>
                <span>10s</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Safety Guidelines */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
        >
          <h4 className="text-sm font-medium text-white mb-4">Safety Guidelines</h4>
          <div className="space-y-3 text-xs">
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-gray-300">Landing velocity should be under 6 m/s for safe recovery</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-gray-300">Deploy parachute at least 100m above ground for full inflation</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-gray-300">Consider dual-deploy for high-altitude flights (&gt;500m)</span>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
              <span className="text-gray-300">Account for wind drift when selecting launch site</span>
            </div>
            {recoveryMetrics && recoveryMetrics.terminalVelocity > 8 && (
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                <span className="text-gray-300">High landing velocity - consider larger parachute or dual-deploy system</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Impact Analysis */}
        {recoveryMetrics && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
          >
            <h4 className="text-sm font-medium text-white mb-4">Impact Analysis</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Kinetic Energy:</span>
                <span className="text-green-400 font-mono">{recoveryMetrics.kineticEnergy.toFixed(1)}J</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Impact Force:</span>
                <span className="text-blue-400 font-mono">
                  ~{(recoveryMetrics.kineticEnergy * 2).toFixed(0)}N
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Recovery Rating:</span>
                <span className={cn("font-bold", getSafetyColor(recoveryMetrics.overallRating))}>
                  {recoveryMetrics.overallRating === "safe" ? "EXCELLENT" : 
                   recoveryMetrics.overallRating === "caution" ? "GOOD" : "NEEDS IMPROVEMENT"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Damage Risk:</span>
                <span className={cn("font-bold", getSafetyColor(recoveryMetrics.velocityRating))}>
                  {recoveryMetrics.velocityRating === "safe" ? "MINIMAL" : 
                   recoveryMetrics.velocityRating === "caution" ? "MODERATE" : "HIGH"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rocket Mass:</span>
                <span className="text-cyan-400 font-mono">{recoveryMetrics.rocketMass.toFixed(2)}kg</span>
            </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Parachute Loading:</span>
                <span className="text-yellow-400 font-mono">
                  {(recoveryMetrics.rocketMass / recoveryMetrics.parachuteArea).toFixed(1)}kg/m²
                </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommendations */}
      {recoveryMetrics?.recommendations && recoveryMetrics.recommendations.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
        >
            <h4 className="text-sm font-medium text-white mb-4">Recommendations</h4>
            <div className="space-y-3 text-xs">
            {recoveryMetrics.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">{rec}</span>
              </div>
            ))}
          </div>
        </motion.div>
          )}
        </div>
    </div>
  );
} 