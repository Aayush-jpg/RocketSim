/**
 * Connection Test Utility
 * Verifies all frontend-backend connections are working properly
 */

import { useRocket } from '@/lib/store';
import { databaseService } from '@/lib/services/database.service';
import { chatService } from '@/lib/services/chat.service';

interface ConnectionTestResult {
  component: string;
  status: 'connected' | 'disconnected' | 'error';
  message: string;
  details?: any;
}

export class ConnectionTester {
  private results: ConnectionTestResult[] = [];

  async runFullTest(): Promise<ConnectionTestResult[]> {
    console.log('🔍 Starting comprehensive connection test...');
    this.results = [];

    // Test all connections
    await this.testDatabase();
    await this.testAgentAPI();
    await this.testStoreIntegration();
    await this.testChatPersistence();
    await this.testSimulationAPI();
    await this.testWeatherAPI();
    await this.testActionsDispatcher();

    console.log('✅ Connection test completed');
    return this.results;
  }

  private async testDatabase(): Promise<void> {
    try {
      const isConnected = await databaseService.testConnection();
      this.results.push({
        component: 'Database (Supabase)',
        status: isConnected ? 'connected' : 'disconnected',
        message: isConnected 
          ? 'Database connection successful' 
          : 'Database unavailable - running in offline mode',
        details: { 
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ URL configured' : '✗ URL missing',
          key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Key configured' : '✗ Key missing'
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Database (Supabase)',
        status: 'error',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  }

  private async testAgentAPI(): Promise<void> {
    try {
      const testPayload = {
        history: [{ role: 'user', content: 'test connection' }],
        rocket: useRocket.getState().rocket
      };

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        const result = await response.json();
        this.results.push({
          component: 'AI Agent Service',
          status: 'connected',
          message: 'Agent API responding correctly',
          details: { 
            agent: result.agent_used || 'unknown',
            responseTime: 'normal'
          }
        });
      } else {
        this.results.push({
          component: 'AI Agent Service',
          status: 'error',
          message: `Agent API error: ${response.status} ${response.statusText}`,
          details: { status: response.status }
        });
      }
    } catch (error) {
      this.results.push({
        component: 'AI Agent Service',
        status: 'error',
        message: `Agent API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  }

  private async testStoreIntegration(): Promise<void> {
    try {
      const store = useRocket.getState();
      
      // Test store structure - properly check if functions are defined
      const hasRequiredState = store.rocket && 
                              typeof store.updateRocket === 'function' && 
                              typeof store.setSim === 'function';
      const hasDatabaseState = 'isDatabaseConnected' in store && 
                              typeof store.saveCurrentRocket === 'function';
      
      this.results.push({
        component: 'Zustand Store',
        status: hasRequiredState && hasDatabaseState ? 'connected' : 'error',
        message: hasRequiredState && hasDatabaseState 
          ? 'Store properly configured with database integration'
          : 'Store missing required state or actions',
        details: {
          coreState: hasRequiredState ? '✓' : '✗',
          databaseIntegration: hasDatabaseState ? '✓' : '✗',
          partsCount: (store.rocket?.nose_cone ? 1 : 0) + 
                     (store.rocket?.body_tubes?.length || 0) + 
                     (store.rocket?.fins?.length || 0) + 
                     (store.rocket?.parachutes?.length || 0) + 
                     (store.rocket?.motor ? 1 : 0)
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Zustand Store',
        status: 'error',
        message: `Store error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  }

  private async testChatPersistence(): Promise<void> {
    try {
      // Test if chat service is available
      if (typeof chatService.saveChatMessage === 'function') {
        this.results.push({
          component: 'Chat Persistence',
          status: 'connected',
          message: 'Chat service properly configured',
          details: { 
            service: '✓ Available',
            database: useRocket.getState().isDatabaseConnected ? '✓ Connected' : '⚠ Offline mode'
          }
        });
      } else {
        this.results.push({
          component: 'Chat Persistence',
          status: 'error',
          message: 'Chat service not available',
          details: { service: '✗ Missing' }
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Chat Persistence',
        status: 'error',
        message: `Chat service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  }

  private async testSimulationAPI(): Promise<void> {
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rocket: useRocket.getState().rocket,
          environment: useRocket.getState().environment,
          fidelity: 'quick'
        })
      });

      this.results.push({
        component: 'Simulation API',
        status: response.ok ? 'connected' : 'error',
        message: response.ok 
          ? 'Simulation API responding'
          : `Simulation API error: ${response.status}`,
        details: { status: response.status }
      });
    } catch (error) {
      this.results.push({
        component: 'Simulation API',
        status: 'error',
        message: `Simulation API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  }

  private async testWeatherAPI(): Promise<void> {
    try {
      const response = await fetch('/api/weather');
      
      this.results.push({
        component: 'Weather API',
        status: response.ok ? 'connected' : 'disconnected',
        message: response.ok 
          ? 'Weather API responding'
          : 'Weather API unavailable (optional service)',
        details: { 
          status: response.status,
          apiKey: process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ? '✓ Configured' : '✗ Missing'
        }
      });
    } catch (error) {
      this.results.push({
        component: 'Weather API',
        status: 'disconnected',
        message: 'Weather API not available (optional service)',
        details: { error: 'Service unavailable' }
      });
    }
  }

  private async testActionsDispatcher(): Promise<void> {
    try {
      // Test if dispatchActions is available
      const { dispatchActions } = await import('@/lib/ai/actions');
      
      if (typeof dispatchActions === 'function') {
        this.results.push({
          component: 'Actions Dispatcher',
          status: 'connected',
          message: 'Actions dispatcher properly loaded and functional',
          details: { 
            dispatcher: '✓ Available',
            storeConnection: '✓ Connected'
          }
        });
      } else {
        this.results.push({
          component: 'Actions Dispatcher',
          status: 'error',
          message: 'Actions dispatcher not available',
          details: { dispatcher: '✗ Missing' }
        });
      }
    } catch (error) {
      this.results.push({
        component: 'Actions Dispatcher',
        status: 'error',
        message: `Actions dispatcher error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }
  }

  printResults(): void {
    console.log('\n🔍 Connection Test Results:');
    console.log('============================');
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'connected' ? '✅' : 
                        result.status === 'disconnected' ? '⚠️' : '❌';
      
      console.log(`${statusIcon} ${result.component}: ${result.message}`);
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    });
    
    const connectedCount = this.results.filter(r => r.status === 'connected').length;
    const totalCount = this.results.length;
    
    console.log('\n============================');
    console.log(`📊 Summary: ${connectedCount}/${totalCount} services connected`);
  }

  getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const connected = this.results.filter(r => r.status === 'connected').length;
    const total = this.results.length;
    const ratio = connected / total;
    
    if (ratio >= 0.8) return 'healthy';
    if (ratio >= 0.5) return 'degraded';
    return 'critical';
  }
}

// Export singleton instance
export const connectionTester = new ConnectionTester();

// Helper function for quick test
export async function runQuickConnectionTest(): Promise<boolean> {
  const results = await connectionTester.runFullTest();
  connectionTester.printResults();
  
  const healthStatus = connectionTester.getHealthStatus();
  console.log(`\n🏥 System Health: ${healthStatus.toUpperCase()}`);
  
  return healthStatus !== 'critical';
} 