import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface TrajectoryPointProps {
  time: number;
  altitude: number;
  velocity: number;
  acceleration: number;
  isHighlight?: boolean;
}

function TrajectoryPoint({ time, altitude, velocity, acceleration, isHighlight }: TrajectoryPointProps) {
  return (
    <div className={`grid grid-cols-4 gap-2 text-xs py-1 px-2 rounded ${
      isHighlight ? 'bg-blue-600/20 border border-blue-600/30' : 'hover:bg-slate-700/50'
    }`}>
      <span className="text-slate-300">{time.toFixed(1)}s</span>
      <span className="text-green-400">{altitude.toFixed(0)}m</span>
      <span className="text-blue-400">{velocity.toFixed(1)}m/s</span>
      <span className="text-orange-400">{acceleration.toFixed(1)}m/s²</span>
    </div>
  );
}

export default function TrajectoryTab() {
  const { sim, rocket } = useRocket();
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'powered' | 'coast' | 'descent'>('all');
  const [showDetailed, setShowDetailed] = useState(false);

  // Generate trajectory data from simulation results
  const generateTrajectoryData = () => {
    if (!sim?.maxAltitude) return null;

    const apogeeTime = sim.apogeeTime || 10;
    const maxAltitude = sim.maxAltitude;
    const maxVelocity = sim.maxVelocity || 100;
    const maxAcceleration = sim.maxAcceleration || 50;

    // Generate trajectory points
    const points = [];
    const totalTime = apogeeTime * 2; // Approximate total flight time
    const timeStep = 0.5;

    for (let t = 0; t <= totalTime; t += timeStep) {
      let altitude, velocity, acceleration;

      if (t <= apogeeTime) {
        // Ascent phase
        const progress = t / apogeeTime;
        altitude = maxAltitude * (2 * progress - progress * progress);
        velocity = maxVelocity * (1 - progress);
        acceleration = t < 3 ? maxAcceleration * (1 - t / 3) : -9.81; // Motor burn then gravity
      } else {
        // Descent phase
        const descentTime = t - apogeeTime;
        const descentProgress = Math.min(descentTime / apogeeTime, 1);
        altitude = maxAltitude * (1 - descentProgress * descentProgress);
        velocity = -30 * descentProgress; // Negative for descent
        acceleration = -9.81; // Gravity
      }

      points.push({
        time: t,
        altitude: Math.max(0, altitude),
        velocity,
        acceleration,
        phase: t <= 3 ? 'powered' : t <= apogeeTime ? 'coast' : 'descent'
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

  // Find key events
  const keyEvents = trajectoryData ? [
    { name: 'Liftoff', time: 0, altitude: 0, type: 'launch' },
    { name: 'Motor Burnout', time: 3, altitude: trajectoryData.find(p => p.time >= 3)?.altitude || 0, type: 'burnout' },
    { name: 'Apogee', time: sim?.apogeeTime || 10, altitude: sim?.maxAltitude || 0, type: 'apogee' },
    { name: 'Landing', time: trajectoryData[trajectoryData.length - 1]?.time || 20, altitude: 0, type: 'landing' }
  ] : [];

  if (!sim?.maxAltitude) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">📈</div>
          <p>No trajectory data available</p>
          <p className="text-sm mt-2">Run a simulation to see flight trajectory</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Trajectory Analysis Features</div>
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex items-start">
              <span className="mr-2 text-blue-400">•</span>
              <span>Real-time flight path visualization</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2 text-green-400">•</span>
              <span>Phase-by-phase analysis (powered, coast, descent)</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2 text-purple-400">•</span>
              <span>Key flight events and milestones</span>
            </div>
            <div className="flex items-start">
              <span className="mr-2 text-orange-400">•</span>
              <span>Velocity and acceleration profiles</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Flight Trajectory</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowDetailed(!showDetailed)}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
          >
            {showDetailed ? '📊 Summary' : '📋 Detailed'}
          </button>
        </div>
      </div>

      {/* Flight Phase Selector */}
      <div className="flex space-x-1">
        {[
          { id: 'all', label: 'All Phases', icon: '🚀' },
          { id: 'powered', label: 'Powered', icon: '🔥' },
          { id: 'coast', label: 'Coast', icon: '⬆️' },
          { id: 'descent', label: 'Descent', icon: '⬇️' }
        ].map((phase) => (
          <button
            key={phase.id}
            onClick={() => setSelectedPhase(phase.id as any)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              selectedPhase === phase.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {phase.icon} {phase.label}
          </button>
        ))}
      </div>

      {/* Key Flight Events */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-sm text-slate-300 mb-2">Key Flight Events</div>
        <div className="space-y-1">
          {keyEvents.map((event, index) => (
            <div key={index} className="flex justify-between items-center text-xs">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${
                  event.type === 'launch' ? 'bg-green-400' :
                  event.type === 'burnout' ? 'bg-orange-400' :
                  event.type === 'apogee' ? 'bg-blue-400' : 'bg-red-400'
                }`}></span>
                <span className="text-slate-300">{event.name}</span>
              </div>
              <div className="flex space-x-3 text-slate-400">
                <span>{event.time.toFixed(1)}s</span>
                <span>{event.altitude.toFixed(0)}m</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Trajectory Visualization */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="text-sm text-slate-300 mb-2">Altitude Profile</div>
        <div className="h-32 bg-slate-700 rounded relative overflow-hidden">
          {trajectoryData && (
            <svg className="w-full h-full">
              {/* Draw trajectory line */}
              {trajectoryData.map((point, index) => {
                if (index === 0) return null;
                const prevPoint = trajectoryData[index - 1];
                const maxTime = trajectoryData[trajectoryData.length - 1].time;
                const maxAlt = Math.max(...trajectoryData.map(p => p.altitude));
                
                const x1 = (prevPoint.time / maxTime) * 100;
                const y1 = 100 - (prevPoint.altitude / maxAlt) * 90;
                const x2 = (point.time / maxTime) * 100;
                const y2 = 100 - (point.altitude / maxAlt) * 90;
                
                const color = point.phase === 'powered' ? '#F97316' : 
                             point.phase === 'coast' ? '#3B82F6' : '#EF4444';
                
                return (
                  <line
                    key={index}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={color}
                    strokeWidth="2"
                    opacity={selectedPhase === 'all' || point.phase === selectedPhase ? 1 : 0.3}
                  />
                );
              })}
              
              {/* Mark key events */}
              {keyEvents.map((event, index) => {
                const maxTime = trajectoryData[trajectoryData.length - 1].time;
                const maxAlt = Math.max(...trajectoryData.map(p => p.altitude));
                const x = (event.time / maxTime) * 100;
                const y = 100 - (event.altitude / maxAlt) * 90;
                
                return (
                  <circle
                    key={index}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="3"
                    fill={
                      event.type === 'launch' ? '#10B981' :
                      event.type === 'burnout' ? '#F97316' :
                      event.type === 'apogee' ? '#3B82F6' : '#EF4444'
                    }
                  />
                );
              })}
            </svg>
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>0s</span>
          <span>Time vs Altitude</span>
          <span>{trajectoryData?.[trajectoryData.length - 1]?.time.toFixed(1)}s</span>
        </div>
      </motion.div>

      {/* Performance Summary */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="text-sm text-slate-300 mb-2">Performance Summary</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Max Altitude:</span>
            <span className="text-green-400">{sim.maxAltitude.toFixed(1)}m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Velocity:</span>
            <span className="text-blue-400">{sim.maxVelocity?.toFixed(1) || 'N/A'}m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Apogee Time:</span>
            <span className="text-yellow-400">{sim.apogeeTime?.toFixed(1) || 'N/A'}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Flight Time:</span>
            <span className="text-purple-400">{trajectoryData?.[trajectoryData.length - 1]?.time.toFixed(1) || 'N/A'}s</span>
          </div>
        </div>
      </motion.div>

      {/* Detailed Data Table */}
      {showDetailed && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="text-sm text-slate-300 mb-2">
            Detailed Trajectory Data - {selectedPhase === 'all' ? 'All Phases' : selectedPhase.charAt(0).toUpperCase() + selectedPhase.slice(1)}
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-300 mb-2 pb-1 border-b border-slate-600">
            <span>Time</span>
            <span>Altitude</span>
            <span>Velocity</span>
            <span>Acceleration</span>
          </div>
          
          {/* Table Data */}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredData.slice(0, 20).map((point, index) => (
              <TrajectoryPoint
                key={index}
                time={point.time}
                altitude={point.altitude}
                velocity={point.velocity}
                acceleration={point.acceleration}
                isHighlight={keyEvents.some(event => Math.abs(event.time - point.time) < 0.5)}
              />
            ))}
            {filteredData.length > 20 && (
              <div className="text-center text-slate-500 text-xs py-2">
                ... and {filteredData.length - 20} more data points
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Analysis Insights */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="text-sm text-slate-300 mb-2">Flight Analysis</div>
        <div className="space-y-2">
          {sim.maxVelocity && sim.maxVelocity > 200 && (
            <div className="text-xs text-slate-400 flex items-start">
              <span className="mr-2 text-yellow-400">⚠</span>
              <span>High velocity achieved - ensure recovery system is rated for this speed</span>
            </div>
          )}
          {sim.maxAcceleration && sim.maxAcceleration > 100 && (
            <div className="text-xs text-slate-400 flex items-start">
              <span className="mr-2 text-orange-400">⚠</span>
              <span>High acceleration - consider structural integrity of components</span>
            </div>
          )}
          {sim.apogeeTime && sim.apogeeTime < 5 && (
            <div className="text-xs text-slate-400 flex items-start">
              <span className="mr-2 text-blue-400">ℹ</span>
              <span>Short flight time - consider larger motor for extended flight</span>
            </div>
          )}
          <div className="text-xs text-slate-400 flex items-start">
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
  );
} 