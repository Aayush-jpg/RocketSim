import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface MotorSpecProps {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
}

function MotorSpec({ label, value, unit = '', color }: MotorSpecProps) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-slate-400 text-xs">{label}:</span>
      <span className={`text-sm font-mono ${color}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </span>
    </div>
  );
}

export default function MotorTab() {
  const { motorAnalysis, rocket } = useRocket();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [availableMotors, setAvailableMotors] = useState<any>(null);

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

  if (!motorAnalysis && !availableMotors && !isAnalyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">🔥</div>
          <p>No motor analysis available</p>
          <p className="text-sm mt-2">Run motor analysis to see specifications</p>
        </div>
        
        <button
          onClick={runMotorAnalysis}
          className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm"
        >
          🔍 Analyze Motor Performance
        </button>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">⏳</div>
          <p>Analyzing motor performance...</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
            <div className="bg-orange-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  const currentMotor = availableMotors?.motors?.[rocket.motorId] || motorAnalysis?.motor;
  const rocketMass = estimateRocketMass();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Motor Analysis</h3>
        <button
          onClick={runMotorAnalysis}
          className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Current Motor Overview */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Current Motor</span>
          <span className="text-lg font-bold text-orange-400">
            {rocket.motorId.toUpperCase()}
          </span>
        </div>
        
        {currentMotor && (
          <div className="space-y-1">
            <MotorSpec 
              label="Type" 
              value={currentMotor.type || 'solid'} 
              color="text-blue-400" 
            />
            <MotorSpec 
              label="Average Thrust" 
              value={currentMotor.averageThrust || currentMotor.thrust || 0} 
              unit="N" 
              color="text-green-400" 
            />
            <MotorSpec 
              label="Total Impulse" 
              value={currentMotor.totalImpulse || 0} 
              unit="N·s" 
              color="text-purple-400" 
            />
            <MotorSpec 
              label="Burn Time" 
              value={currentMotor.burnTime || 0} 
              unit="s" 
              color="text-yellow-400" 
            />
            <MotorSpec 
              label="Specific Impulse" 
              value={currentMotor.specificImpulse || currentMotor.isp || 0} 
              unit="s" 
              color="text-cyan-400" 
            />
          </div>
        )}
      </motion.div>

      {/* Performance Metrics */}
      {motorAnalysis && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="text-sm text-slate-300 mb-2">Performance Analysis</div>
          <div className="space-y-2">
            {/* Thrust-to-Weight Ratio */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Thrust-to-Weight Ratio</span>
                <span className={`font-bold ${
                  motorAnalysis.thrustToWeight < 5 ? 'text-red-400' :
                  motorAnalysis.thrustToWeight > 15 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {(motorAnalysis.thrustToWeight ?? 0).toFixed(1)}:1
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    motorAnalysis.thrustToWeight < 5 ? 'bg-red-500' :
                    motorAnalysis.thrustToWeight > 15 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(motorAnalysis.thrustToWeight * 5, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0</span>
                <span>5 (min)</span>
                <span>15 (max)</span>
                <span>20+</span>
              </div>
            </div>

            {/* Impulse Class */}
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-xs">Impulse Class:</span>
              <span className="text-orange-400 font-bold">
                {motorAnalysis.impulseClass}
              </span>
            </div>

            {/* Efficiency Rating */}
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-xs">Efficiency:</span>
              <span className={`font-bold ${
                motorAnalysis.specificImpulse > 250 ? 'text-green-400' :
                motorAnalysis.specificImpulse > 200 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {motorAnalysis.specificImpulse > 250 ? 'High' :
                 motorAnalysis.specificImpulse > 200 ? 'Medium' : 'Low'}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rocket Mass Analysis */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="text-sm text-slate-300 mb-2">Mass Analysis</div>
        <div className="space-y-1">
          <MotorSpec 
            label="Estimated Rocket Mass" 
            value={rocketMass} 
            unit="kg" 
            color="text-blue-400" 
          />
          {currentMotor && (
            <>
              <MotorSpec 
                label="Motor Dry Mass" 
                value={currentMotor.dryMass || currentMotor.weight?.dry || 0} 
                unit="kg" 
                color="text-green-400" 
              />
              <MotorSpec 
                label="Propellant Mass" 
                value={currentMotor.propellantMass || currentMotor.weight?.propellant || 0} 
                unit="kg" 
                color="text-orange-400" 
              />
              <MotorSpec 
                label="Total Launch Mass" 
                value={rocketMass + (currentMotor.dryMass || 0) + (currentMotor.propellantMass || 0)} 
                unit="kg" 
                color="text-purple-400" 
              />
            </>
          )}
        </div>
      </motion.div>

      {/* Motor Recommendations */}
      {motorAnalysis?.recommendations && motorAnalysis.recommendations.length > 0 && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <div className="text-sm text-slate-300 mb-2">Recommendations</div>
          <div className="space-y-2">
            {motorAnalysis.recommendations.map((rec, index) => (
              <div key={index} className="text-xs text-slate-400 flex items-start">
                <span className="mr-2 text-orange-400">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Performance Guidelines */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="text-sm text-slate-300 mb-2">Performance Guidelines</div>
        <div className="space-y-1 text-xs text-slate-400">
          <div className="flex items-start">
            <span className="mr-2 text-green-400">•</span>
            <span>Thrust-to-weight ratio should be 5:1 to 15:1 for stable flight</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-blue-400">•</span>
            <span>Higher specific impulse indicates better fuel efficiency</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-purple-400">•</span>
            <span>Longer burn time provides more gradual acceleration</span>
          </div>
          {motorAnalysis && motorAnalysis.thrustToWeight < 5 && (
            <div className="flex items-start">
              <span className="mr-2 text-red-400">⚠</span>
              <span>Low thrust-to-weight ratio may result in poor performance</span>
            </div>
          )}
          {motorAnalysis && motorAnalysis.thrustToWeight > 15 && (
            <div className="flex items-start">
              <span className="mr-2 text-yellow-400">⚠</span>
              <span>High thrust-to-weight ratio may cause excessive acceleration</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Available Motors Preview */}
      {availableMotors?.motors && Object.keys(availableMotors.motors).length > 1 && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <div className="text-sm text-slate-300 mb-2">Available Motors</div>
          <div className="space-y-1">
            {Object.entries(availableMotors.motors).map(([motorId, motor]: [string, any]) => (
              <div 
                key={motorId}
                className={`flex justify-between items-center p-2 rounded text-xs ${
                  motorId === rocket.motorId ? 'bg-orange-600/20 border border-orange-600/30' : 'bg-slate-700/50'
                }`}
              >
                <span className="text-slate-300">{motorId.toUpperCase()}</span>
                <div className="flex space-x-3 text-slate-400">
                  <span>{motor.averageThrust || motor.thrust || 0}N</span>
                  <span>{motor.totalImpulse || 0}N·s</span>
                  <span>{motor.type || 'solid'}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
} 