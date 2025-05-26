import React, { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

export default function StabilityTab() {
  const { stabilityAnalysis, rocket } = useRocket();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState('comprehensive');

  const runStabilityAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/analyze/stability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rocket,
          environment: {
            windSpeed: 0,
            windDirection: 0
          },
          analysisType
        }),
      });

      if (!response.ok) {
        throw new Error(`Stability analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      useRocket.getState().setStabilityAnalysis(result);
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('stabilityAnalysis', { 
        detail: { result } 
      }));
      
    } catch (error) {
      console.error('Stability analysis failed:', error);
      // Show error notification
      window.dispatchEvent(new CustomEvent('notification', {
        detail: { 
          message: `Stability analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          type: 'error' 
        }
      }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!stabilityAnalysis && !isAnalyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">⚖️</div>
          <p>No stability analysis available</p>
          <p className="text-sm mt-2">Run stability analysis to see results</p>
        </div>
        
        {/* Analysis Controls */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Stability Analysis</h4>
          <div className="space-y-2">
            <label className="block text-xs text-slate-400">Analysis Type</label>
            <select
              value={analysisType}
              onChange={(e) => setAnalysisType(e.target.value)}
              className="w-full bg-slate-700 text-white text-sm rounded px-3 py-2"
            >
              <option value="comprehensive">Comprehensive Analysis</option>
              <option value="static">Static Margin Only</option>
              <option value="dynamic">Dynamic Stability</option>
            </select>
          </div>
          <button
            onClick={runStabilityAnalysis}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            🔍 Analyze Stability
          </button>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-4">
        <div className="text-center text-slate-400 py-8">
          <div className="text-4xl mb-2">⏳</div>
          <p>Analyzing stability...</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  const staticMargin = stabilityAnalysis?.static_margin || stabilityAnalysis?.staticMargin || 0;
  const centerOfPressure = stabilityAnalysis?.center_of_pressure || 0;
  const centerOfMass = stabilityAnalysis?.center_of_mass || 0;
  const stabilityRating = stabilityAnalysis?.stability_rating || stabilityAnalysis?.rating || 'unknown';
  const recommendations = stabilityAnalysis?.recommendation ? [stabilityAnalysis.recommendation] : 
                         stabilityAnalysis?.recommendations || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Stability Analysis</h3>
        <button
          onClick={runStabilityAnalysis}
          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
        >
          🔄 Re-analyze
        </button>
      </div>
      
      {/* Static Margin */}
      <motion.div 
        className="bg-slate-800 rounded-lg p-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Static Margin</span>
          <span className={`text-lg font-bold ${
            staticMargin < 1 ? 'text-red-400' :
            staticMargin > 3 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {staticMargin.toFixed(2)} cal
          </span>
        </div>
        
        {/* Stability Bar */}
        <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
          <motion.div 
            className={`h-3 rounded-full ${
              staticMargin < 1 ? 'bg-red-500' :
              staticMargin > 3 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(staticMargin * 20, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        
        {/* Reference lines */}
        <div className="flex justify-between text-xs text-slate-400">
          <span>0</span>
          <span>1.0 (min)</span>
          <span>3.0 (max)</span>
          <span>5.0+</span>
        </div>
      </motion.div>

      {/* Stability Rating */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Stability Rating</span>
          <span className={`text-sm font-semibold capitalize ${
            stabilityRating === 'unstable' ? 'text-red-400' :
            stabilityRating === 'marginally_stable' ? 'text-yellow-400' :
            stabilityRating === 'stable' ? 'text-green-400' :
            stabilityRating === 'overstable' ? 'text-orange-400' : 'text-slate-400'
          }`}>
            {stabilityRating.replace('_', ' ')}
          </span>
        </div>
        
        {/* Rating Description */}
        <div className="text-xs text-slate-400">
          {stabilityRating === 'unstable' && 'Rocket may tumble or become uncontrollable'}
          {stabilityRating === 'marginally_stable' && 'Minimal stability, sensitive to disturbances'}
          {stabilityRating === 'stable' && 'Good stability for normal flight conditions'}
          {stabilityRating === 'overstable' && 'Very stable but may reduce altitude performance'}
          {stabilityRating === 'unknown' && 'Stability rating not determined'}
        </div>
      </div>

      {/* Center of Pressure and Mass */}
      {(centerOfPressure > 0 || centerOfMass > 0) && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Center Analysis</div>
          <div className="space-y-2">
            {centerOfPressure > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Center of Pressure:</span>
                <span className="text-blue-400">{centerOfPressure.toFixed(2)} m</span>
              </div>
            )}
            {centerOfMass > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Center of Mass:</span>
                <span className="text-green-400">{centerOfMass.toFixed(2)} m</span>
              </div>
            )}
            {centerOfPressure > 0 && centerOfMass > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Separation:</span>
                <span className="text-purple-400">{Math.abs(centerOfPressure - centerOfMass).toFixed(2)} m</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Details */}
      {stabilityAnalysis?.analysisType && (
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-sm text-slate-300 mb-2">Analysis Details</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="text-blue-400 capitalize">{stabilityAnalysis.analysisType}</span>
            </div>
            {stabilityAnalysis.timestamp && (
              <div className="flex justify-between">
                <span>Timestamp:</span>
                <span className="text-slate-400">{new Date(stabilityAnalysis.timestamp).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div 
          className="bg-slate-800 rounded-lg p-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="text-sm text-slate-300 mb-2">Recommendations</div>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <motion.div 
                key={index} 
                className="text-xs text-slate-400 flex items-start"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * index }}
              >
                <span className="mr-2 text-blue-400">•</span>
                <span>{rec}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stability Improvement Suggestions */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="text-sm text-slate-300 mb-2">Stability Tips</div>
        <div className="space-y-1 text-xs text-slate-400">
          <div className="flex items-start">
            <span className="mr-2 text-green-400">•</span>
            <span>Increase fin area to move center of pressure aft</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-green-400">•</span>
            <span>Add nose weight to move center of mass forward</span>
          </div>
          <div className="flex items-start">
            <span className="mr-2 text-green-400">•</span>
            <span>Optimal stability margin is 1.0-2.0 calibers</span>
          </div>
        </div>
      </div>
    </div>
  );
} 