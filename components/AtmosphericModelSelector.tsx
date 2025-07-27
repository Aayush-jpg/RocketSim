"use client";

import { useState, useEffect } from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface AtmosphericModelsData {
  available_models: string[];
  default_model: string;
  descriptions: Record<string, string>;
  capabilities?: Record<string, any>;
  use_cases?: Record<string, string>;
  requirements: Record<string, string>;
}

import { EnvironmentConfig } from '@/types/rocket';

interface AtmosphericModelSelectorProps {
  environment: EnvironmentConfig;
  setEnvironment: (env: EnvironmentConfig) => void;
}

const ATMOSPHERE_MODELS = [
  { value: 'standard', label: 'Standard Atmosphere', description: 'ISA model, good for general use.' },
  { value: 'forecast', label: 'Live Weather Forecast', description: 'Real-time GFS data for launch day.' },
  { value: 'nrlmsise', label: 'NRLMSISE-00', description: 'NASA model for high-altitude flights.' },
  { value: 'custom', label: 'Custom Profile', description: 'User-defined atmospheric data.' },
];

export default function AtmosphericModelSelector({ environment, setEnvironment }: AtmosphericModelSelectorProps) {
  const [modelsData, setModelsData] = useState<AtmosphericModelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/environment/atmospheric-models');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch atmospheric models: ${response.statusText}`);
        }
        
        const data = await response.json();
        setModelsData(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch atmospheric models:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        
        // Set fallback data
        setModelsData({
          available_models: ["standard", "forecast", "custom"],
          default_model: "standard",
          descriptions: {
            standard: "International Standard Atmosphere (ISA)",
            forecast: "Real-time weather data",
            custom: "User-defined conditions"
          },
          requirements: {
            standard: "No additional data required",
            forecast: "Internet connection required",
            custom: "Custom profile required"
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const handleModelChange = (selectedModel: string) => {
    const updatedEnvironment = {
      ...environment,
      atmospheric_model: selectedModel as "standard" | "forecast" | "custom" | "nrlmsise"
    };
    
    setEnvironment(updatedEnvironment);
    console.log(`✅ Atmospheric model changed to: ${selectedModel}`);
  };

  const getModelIcon = (model: string) => {
    switch (model) {
      case 'standard': return '📊';
      case 'forecast': return '🌤️';
      case 'nrlmsise': return '🛰️';
      case 'custom': return '🔬';
      default: return '🌍';
    }
  };

  const getModelColor = (model: string) => {
    switch (model) {
      case 'standard': return 'text-blue-400';
      case 'forecast': return 'text-green-400';
      case 'nrlmsise': return 'text-cyan-400';
      case 'custom': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-white/5 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/2 mb-3"></div>
          <div className="h-8 bg-slate-700 rounded mb-2"></div>
          <div className="h-3 bg-slate-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-slate-800/50 border border-white/5 rounded-lg p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🌍</span>
        <h3 className="font-medium text-white">Atmospheric Model</h3>
        {error && (
          <span className="text-xs text-orange-400">⚠️ Using fallback data</span>
        )}
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">
          Select Atmospheric Model
        </label>
        
        <select
          value={environment.atmospheric_model || modelsData?.default_model || 'standard'}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full bg-slate-700/70 border border-white/10 text-white text-sm rounded-lg px-4 py-3 hover:bg-slate-700 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
        >
          {ATMOSPHERE_MODELS.map((model) => (
            <option key={model.value} value={model.value}>
              {getModelIcon(model.value)} {model.label}
            </option>
          ))}
        </select>
      </div>

      {/* Current Model Info */}
      {modelsData && environment.atmospheric_model && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-700/30 rounded-lg p-3 border border-white/5"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{getModelIcon(environment.atmospheric_model)}</span>
            <span className={`font-medium ${getModelColor(environment.atmospheric_model)}`}>
              {environment.atmospheric_model.charAt(0).toUpperCase() + environment.atmospheric_model.slice(1)} Model
            </span>
          </div>
          
          <p className="text-xs text-slate-300 mb-2">
            {modelsData.descriptions[environment.atmospheric_model]}
          </p>
          
          <div className="text-xs text-gray-400">
            <strong>Requirements:</strong> {modelsData.requirements[environment.atmospheric_model]}
          </div>
          
          {/* Model Capabilities */}
          {modelsData.capabilities && modelsData.capabilities[environment.atmospheric_model] && (
            <div className="mt-2 text-xs">
              <div className="text-slate-400">
                <strong>Features:</strong> {modelsData.capabilities[environment.atmospheric_model].features?.join(', ')}
              </div>
              <div className="text-slate-400">
                <strong>Altitude Range:</strong> {modelsData.capabilities[environment.atmospheric_model].altitude_range_m?.[0]}m - {modelsData.capabilities[environment.atmospheric_model].altitude_range_m?.[1]}m
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Use Case Recommendations */}
      {modelsData?.use_cases && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-black/40 rounded-lg p-3 border border-gray-600/30"
        >
          <h4 className="font-medium text-gray-100 mb-2 text-sm">💡 Recommendations</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(modelsData.use_cases).map(([useCase, recommendedModel]) => (
              <div key={useCase} className="flex justify-between">
                <span className="text-gray-200 capitalize">{useCase}:</span>
                <span className={`font-medium ${getModelColor(recommendedModel)}`}>
                  {recommendedModel}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
} 