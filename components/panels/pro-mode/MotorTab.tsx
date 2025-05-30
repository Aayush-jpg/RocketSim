"use client"

import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MotorSpecProps {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  delay?: number;
}

function MotorSpec({ label, value, unit = '', color, delay = 0 }: MotorSpecProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
    >
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={cn("text-sm font-mono font-bold", color)}>
        {typeof value === "number" ? value.toFixed(1) : value}
        {unit}
      </span>
    </motion.div>
  );
}

export default function MotorTab() {
  const { motorAnalysis, rocket } = useRocket();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [availableMotors, setAvailableMotors] = useState<any>(null);
  const [selectedView, setSelectedView] = useState<"specs" | "performance" | "curve">("specs");

  const runMotorAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/motors/detailed', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Motor analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      setAvailableMotors(result);
      
      // Calculate motor analysis for current motor
      const currentMotorData = result.motors[rocket.motorId];
      if (currentMotorData) {
        const rocketMass = estimateRocketMass();
        const analysis = {
          motor: currentMotorData,
          thrustToWeight: (currentMotorData.averageThrust || currentMotorData.thrust || 0) / (rocketMass * 9.81),
          totalImpulse: currentMotorData.totalImpulse || 0,
          specificImpulse: currentMotorData.specificImpulse || currentMotorData.isp || 0,
          burnTime: currentMotorData.burnTime || 0,
          averageThrust: currentMotorData.averageThrust || currentMotorData.thrust || 0,
          impulseClass: currentMotorData.impulseClass || 'Unknown',
          recommendations: currentMotorData.applications || currentMotorData.recommendations || []
        };
        
        useRocket.getState().setMotorAnalysis(analysis);
      }
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('motorAnalysis', { 
        detail: { result } 
      }));
      
    } catch (error) {
      console.error('Motor analysis failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Motor analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Simple rocket mass estimation
  const estimateRocketMass = () => {
    let totalMass = 0.05; // Base empty mass in kg
    
    rocket.parts.forEach((part: any) => {
      switch (part.type) {
        case 'nose':
          totalMass += 0.05 * (part.length / 10);
          break;
        case 'body':
          totalMass += 0.1 * (part.length / 10) * part.Ø;
          break;
        case 'fin':
          totalMass += 0.01 * part.root * part.span;
          break;
      }
    });
    
    return totalMass;
  };

  // Load motor data on component mount
  useEffect(() => {
    if (!availableMotors && !isAnalyzing) {
      runMotorAnalysis();
    }
  }, []);

  const getThrustRating = (ratio: number) => {
    if (ratio < 5) return { rating: "LOW", color: "text-red-400" };
    if (ratio > 15) return { rating: "HIGH", color: "text-yellow-400" };
    return { rating: "OPTIMAL", color: "text-green-400" };
  };

  const currentMotor = availableMotors?.motors?.[rocket.motorId] || motorAnalysis?.motor;
  const rocketMass = estimateRocketMass();
  const thrustRating = getThrustRating(motorAnalysis?.thrustToWeight || 0);

  // Loading state
  if (isAnalyzing && !motorAnalysis) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Motor Analysis</h3>
              <p className="text-sm text-gray-400">Engine performance and characteristics</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <div className="text-4xl mb-2">⏳</div>
            <p>Analyzing motor performance...</p>
            <div className="w-64 bg-slate-700 rounded-full h-2 mt-4">
              <div className="bg-orange-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!motorAnalysis && !availableMotors && !isAnalyzing) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Motor Analysis</h3>
              <p className="text-sm text-gray-400">Engine performance and characteristics</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400 space-y-4">
            <div className="text-4xl mb-2">🔥</div>
            <p>No motor analysis available</p>
            <p className="text-sm mt-2">Run motor analysis to see specifications</p>
            <Button
              onClick={runMotorAnalysis}
              className="bg-orange-600 hover:bg-orange-700"
            >
              🔍 Analyze Motor Performance
            </Button>
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
            <h3 className="text-xl font-semibold text-white">Motor Analysis</h3>
            <p className="text-sm text-gray-400">Engine performance and characteristics</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={runMotorAnalysis}
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

        {/* View Selector */}
        <div className="flex space-x-1 mt-4 bg-black/20 rounded-lg p-1">
          {[
            { id: "specs", label: "Specifications" },
            { id: "performance", label: "Performance" },
            { id: "curve", label: "Available Motors" },
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
        {selectedView === "specs" && (
          <div className="space-y-6">
            {/* Motor Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white">Motor Overview</h4>
                <span className="text-xl font-bold text-orange-400">{rocket.motorId.toUpperCase()}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-blue-400 font-bold">{(currentMotor?.type || 'solid').toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Manufacturer:</span>
                  <span className="text-green-400 font-bold">{currentMotor?.manufacturer || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Impulse Class:</span>
                  <span className="text-purple-400 font-bold">{motorAnalysis?.impulseClass || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Delay:</span>
                  <span className="text-cyan-400 font-bold">{currentMotor?.delay || 'N/A'}</span>
                </div>
              </div>
            </motion.div>

            {/* Detailed Specifications */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Technical Specifications</h4>
              <div className="space-y-2">
                <MotorSpec
                  label="Average Thrust"
                  value={currentMotor?.averageThrust || currentMotor?.thrust || 0}
                  unit="N"
                  color="text-green-400"
                  delay={0}
                />
                <MotorSpec
                  label="Maximum Thrust"
                  value={currentMotor?.maxThrust || currentMotor?.peakThrust || currentMotor?.averageThrust || 0}
                  unit="N"
                  color="text-red-400"
                  delay={0.1}
                />
                <MotorSpec
                  label="Total Impulse"
                  value={currentMotor?.totalImpulse || 0}
                  unit="N·s"
                  color="text-purple-400"
                  delay={0.2}
                />
                <MotorSpec
                  label="Burn Time"
                  value={currentMotor?.burnTime || 0}
                  unit="s"
                  color="text-yellow-400"
                  delay={0.3}
                />
                <MotorSpec
                  label="Specific Impulse"
                  value={currentMotor?.specificImpulse || currentMotor?.isp || 0}
                  unit="s"
                  color="text-cyan-400"
                  delay={0.4}
                />
              </div>
            </motion.div>

            {/* Mass Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Mass Analysis</h4>
              <div className="space-y-2">
                <MotorSpec
                  label="Estimated Rocket Mass"
                  value={rocketMass}
                  unit="kg"
                  color="text-blue-400"
                  delay={0}
                />
                <MotorSpec
                  label="Propellant Mass"
                  value={currentMotor?.propellantMass || currentMotor?.weight?.propellant || 0}
                  unit="kg"
                  color="text-orange-400"
                  delay={0.1}
                />
                <MotorSpec
                  label="Dry Mass"
                  value={currentMotor?.dryMass || currentMotor?.weight?.dry || 0}
                  unit="kg"
                  color="text-blue-400"
                  delay={0.2}
                />
                <MotorSpec
                  label="Total Launch Mass"
                  value={rocketMass + (currentMotor?.dryMass || 0) + (currentMotor?.propellantMass || 0)}
                  unit="kg"
                  color="text-green-400"
                  delay={0.3}
                />
              </div>
            </motion.div>
          </div>
        )}

        {selectedView === "performance" && (
          <div className="space-y-6">
            {/* Thrust-to-Weight Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white">Thrust-to-Weight Ratio</h4>
                <span className={cn("text-lg font-bold", thrustRating.color)}>
                  {(motorAnalysis?.thrustToWeight || 0).toFixed(1)}:1
                </span>
              </div>

              <div className="w-full bg-black/30 rounded-full h-3 mb-3">
                <motion.div
                  className={cn("h-3 rounded-full", thrustRating.color.replace("text-", "bg-"))}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((motorAnalysis?.thrustToWeight || 0) * 5, 100)}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>5 (min)</span>
                <span>15 (max)</span>
                <span>20+</span>
              </div>

              <div className="mt-3 text-xs">
                <span className={cn("font-bold", thrustRating.color)}>{thrustRating.rating}</span>
                <span className="text-gray-400 ml-2">
                  {thrustRating.rating === "OPTIMAL" && "Ideal for stable, efficient flight"}
                  {thrustRating.rating === "LOW" && "May result in poor performance"}
                  {thrustRating.rating === "HIGH" && "High acceleration, ensure structural integrity"}
                </span>
              </div>
            </motion.div>

            {/* Performance Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Performance Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Efficiency</span>
                    <span className="text-green-400 font-bold">
                      {motorAnalysis?.specificImpulse ? ((motorAnalysis.specificImpulse / 300) * 100).toFixed(1) : '85.0'}%
                    </span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2">
                    <motion.div
                      className="bg-green-400 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${motorAnalysis?.specificImpulse ? (motorAnalysis.specificImpulse / 300) * 100 : 85}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Reliability</span>
                    <span className="text-blue-400 font-bold">98.5%</span>
                  </div>
                  <div className="w-full bg-black/30 rounded-full h-2">
                    <motion.div
                      className="bg-blue-400 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "98.5%" }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Performance Guidelines */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Performance Guidelines</h4>
              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">Thrust-to-weight ratio should be 5:1 to 15:1 for stable flight</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">Higher specific impulse indicates better fuel efficiency</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">Longer burn time provides more gradual acceleration</span>
                </div>
                {motorAnalysis && motorAnalysis.thrustToWeight < 5 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-300">Low thrust-to-weight ratio may result in poor performance</span>
                  </div>
                )}
                {motorAnalysis && motorAnalysis.thrustToWeight > 15 && (
                  <div className="flex items-start space-x-3">
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-gray-300">High thrust-to-weight ratio may cause excessive acceleration</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Motor Recommendations */}
            {motorAnalysis?.recommendations && motorAnalysis.recommendations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
              >
                <h4 className="text-sm font-medium text-white mb-4">Recommendations</h4>
                <div className="space-y-3 text-xs">
                  {motorAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-gray-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {selectedView === "curve" && (
          <div className="space-y-6">
            {/* Available Motors */}
            {availableMotors?.motors && Object.keys(availableMotors.motors).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
              >
                <h4 className="text-sm font-medium text-white mb-4">Available Motors</h4>
                <div className="space-y-2">
                  {Object.entries(availableMotors.motors).map(([motorId, motor]: [string, any]) => (
                    <motion.div
                      key={motorId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className={cn(
                        "flex justify-between items-center p-3 rounded-lg text-xs transition-colors",
                        motorId === rocket.motorId 
                          ? 'bg-orange-600/20 border border-orange-600/30' 
                          : 'bg-slate-700/50 hover:bg-slate-700/70'
                      )}
                    >
                      <span className="text-slate-300 font-bold">{motorId.toUpperCase()}</span>
                      <div className="flex space-x-4 text-slate-400">
                        <span className="text-green-400">{motor.averageThrust || motor.thrust || 0}N</span>
                        <span className="text-purple-400">{motor.totalImpulse || 0}N·s</span>
                        <span className="text-blue-400">{motor.type || 'solid'}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Motor Comparison */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-strong rounded-xl p-6 bg-slate-800/50 border border-white/5"
            >
              <h4 className="text-sm font-medium text-white mb-4">Motor Selection Guide</h4>
              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">A-class motors (0.625-1.25 N·s): Small, lightweight rockets</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">B-class motors (1.26-2.5 N·s): Medium-sized sport rockets</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">C-class motors (2.51-5.0 N·s): Standard sport rockets</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">D-class motors (5.01-10.0 N·s): Large sport rockets</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-300">E-class motors (10.01-20.0 N·s): High-power rockets</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
} 