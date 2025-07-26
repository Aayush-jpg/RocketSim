"use client"

import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


interface TrajectoryPointProps {
  time: number;
  altitude: number;
  velocity: number;
  acceleration: number;
  phase: 'powered' | 'coast' | 'descent';
  position: number[];
  velocity3d: number[];
  acceleration3d: number[];
  isHighlight?: boolean;
}

const flightPhases = [
  { id: "all", label: "All Phases", icon: "🚀", color: "text-white" },
  { id: "powered", label: "Powered", icon: "🔥", color: "text-orange-400" },
  { id: "coast", label: "Coast", icon: "⬆️", color: "text-blue-400" },
  { id: "descent", label: "Descent", icon: "⬇️", color: "text-green-400" },
];

export default function TrajectoryTab() {
  const { sim, rocket } = useRocket();
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'powered' | 'coast' | 'descent'>('all');
  const [showDetailed, setShowDetailed] = useState(false);

  const generateTrajectoryData = (): TrajectoryPointProps[] | null => {
    // Guard for real trajectory data. If this passes, sim and sim.trajectory are defined.
    if (
      sim &&
      (sim.simulationFidelity === 'enhanced' || sim.simulationFidelity === 'professional') &&
      sim.trajectory &&
      sim.trajectory.time &&
      sim.trajectory.time.length > 1 &&
      sim.trajectory.time[sim.trajectory.time.length - 1] > 0
    ) {
      console.log(`🚀 Using REAL ${sim.simulationFidelity} trajectory data from 6-DOF simulation`);
      
      const realTrajectory = sim.trajectory;
      const points: TrajectoryPointProps[] = [];
      
      for (let i = 0; i < realTrajectory.time.length; i++) {
        const time = realTrajectory.time[i];
        
        const position = realTrajectory.position[i] || [0, 0, 0];
        const altitude = position[2];
        
        const velocity3d = realTrajectory.velocity[i] || [0, 0, 0];
        const velocity = Math.sqrt(velocity3d[0]**2 + velocity3d[1]**2 + velocity3d[2]**2);
        
        const acceleration3d = realTrajectory.acceleration[i] || [0, 0, 0];
        const acceleration = Math.sqrt(acceleration3d[0]**2 + acceleration3d[1]**2 + acceleration3d[2]**2);
        
        let phase: 'powered' | 'coast' | 'descent' = 'coast';
        if (time <= 3) {
          phase = 'powered';
        } else if (time > (sim.apogeeTime || 10)) {
          phase = 'descent';
        }
        
        points.push({
          time,
          altitude: Math.max(0, altitude),
          velocity,
          acceleration,
          phase,
          position,
          velocity3d,
          acceleration3d
        });
      }
      
      return points;
    }
    
    // Fallback to synthetic data generation
    if (!sim?.maxAltitude) {
      return null;
    }
    
    console.warn("⚠️ No real trajectory data available, generating synthetic approximation");
    
    const { apogeeTime = 10, maxAltitude, maxVelocity = 100, maxAcceleration = 50 } = sim;

    const points: TrajectoryPointProps[] = [];
    const totalTime = apogeeTime * 2;
    const timeStep = 0.5;

    for (let t = 0; t <= totalTime; t += timeStep) {
      let altitude, velocity, acceleration;
      let phase: 'powered' | 'coast' | 'descent';

      if (t <= apogeeTime) {
        const progress = t / apogeeTime;
        altitude = maxAltitude * (2 * progress - progress * progress);
        velocity = maxVelocity * (1 - progress);
        acceleration = t < 3 ? maxAcceleration * (1 - t / 3) : -9.81;
        phase = t <= 3 ? 'powered' : 'coast';
      } else {
        const descentTime = t - apogeeTime;
        const descentProgress = Math.min(descentTime / apogeeTime, 1);
        altitude = maxAltitude * (1 - descentProgress * descentProgress);
        velocity = -30 * descentProgress;
        acceleration = -9.81;
        phase = 'descent';
      }

      points.push({
        time: t,
        altitude: Math.max(0, altitude),
        velocity,
        acceleration,
        phase,
        position: [0, 0, altitude],
        velocity3d: [0, 0, velocity],
        acceleration3d: [0, 0, acceleration]
      });
    }

    return points;
  };

  const trajectoryData = generateTrajectoryData();

  // Filter data based on selected phase
  const filteredData = trajectoryData?.filter(point => {
    if (selectedPhase === 'all') return true;
    return point.phase === selectedPhase;
  }) || [];
  // ✅ Use flight events from the backend if available, otherwise generate them
  const keyEvents = sim?.flightEvents && sim.flightEvents.length > 0
    ? sim.flightEvents.map(event => ({
        name: event.name,
        time: event.time,
        altitude: event.altitude,
        type: event.name.toLowerCase().includes('burnout') ? 'burnout' :
              event.name.toLowerCase().includes('apogee') ? 'apogee' :
              event.name.toLowerCase().includes('landing') || event.name.toLowerCase().includes('impact') ? 'landing' : 'launch'
      }))
    : trajectoryData ? [
      { name: 'Liftoff', time: 0, altitude: 0, type: 'launch' },
      { name: 'Apogee', time: sim?.apogeeTime || 10, altitude: sim?.maxAltitude || 0, type: 'apogee' },
      { name: 'Landing', time: trajectoryData[trajectoryData.length - 1]?.time || 20, altitude: 0, type: 'landing' }
    ] : [];

  if (!sim?.maxAltitude) {
    return (
      <div className="h-full flex flex-col bg-black">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Flight Trajectory</h3>
              <p className="text-sm text-gray-400">Real-time flight path analysis</p>
            </div>
          </div>
        </div>

        {/* No Data Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, -5, 5, 0]
              }}
              transition={{ 
                delay: 0.1,
                duration: 2, 
                repeat: Infinity, 
                repeatType: "reverse" 
              }}
              className="text-4xl mb-2"
            >
              📈
            </motion.div>
            <p>No trajectory data available</p>
            <p className="text-sm mt-2">Run a simulation to analyze flight path</p>
            
            <div className="bg-slate-800/50 rounded-lg p-4 mt-6 max-w-sm">
              <div className="text-sm text-slate-300 mb-2">Trajectory Features</div>
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-start">
                  <span className="mr-2 text-blue-400">•</span>
                  <span>3D flight path visualization</span>
                </div>
                <div className="flex items-start">
                  <span className="mr-2 text-green-400">•</span>
                  <span>Real-time position tracking</span>
                </div>
                <div className="flex items-start">
                  <span className="mr-2 text-orange-400">•</span>
                  <span>Key event markers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxTime = trajectoryData?.[trajectoryData.length - 1]?.time || 0;

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Flight Trajectory</h3>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-400">Real-time flight path analysis</p>
              {sim?.trajectory?.time ? (
                <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full border border-green-600/30">
                  ✅ Real 6-DOF Data ({sim.trajectory.time.length} points)
                </span>
              ) : (
                <span className="px-2 py-1 bg-orange-600/20 text-orange-400 text-xs rounded-full border border-orange-600/30">
                  ⚠️ Synthetic Data
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant={showDetailed ? "default" : "secondary"}
              size="sm"
              onClick={() => setShowDetailed(!showDetailed)}
            >
              {showDetailed ? "📊 Summary" : "📋 Detailed"}
            </Button>
          </div>
        </div>

        {/* Phase Selector */}
        <div className="flex space-x-1 mt-4 bg-black/20 rounded-lg p-1">
          {flightPhases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setSelectedPhase(phase.id as any)}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 flex items-center space-x-2",
                selectedPhase === phase.id ? "bg-white text-black" : "text-gray-400 hover:text-white hover:bg-white/5",
              )}
            >
              <span>{phase.icon}</span>
              <span>{phase.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Trajectory Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-strong rounded-xl p-6"
        >
          <h4 className="text-sm font-medium text-white mb-4">Altitude Profile</h4>
          <div className="h-32 bg-black/30 rounded-lg relative overflow-hidden">
            {trajectoryData && (
              <svg className="w-full h-full">
                {trajectoryData.map((point, index) => {
                  if (index === 0) return null;
                  const prevPoint = trajectoryData[index - 1];
                  const maxTimeForCalc = Math.max(...trajectoryData.map(p => p.time));
                  const maxAlt = Math.max(...trajectoryData.map(p => p.altitude));
                  
                  const x1 = (prevPoint.time / maxTimeForCalc) * 100;
                  const y1 = 100 - (prevPoint.altitude / maxAlt) * 90;
                  const x2 = (point.time / maxTimeForCalc) * 100;
                  const y2 = 100 - (point.altitude / maxAlt) * 90;
                  
                  const color = point.phase === 'powered' ? '#F97316' : 
                               point.phase === 'coast' ? '#3B82F6' : '#10B981';
                  
                  return (
                    <motion.line
                      key={index}
                      x1={`${x1}%`}
                      y1={`${y1}%`}
                      x2={`${x2}%`}
                      y2={`${y2}%`}
                      stroke={color}
                      strokeWidth="2"
                      opacity={selectedPhase === 'all' || point.phase === selectedPhase ? 1 : 0.3}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                    />
                  );
                })}
                
                {/* Mark key events */}
                {keyEvents.map((event, index) => {
                  const maxTimeForCalc = Math.max(...trajectoryData.map(p => p.time));
                  const maxAlt = Math.max(...trajectoryData.map(p => p.altitude));
                  const x = (event.time / maxTimeForCalc) * 100;
                  const y = 100 - (event.altitude / maxAlt) * 90;
                  
                  return (
                    <motion.circle
                      key={index}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="3"
                      fill={
                        event.type === 'launch' ? '#10B981' :
                        event.type === 'burnout' ? '#F97316' :
                        event.type === 'apogee' ? '#3B82F6' : '#EF4444'
                      }
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                    />
                  );
                })}
              </svg>
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>0s</span>
            <span>Time vs Altitude</span>
            <span>{maxTime.toFixed(1)}s</span>
          </div>
        </motion.div>

        {/* Performance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-strong rounded-xl p-6"
        >
          <h4 className="text-sm font-medium text-white mb-4">Performance Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Max Altitude:</span>
              <span className="text-green-400 font-mono">{(sim.maxAltitude ?? 0).toFixed(0)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Velocity:</span>
              <span className="text-blue-400 font-mono">{sim.maxVelocity?.toFixed(1) || 'N/A'}m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Apogee Time:</span>
              <span className="text-yellow-400 font-mono">{sim.apogeeTime?.toFixed(1) || 'N/A'}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Flight Time:</span>
              <span className="text-purple-400 font-mono">{maxTime.toFixed(1)}s</span>
            </div>
          </div>
        </motion.div>

        {/* Key Flight Events */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="glass-strong rounded-xl p-6"
        >
          <h4 className="text-sm font-medium text-white mb-4">Key Flight Events</h4>
          <div className="space-y-2">
            {keyEvents.map((event, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                className="flex justify-between items-center text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${
                    event.type === 'launch' ? 'bg-green-400' :
                    event.type === 'burnout' ? 'bg-orange-400' :
                    event.type === 'apogee' ? 'bg-blue-400' : 'bg-red-400'
                  }`}></span>
                  <span className="text-gray-300">{event.name}</span>
                </div>
                <div className="flex space-x-3 text-gray-400 font-mono">
                  <span>{(event.time ?? 0).toFixed(1)}s</span>
                  <span>{(event.altitude ?? 0).toFixed(0)}m</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Detailed Data Table */}
        {showDetailed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="glass-strong rounded-xl p-6"
          >
            <h4 className="text-sm font-medium text-white mb-4">
              Trajectory Data - {selectedPhase === "all" ? "All Phases" : selectedPhase.charAt(0).toUpperCase() + selectedPhase.slice(1)}
            </h4>

            {/* Table Header */}
            <div className="grid grid-cols-4 gap-3 text-xs font-medium text-gray-300 mb-3 pb-2 border-b border-white/10">
              <span>Time</span>
              <span>Altitude</span>
              <span>Velocity</span>
              <span>Acceleration</span>
            </div>

            {/* Table Data */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredData.slice(0, 15).map((point, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={cn(
                    "grid grid-cols-4 gap-3 text-xs py-2 px-3 rounded-lg hover:bg-white/5 transition-colors",
                    keyEvents.some(event => Math.abs(event.time - point.time) < 0.5) && "bg-blue-600/20 border border-blue-600/30"
                  )}
                >
                  <span className="text-gray-300 font-mono">{point.time.toFixed(1)}s</span>
                  <span className="text-green-400 font-mono">{point.altitude.toFixed(0)}m</span>
                  <span className="text-blue-400 font-mono">{point.velocity.toFixed(1)}m/s</span>
                  <span className="text-orange-400 font-mono">{point.acceleration.toFixed(1)}m/s²</span>
                </motion.div>
              ))}
              {filteredData.length > 15 && (
                <div className="text-center text-gray-500 text-xs py-2">
                  ... and {filteredData.length - 15} more data points
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Flight Analysis */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="glass-strong rounded-xl p-6"
        >
          <h4 className="text-sm font-medium text-white mb-4">Flight Analysis</h4>
          <div className="space-y-2">
            {sim.maxVelocity && sim.maxVelocity > 200 && (
              <div className="text-xs text-gray-400 flex items-start">
                <span className="mr-2 text-yellow-400">⚠</span>
                <span>High velocity achieved - ensure recovery system is rated for this speed</span>
              </div>
            )}
            {sim.maxAcceleration && sim.maxAcceleration > 100 && (
              <div className="text-xs text-gray-400 flex items-start">
                <span className="mr-2 text-orange-400">⚠</span>
                <span>High acceleration - consider structural integrity of components</span>
              </div>
            )}
            {sim.apogeeTime && sim.apogeeTime < 5 && (
              <div className="text-xs text-gray-400 flex items-start">
                <span className="mr-2 text-blue-400">ℹ</span>
                <span>Short flight time - consider larger motor for extended flight</span>
              </div>
            )}
            <div className="text-xs text-gray-400 flex items-start">
              <span className="mr-2 text-green-400">•</span>
              <span>
                Flight efficiency: {sim.maxAltitude && sim.maxVelocity ? 
                  ((sim.maxAltitude / (sim.maxVelocity * sim.maxVelocity / (2 * 9.81))) * 100).toFixed(0) : 'N/A'}% 
                (altitude vs theoretical maximum)
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 