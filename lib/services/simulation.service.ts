/**
 * ROCKETv1 - Simulation Data Management Service
 * =============================================
 * 
 * This service manages all aspects of rocket simulation data persistence, analysis results storage,
 * and performance metrics tracking. It provides a comprehensive interface for storing and retrieving
 * simulation results from various physics engines (quick simulations, RocketPy, Monte Carlo analysis).
 * 
 * **Core Responsibilities:**
 * - **Simulation Persistence**: Store simulation results with full trajectory data and flight events
 * - **Analysis Storage**: Persist stability, Monte Carlo, motor, and recovery analysis results
 * - **Performance Tracking**: Record and analyze simulation performance metrics over time
 * - **Result Comparison**: Enable comparison between different simulation runs and configurations
 * - **Session Management**: Track user simulation activity and update session statistics
 * 
 * **Simulation Types Supported:**
 * - **Standard Simulations**: Quick physics calculations for rapid design iteration
 * - **Enhanced Simulations**: Medium-fidelity simulations with environmental factors
 * - **Professional Simulations**: High-fidelity RocketPy 6-DOF simulations with full physics
 * - **Monte Carlo Analysis**: Statistical uncertainty quantification with multiple runs
 * - **Stability Analysis**: Static and dynamic stability calculations
 * 
 * **Data Management:**
 * - **Trajectory Storage**: Complete flight path data stored as JSONB in PostgreSQL
 * - **Flight Events**: Discrete events (ignition, burnout, apogee, recovery) with timestamps
 * - **Analysis Results**: Structured storage of engineering analysis outputs
 * - **Performance Metrics**: Track simulation computation times and resource usage
 * - **Environment Integration**: Link simulations to specific weather and launch conditions
 * 
 * **Database Integration:**
 * - **Result Caching**: Intelligent caching of simulation results for identical configurations
 * - **Type Safety**: Proper conversion between simulation results and database schema
 * - **Session Tracking**: Update user session statistics for analytics
 * - **Error Handling**: Graceful degradation when database operations fail
 * 
 * **Analytics Features:**
 * - **User Statistics**: Track total simulations, fidelity preferences, and performance trends
 * - **Result Comparison**: Compare multiple simulation runs for the same rocket design
 * - **Performance History**: Monitor simulation accuracy and computation efficiency over time
 * - **Activity Tracking**: Record user engagement with different simulation features
 * 
 * **Integration Points:**
 * - **Database Service**: Leverages the main database service for rocket persistence
 * - **Cache Layer**: Uses Redis for simulation result caching and performance optimization
 * - **Physics APIs**: Interfaces with RocketPy and other simulation services
 * - **Analysis Engines**: Stores results from stability, Monte Carlo, and performance analysis
 * 
 * @version 1.0.0
 * @author ROCKETv1 Team
 * @see {@link lib/services/database.service.ts} for core database operations
 * @see {@link app/api/simulate} for simulation API endpoints
 * @see {@link services/rocketpy} for high-fidelity physics simulations
 */

import { supabase } from '@/lib/database/supabase';
import type { Simulation, AnalysisResult } from '@/lib/database/supabase';
import { Rocket } from '@/types/rocket';
import { cache } from '@/lib/cache';
import { databaseService } from '@/lib/services/database.service';

export interface SimulationRequest {
  rocket: Rocket;
  fidelity: 'standard' | 'enhanced' | 'professional';
  environmentConfig?: any;
  launchParameters?: any;
}

export interface SimulationResult {
  maxAltitude?: number;
  maxVelocity?: number;
  maxAcceleration?: number;
  apogeeTime?: number;
  stabilityMargin?: number;
  thrustCurve?: [number, number][];
  trajectory?: any;
  flightEvents?: any[];
  stabilityAnalysis?: any;
  performanceAnalysis?: any;
  motorAnalysis?: any;
}

