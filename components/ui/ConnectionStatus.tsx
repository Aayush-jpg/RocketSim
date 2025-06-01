"use client"

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { connectionTester, ConnectionTester } from '@/lib/utils/connectionTest';

interface ConnectionStatusProps {
  showDetailed?: boolean;
  className?: string;
}

interface ConnectionResult {
  component: string;
  status: 'connected' | 'disconnected' | 'error';
  message: string;
  details?: any;
}

export default function ConnectionStatus({ showDetailed = false, className = '' }: ConnectionStatusProps) {
  const [results, setResults] = useState<ConnectionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'critical'>('healthy');
  const [showFullTest, setShowFullTest] = useState(false);

  useEffect(() => {
    runConnectionTest();
  }, []);

  const runConnectionTest = async () => {
    setIsLoading(true);
    try {
      const testResults = await connectionTester.runFullTest();
      setResults(testResults);
      setHealthStatus(connectionTester.getHealthStatus());
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'disconnected': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'disconnected': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getHealthColor = () => {
    switch (healthStatus) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const connectedCount = results.filter(r => r.status === 'connected').length;
  const totalCount = results.length;

  if (!showDetailed) {
    // Simple status indicator
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          healthStatus === 'healthy' ? 'bg-green-400' : 
          healthStatus === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
        }`} />
        <span className={`text-xs ${getHealthColor()}`}>
          {isLoading ? 'Testing...' : `${connectedCount}/${totalCount} Connected`}
        </span>
        <button
          onClick={() => setShowFullTest(!showFullTest)}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {showFullTest ? 'Hide' : 'Details'}
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">System Status</h3>
        <div className="flex items-center space-x-2">
          <span className={`text-xs ${getHealthColor()}`}>
            {healthStatus.toUpperCase()}
          </span>
          <button
            onClick={runConnectionTest}
            disabled={isLoading}
            className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Testing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-black/20 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-300">Services Connected</span>
          <span className={`text-xs font-mono ${getHealthColor()}`}>
            {connectedCount}/{totalCount}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <motion.div
            className={`h-1.5 rounded-full ${
              healthStatus === 'healthy' ? 'bg-green-400' : 
              healthStatus === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${(connectedCount / totalCount) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Detailed Results */}
      <AnimatePresence>
        {showFullTest && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {results.map((result, index) => (
              <motion.div
                key={result.component}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-black/20 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{getStatusIcon(result.status)}</span>
                    <span className="text-xs font-medium text-white">
                      {result.component}
                    </span>
                  </div>
                  <span className={`text-xs ${getStatusColor(result.status)}`}>
                    {result.status}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mb-2">{result.message}</p>
                
                {result.details && (
                  <div className="text-xs space-y-1">
                    {Object.entries(result.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-gray-400">
                        <span>{key}:</span>
                        <span className="font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple status badge for navigation bars
export function StatusBadge({ className = '' }: { className?: string }) {
  return <ConnectionStatus showDetailed={false} className={className} />;
}

// Full status panel for admin/debug views
export function StatusPanel({ className = '' }: { className?: string }) {
  return <ConnectionStatus showDetailed={true} className={className} />;
} 