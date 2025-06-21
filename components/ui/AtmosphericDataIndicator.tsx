import React from 'react';
import { useRocket } from '@/lib/store';
import { motion } from 'framer-motion';

interface AtmosphericDataIndicatorProps {
  compact?: boolean;
}

export default function AtmosphericDataIndicator({ compact = false }: AtmosphericDataIndicatorProps) {
  const { environment } = useRocket();

  const getIndicatorData = () => {
    switch (environment.atmosphericModel) {
      case 'forecast':
        return {
          icon: '🌤️',
          label: 'Live Weather',
          description: 'Using real-time atmospheric data',
          color: 'bg-green-500',
          quality: 'High',
          hasProfile: !!environment.atmospheric_profile,
          profilePoints: environment.atmospheric_profile?.altitude?.length || 0
        };
      case 'nrlmsise':
        return {
          icon: '🛰️',
          label: 'NRLMSISE-00',
          description: 'NASA high-altitude model',
          color: 'bg-cyan-500',
          quality: 'Research',
          hasProfile: true,
          profilePoints: 241 // Standard NRLMSISE profile points
        };
      case 'custom':
        return {
          icon: '🔬',
          label: 'Custom Profile',
          description: 'User-defined conditions',
          color: 'bg-purple-500',
          quality: 'Custom',
          hasProfile: !!environment.atmospheric_profile,
          profilePoints: environment.atmospheric_profile?.altitude?.length || 0
        };
      default:
        return {
          icon: '📊',
          label: 'Standard ISA',
          description: 'International Standard Atmosphere',
          color: 'bg-blue-500',
          quality: 'Standard',
          hasProfile: false,
          profilePoints: 0
        };
    }
  };

  const indicator = getIndicatorData();

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-lg border border-white/10">
        <span className="text-lg">{indicator.icon}</span>
        <div>
          <div className="text-sm font-medium text-white">{indicator.label}</div>
          <div className="text-xs text-gray-400">{indicator.quality} Accuracy</div>
        </div>
        {indicator.hasProfile && (
          <div className="ml-auto">
            <div className={`w-2 h-2 rounded-full ${indicator.color}`}></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/5 rounded-lg border border-white/10 p-4"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{indicator.icon}</span>
        <div>
          <h3 className="font-medium text-white">{indicator.label}</h3>
          <p className="text-sm text-gray-400">{indicator.description}</p>
        </div>
        <div className="ml-auto">
          <div className={`px-2 py-1 rounded text-xs font-medium text-white ${indicator.color}`}>
            {indicator.quality}
          </div>
        </div>
      </div>

      {/* Data Quality Metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Location Data:</span>
          <div className="font-medium text-white">
            {environment.latitude?.toFixed(4) || '0.0000'}°, {environment.longitude?.toFixed(4) || '0.0000'}°
          </div>
        </div>
        <div>
          <span className="text-gray-400">Wind Conditions:</span>
          <div className="font-medium text-white">
            {environment.wind_speed_m_s || 0} m/s @ {environment.wind_direction_deg || 0}°
          </div>
        </div>
      </div>

      {/* Atmospheric Profile Info */}
      {indicator.hasProfile && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${indicator.color}`}></div>
            <span className="text-sm text-white">
              {indicator.profilePoints} altitude levels loaded
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Real atmospheric profile includes temperature, pressure, density, and wind data
          </div>
        </div>
      )}

      {/* Usage Recommendations */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <h4 className="text-sm font-medium text-white mb-2">Simulation Impact</h4>
        <div className="space-y-1 text-xs text-gray-300">
          {environment.atmosphericModel === 'forecast' && (
            <>
              <div>• Real wind data affects trajectory accuracy</div>
              <div>• Temperature/pressure impact drag calculations</div>
              <div>• Ideal for actual launch planning</div>
            </>
          )}
          {environment.atmosphericModel === 'nrlmsise' && (
            <>
              <div>• High-altitude temperature profiles (0-120km)</div>
              <div>• Includes space weather effects</div>
              <div>• Best for high-altitude research rockets</div>
            </>
          )}
          {environment.atmosphericModel === 'standard' && (
            <>
              <div>• Baseline ISA model for comparison</div>
              <div>• Good for educational use</div>
              <div>• Consider upgrading to forecast for real launches</div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
} 