export class SimulationService {
  /**
   * Save simulation results to database
   * Enhanced version that integrates with the database service
   */
  async saveSimulation({
    rocketId,
    userId,
    fidelity,
    environmentConfig,
    launchParameters,
    results,
    simulationTime
  }: {
    rocketId: string;
    userId: string;
    fidelity: string;
    environmentConfig?: any;
    launchParameters?: any;
    results: SimulationResult;
    simulationTime?: number;
  }): Promise<Simulation> {
    try {
      // Try to use the new database service first
      const dbResult = await databaseService.saveSimulation(rocketId, results, fidelity);
      if (dbResult) {
        await this.updateSessionStats(userId, 'simulation');
        return dbResult;
      }
    } catch (error) {
      console.warn('Database service failed, using direct Supabase:', error);
    }

    // Fallback to direct Supabase call (original functionality)
    const { data, error } = await supabase
      .from('simulations')
      .insert({
        rocket_id: rocketId,
        user_id: userId,
        fidelity,
        environment_config: environmentConfig as any,
        launch_parameters: launchParameters as any,
        max_altitude: results.maxAltitude,
        max_velocity: results.maxVelocity,
        max_acceleration: results.maxAcceleration,
        apogee_time: results.apogeeTime,
        stability_margin: results.stabilityMargin,
        results: results as any,
        trajectory_data: results.trajectory as any,
        flight_events: results.flightEvents as any,
        thrust_curve: results.thrustCurve as any,
        simulation_time: simulationTime,
        status: 'completed'
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    
    // Update session statistics
    await this.updateSessionStats(userId, 'simulation');
    
    return data;
  }

  /**
   * Get simulation history for a rocket
   */
  async getRocketSimulations(rocketId: string, limit = 20): Promise<Simulation[]> {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('rocket_id', rocketId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data;
  }

  /**
   * Get user's simulation history
   */
  async getUserSimulations(userId: string, limit = 50): Promise<Simulation[]> {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data;
  }

  /**
   * Save analysis results
   * Enhanced with database service integration
   */
  async saveAnalysisResult({
    rocketId,
    simulationId,
    userId,
    analysisType,
    results,
    parameters,
    computationTime
  }: {
    rocketId: string;
    simulationId?: string;
    userId: string;
    analysisType: 'stability' | 'monte_carlo' | 'motor' | 'recovery' | 'performance' | 'trajectory';
    results: any;
    parameters?: any;
    computationTime?: number;
  }): Promise<AnalysisResult> {
    const { data, error } = await supabase
      .from('analysis_results')
      .insert({
        rocket_id: rocketId,
        simulation_id: simulationId,
        user_id: userId,
        analysis_type: analysisType,
        results,
        parameters,
        computation_time: computationTime
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  }

  /**
   * Get analysis results for a rocket
   */
  async getRocketAnalysis(
    rocketId: string, 
    analysisType?: string
  ): Promise<AnalysisResult[]> {
    let query = supabase
      .from('analysis_results')
      .select('*')
      .eq('rocket_id', rocketId)
      .order('created_at', { ascending: false });
    
    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }
    
    const { data, error } = await query.limit(10);
    
    if (error) throw error;
    
    return data;
  }

  /**
   * Get simulation statistics
   */
  async getSimulationStats(userId: string): Promise<{
    totalSimulations: number;
    simulationsByFidelity: Record<string, number>;
    averageAltitude: number;
    topAltitude: number;
    recentActivity: Simulation[];
  }> {
    // Get basic stats
    const { data: stats, error: statsError } = await supabase
      .from('simulations')
      .select('fidelity, max_altitude')
      .eq('user_id', userId)
      .eq('status', 'completed');
    
    if (statsError) throw statsError;
    
    // Get recent activity
    const { data: recent, error: recentError } = await supabase
      .from('simulations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentError) throw recentError;
    
    // Calculate statistics
    const totalSimulations = stats.length;
    const simulationsByFidelity = stats.reduce((acc, sim) => {
      acc[sim.fidelity] = (acc[sim.fidelity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const altitudes = stats
      .map(s => s.max_altitude)
      .filter(alt => alt !== null) as number[];
    
    const averageAltitude = altitudes.length > 0 
      ? altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length
      : 0;
    
    const topAltitude = altitudes.length > 0 
      ? Math.max(...altitudes)
      : 0;
    
    return {
      totalSimulations,
      simulationsByFidelity,
      averageAltitude,
      topAltitude,
      recentActivity: recent
    };
  }

  /**
   * Update session statistics
   * Enhanced with better error handling
   */
  private async updateSessionStats(userId: string, type: 'rocket' | 'simulation'): Promise<void> {
    try {
      // Get current session
      const { data: session, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.warn('Session stats update failed:', error);
        return; // Graceful degradation
      }
      
      if (!session) return;
      
      // Update session counters
      const updateField = type === 'rocket' ? 'rocket_count' : 'simulation_count';
      const currentCount = session[updateField] || 0;
      
      await supabase
        .from('user_sessions')
        .update({
          [updateField]: currentCount + 1,
          last_activity: new Date().toISOString()
        })
        .eq('id', session.id);
    } catch (error) {
      console.warn('Session stats update failed:', error);
      // Continue execution - this is not critical
    }
  }

  /**
   * Get performance metrics for analytics
   */
  async getPerformanceMetrics(
    userId: string,
    rocketId?: string,
    metricType?: string,
    limit = 100
  ): Promise<any[]> {
    let query = supabase
      .from('performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    
    if (rocketId) {
      query = query.eq('rocket_id', rocketId);
    }
    
    if (metricType) {
      query = query.eq('metric_type', metricType);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data;
  }

  /**
   * Record performance metric
   */
  async recordMetric({
    userId,
    rocketId,
    metricType,
    value,
    metadata
  }: {
    userId: string;
    rocketId: string;
    metricType: string;
    value: number;
    metadata?: any;
  }): Promise<void> {
    const { error } = await supabase
      .from('performance_metrics')
      .insert({
        user_id: userId,
        rocket_id: rocketId,
        metric_type: metricType,
        value,
        metadata
      });
    
    if (error) throw error;
  }

  /**
   * Compare simulations
   */
  async compareSimulations(simulationIds: string[]): Promise<{
    simulations: Simulation[];
    comparison: any;
  }> {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .in('id', simulationIds);
    
    if (error) throw error;
    
    // Generate comparison data
    const comparison = {
      maxAltitudes: data.map(s => s.max_altitude),
      maxVelocities: data.map(s => s.max_velocity),
      stabilityMargins: data.map(s => s.stability_margin),
      simulationTimes: data.map(s => s.simulation_time)
    };
    
    return {
      simulations: data,
      comparison
    };
  }

  /**
   * Enhanced simulation with database integration
   * This method attempts to use cached results and integrates with the new database service
   */
  async runSimulationWithCaching({
    rocket,
    fidelity,
    environmentConfig,
    launchParameters,
    userId
  }: {
    rocket: Rocket;
    fidelity: string;
    environmentConfig?: any;
    launchParameters?: any;
    userId?: string;
  }): Promise<SimulationResult | null> {
    try {
      // Generate cache key based on rocket configuration
      const cacheKey = this.generateCacheKey(rocket, fidelity, environmentConfig);
      
      // Check cache first
      const cached = await cache.getSimulation(cacheKey);
      if (cached) {
        console.log('Using cached simulation result');
        return cached;
      }
      
      // If no cache hit, this would normally call the actual simulation
      // For now, return null to indicate external simulation is needed
      return null;
    } catch (error) {
      console.error('Simulation with caching failed:', error);
      return null;
    }
  }

  /**
   * Generate cache key for simulation results
   */
  private generateCacheKey(rocket: Rocket, fidelity: string, environmentConfig?: any): string {
    const rocketString = JSON.stringify(rocket);
    const envString = JSON.stringify(environmentConfig || {});
    const combinedString = `${rocketString}-${fidelity}-${envString}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combinedString.length; i++) {
      const char = combinedString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `sim-${Math.abs(hash)}`;
  }
}

export const simulationService = new SimulationService(); 