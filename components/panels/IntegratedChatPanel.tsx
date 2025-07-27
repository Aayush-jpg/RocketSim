import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth/AuthContext';
import ChatPanel from '../ChatPanel';

// Utility function to format numbers
function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'k';
  } else if (value >= 100) {
    return value.toFixed(0);
  } else if (value >= 10) {
    return value.toFixed(1);
  } else {
    return value.toFixed(2);
  }
}

// Metric card component
function MetricCard({ title, value, unit, color }: {
  title: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg p-3 min-w-0`}>
      <div className="text-xs text-white/70 mb-1 truncate">{title}</div>
      <div className="text-sm font-bold text-white truncate">
        {formatNumber(value)}{unit}
      </div>
    </div>
  );
}

// Performance bar component
function PerformanceBar({ title, value, max, color }: {
  title: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/70 truncate">{title}</span>
        <span className="text-white">{formatNumber(value)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// Enhanced metrics summary with better spacing and overflow handling
function InlineMetricsSummary({ metrics, isExpanded, onToggle }: {
  metrics: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div 
      className="mx-3 mb-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-white/10 overflow-hidden"
      layout
    >
      {/* Always visible compact header */}
      <motion.div 
        className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
        layout
      >
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0"></div>
            <span className="text-sm font-medium text-white truncate">Flight Performance</span>
          </div>
          <div className="flex items-center space-x-4 flex-shrink-0">
            {/* Key metrics always visible */}
            <div className="hidden sm:flex items-center space-x-3 text-xs">
              <span className="text-blue-300">{formatNumber(metrics.apogee)}m</span>
              <span className="text-green-300">{formatNumber(metrics.thrust)}N</span>
              <span className="text-purple-300">{formatNumber(metrics.thrustToWeight)}T/W</span>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Expandable detailed metrics */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Performance grid with better responsive layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <MetricCard title="Apogee" value={metrics.apogee} unit="m" color="bg-gray-800/80" />
                <MetricCard title="Max Speed" value={metrics.velocity} unit="m/s" color="bg-green-500/20" />
                <MetricCard title="Thrust" value={metrics.thrust} unit="N" color="bg-orange-500/20" />
                <MetricCard title="Mass" value={metrics.mass} unit="kg" color="bg-purple-500/20" />
                <MetricCard title="T/W Ratio" value={metrics.thrustToWeight} unit="" color="bg-pink-500/20" />
                <MetricCard title="Stability" value={metrics.stability} unit="cal" color="bg-cyan-500/20" />
              </div>

              {/* Engine specs in compact form with better overflow handling */}
              <div className="bg-black/20 rounded-lg p-3 min-w-0">
                <div className="flex items-center justify-between mb-2 min-w-0">
                  <span className="text-xs text-white/70 truncate">Engine: {metrics.motorId}</span>
                  <span className="text-xs text-white/50 flex-shrink-0">solid</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-white/60 flex-shrink-0">Burn Time:</span>
                    <span className="text-white font-mono truncate">{formatNumber(metrics.burnTime)}s</span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-white/60 flex-shrink-0">Delta-V:</span>
                    <span className="text-white font-mono truncate">{formatNumber(metrics.deltaV)}m/s</span>
                  </div>
                </div>
              </div>

              {/* Performance bars with proper spacing */}
              <div className="space-y-3">
                <PerformanceBar 
                  title="Altitude Performance" 
                  value={metrics.altitude} 
                  max={metrics.motorId?.includes('liquid') ? 50000 : 5000}
                  color="#3B82F6"
                />
                <PerformanceBar 
                  title="Thrust Efficiency" 
                  value={metrics.thrustToWeight} 
                  max={20}
                  color="#10B981"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Enhanced chat panel wrapper with metrics integration and better overflow handling
export default function IntegratedChatPanel({ 
  metrics, 
  metricsExpanded, 
  onToggleMetrics,
  activeAnalysis,
  onAnalysisClick,
  loadSessionId,
  projectId 
}: {
  metrics: any;
  metricsExpanded: boolean;
  onToggleMetrics: () => void;
  activeAnalysis?: string | null;
  onAnalysisClick?: (analysisId: string) => void;
  loadSessionId?: string | null;
  projectId?: string | null;
}) {
  const { user, userSession } = useAuth();

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">
      {/* Metrics summary that sits above chat with proper spacing */}
      <div className="flex-shrink-0">
        <InlineMetricsSummary 
          metrics={metrics}
          isExpanded={metricsExpanded}
          onToggle={onToggleMetrics}
        />
      </div>
      
      {/* Chat panel takes remaining space with proper overflow handling */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel 
          activeAnalysis={activeAnalysis}
          onAnalysisClick={onAnalysisClick}
          loadSessionId={loadSessionId}
          projectId={projectId}
        />
      </div>
    </div>
  );
} 