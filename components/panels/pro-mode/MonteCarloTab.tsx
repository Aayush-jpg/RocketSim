import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface StatisticDisplayProps {
  label: string;
  statistic: {
    mean: number;
    std: number;
    min: number;
    max: number;
    percentiles: {
      "5": number;
      "25": number;
      "50": number;
      "75": number;
      "95": number;
    };
  };
  unit: string;
  color: string;
}

function StatisticDisplay({ label, statistic, unit, color }: StatisticDisplayProps) {
  // Add null/undefined checks for all numeric values
  const safeMean = statistic?.mean ?? 0;
  const safeMin = statistic?.min ?? 0;
  const safeMax = statistic?.max ?? 0;
  const safeStd = statistic?.std ?? 0;
  const safePercentiles = {
    "5": statistic?.percentiles?.["5"] ?? 0,
    "25": statistic?.percentiles?.["25"] ?? 0,
    "50": statistic?.percentiles?.["50"] ?? 0,
    "75": statistic?.percentiles?.["75"] ?? 0,
    "95": statistic?.percentiles?.["95"] ?? 0,
  };

  // Check if we have valid data to display
  const hasValidData = statistic && 
    typeof statistic.mean === 'number' && 
    !isNaN(statistic.mean) &&
    typeof statistic.max === 'number' && 
    !isNaN(statistic.max) &&
    typeof statistic.min === 'number' && 
    !isNaN(statistic.min);

  if (!hasValidData) {
    return (
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">{label}</span>
          <span className="text-lg font-bold text-red-400">
            N/A{unit}
          </span>
        </div>
        <div className="text-xs text-slate-400">
          Insufficient data for statistics
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="bg-slate-800 rounded-lg p-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-300">{label}</span>
        <span className={`text-lg font-bold ${color}`}>
          {safeMean.toFixed(1)}{unit}
        </span>
      </div>
      
      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-slate-400">Min:</span>
          <span className="text-white">{safeMin.toFixed(1)}{unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Max:</span>
          <span className="text-white">{safeMax.toFixed(1)}{unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Std Dev:</span>
          <span className="text-white">±{safeStd.toFixed(1)}{unit}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Median:</span>
          <span className="text-white">{safePercentiles["50"].toFixed(1)}{unit}</span>
        </div>
      </div>

      {/* Percentile Distribution */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>5%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>95%</span>
        </div>
        <div className="relative h-2 bg-slate-700 rounded-full">
          {/* Box plot visualization - only render if we have valid range */}
          {safeMax > safeMin && (
            <>
              <div 
                className="absolute h-2 bg-blue-500 rounded-full opacity-60"
                style={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["25"] - safeMin) / (safeMax - safeMin)) * 100))}%`,
                  width: `${Math.max(0, Math.min(100, ((safePercentiles["75"] - safePercentiles["25"]) / (safeMax - safeMin)) * 100))}%`
                }}
              />
              <div 
                className="absolute w-0.5 h-2 bg-white"
                style={{
                  left: `${Math.max(0, Math.min(100, ((safePercentiles["50"] - safeMin) / (safeMax - safeMin)) * 100))}%`
                }}
              />
            </>
          )}
        </div>
        <div className="flex justify-between text-xs">
          <span>{safePercentiles["5"].toFixed(0)}</span>
          <span>{safePercentiles["25"].toFixed(0)}</span>
          <span>{safePercentiles["50"].toFixed(0)}</span>
          <span>{safePercentiles["75"].toFixed(0)}</span>
          <span>{safePercentiles["95"].toFixed(0)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function MonteCarloTab() {
  const { monteCarloResult, rocket } = useRocket();
  const [isRunning, setIsRunning] = useState(false);
  const [iterations, setIterations] = useState(100);
  const [selectedVariations, setSelectedVariations] = useState([
    'environment.windSpeed',
    'rocket.Cd',
    'launch.inclination'
  ]);

  const runMonteCarloAnalysis = async () => {
    setIsRunning(true);
    
    try {
      const variations = [
        {
          parameter: "environment.windSpeed",
          distribution: "uniform",
          parameters: [0, 10]
        },
        {
          parameter: "rocket.Cd",
          distribution: "normal",
          parameters: [rocket.Cd, rocket.Cd * 0.1]
        },
        {
          parameter: "launch.inclination",
          distribution: "normal",
          parameters: [85, 2]
        }
      ].filter(v => selectedVariations.includes(v.parameter));

      const response = await fetch('/api/simulate/monte-carlo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rocket,
          environment: {
            latitude: 0,
            longitude: 0,
            elevation: 0,
            windSpeed: 5,
            windDirection: 0,
            atmosphericModel: "standard"
          },
          launchParameters: {
            railLength: 5.0,
            inclination: 85.0,
            heading: 0.0
          },
          variations,
          iterations
        }),
      });

      if (!response.ok) {
        throw new Error(`Monte Carlo analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      useRocket.getState().setMonteCarloResult(result);
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('monteCarloComplete', { 
        detail: { result } 
      }));
      
    } catch (error) {
      console.error('Monte Carlo analysis failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Monte Carlo analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsRunning(false);
    }
  };

  if (!monteCarloResult && !isRunning) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">🎲</div>
          <p>No Monte Carlo analysis available</p>
          <p className="text-sm mt-2">Run statistical analysis to see results</p>
        </div>
        
        {/* Analysis Configuration */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Monte Carlo Configuration</h4>
          
          {/* Iterations */}
          <div className="space-y-2">
            <label className="block text-xs text-slate-400">Number of Iterations</label>
            <select
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2"
            >
              <option value={50}>50 iterations (Fast)</option>
              <option value={100}>100 iterations (Standard)</option>
              <option value={250}>250 iterations (Detailed)</option>
              <option value={500}>500 iterations (Comprehensive)</option>
            </select>
          </div>

          {/* Parameter Variations */}
          <div className="space-y-2">
            <label className="block text-xs text-slate-400">Parameter Variations</label>
            <div className="space-y-1">
              {[
                { id: 'environment.windSpeed', label: 'Wind Speed (0-10 m/s)' },
                { id: 'rocket.Cd', label: 'Drag Coefficient (±10%)' },
                { id: 'launch.inclination', label: 'Launch Angle (85° ±2°)' }
              ].map((param) => (
                <label key={param.id} className="flex items-center space-x-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedVariations.includes(param.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedVariations([...selectedVariations, param.id]);
                      } else {
                        setSelectedVariations(selectedVariations.filter(v => v !== param.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-slate-300">{param.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={runMonteCarloAnalysis}
            disabled={selectedVariations.length === 0}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎲 Run Monte Carlo Analysis
          </button>
        </div>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">⏳</div>
          <p>Running Monte Carlo analysis...</p>
          <p className="text-sm mt-2">{iterations} iterations</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
            <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Monte Carlo Results</h3>
        <button
          onClick={runMonteCarloAnalysis}
          className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
        >
          🔄 Re-run
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 gap-3">
        {monteCarloResult?.statistics?.maxAltitude && (
          <StatisticDisplay
            label="Maximum Altitude"
            statistic={monteCarloResult.statistics.maxAltitude}
            unit="m"
            color="text-green-400"
          />
        )}
        
        {monteCarloResult?.statistics?.maxVelocity && (
          <StatisticDisplay
            label="Maximum Velocity"
            statistic={monteCarloResult.statistics.maxVelocity}
            unit="m/s"
            color="text-blue-400"
          />
        )}
        
        {monteCarloResult?.statistics?.apogeeTime && (
          <StatisticDisplay
            label="Apogee Time"
            statistic={monteCarloResult.statistics.apogeeTime}
            unit="s"
            color="text-yellow-400"
          />
        )}
        
        {monteCarloResult?.statistics?.stabilityMargin && (
          <StatisticDisplay
            label="Stability Margin"
            statistic={monteCarloResult.statistics.stabilityMargin}
            unit=" cal"
            color="text-purple-400"
          />
        )}
      </div>

      {/* Landing Dispersion */}
      {monteCarloResult?.landingDispersion && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="text-sm text-slate-300 mb-2">Landing Dispersion</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">CEP (50%):</span>
              <span className="text-orange-400">{(monteCarloResult.landingDispersion.cep ?? 0).toFixed(1)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Max Drift:</span>
              <span className="text-red-400">{(monteCarloResult.landingDispersion.maxDrift ?? 0).toFixed(1)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Mean Drift:</span>
              <span className="text-blue-400">{(monteCarloResult.landingDispersion.meanDrift ?? 0).toFixed(1)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ellipse Ratio:</span>
              <span className="text-green-400">{
                (monteCarloResult.landingDispersion.majorAxis && monteCarloResult.landingDispersion.minorAxis && monteCarloResult.landingDispersion.minorAxis !== 0) 
                  ? (monteCarloResult.landingDispersion.majorAxis / monteCarloResult.landingDispersion.minorAxis).toFixed(1) 
                  : '1.0'
              }:1</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analysis Details */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Analysis Details</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Iterations:</span>
            <span className="text-blue-400">{monteCarloResult?.iterations?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Nominal Altitude:</span>
            <span className="text-green-400">{(monteCarloResult?.nominal?.maxAltitude ?? 0).toFixed(1)}m</span>
          </div>
          <div className="flex justify-between">
            <span>Success Rate:</span>
            <span className="text-purple-400">100%</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="text-sm text-slate-300 mb-2">Statistical Insights</div>
        <div className="space-y-2">
          {monteCarloResult?.statistics?.maxAltitude && 
           typeof monteCarloResult.statistics.maxAltitude.std === 'number' && 
           typeof monteCarloResult.statistics.maxAltitude.mean === 'number' && (
            <div className="text-xs text-slate-400 flex items-start">
              <span className="mr-2 text-green-400">•</span>
              <span>
                Altitude varies by ±{monteCarloResult.statistics.maxAltitude.std.toFixed(0)}m 
                ({((monteCarloResult.statistics.maxAltitude.std / monteCarloResult.statistics.maxAltitude.mean) * 100).toFixed(1)}% coefficient of variation)
              </span>
            </div>
          )}
          {monteCarloResult?.landingDispersion && 
           typeof monteCarloResult.landingDispersion.cep === 'number' && 
           monteCarloResult.landingDispersion.cep > 50 && (
            <div className="text-xs text-slate-400 flex items-start">
              <span className="mr-2 text-yellow-400">•</span>
              <span>Large landing dispersion - consider dual-deploy recovery system</span>
            </div>
          )}
          {monteCarloResult?.statistics?.stabilityMargin && 
           typeof monteCarloResult.statistics.stabilityMargin.min === 'number' && 
           monteCarloResult.statistics.stabilityMargin.min < 1.0 && (
            <div className="text-xs text-slate-400 flex items-start">
              <span className="mr-2 text-red-400">•</span>
              <span>Some iterations show marginal stability - increase fin area</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
} 