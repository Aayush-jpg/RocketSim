/**
 * ROCKETv1 - Database Integration Service
 * ======================================
 * 
 * This service provides a non-destructive database persistence layer that integrates with the existing
 * Zustand store and React Three Fiber frontend without breaking current functionality. It acts as a
 * bridge between the application's in-memory state and Supabase PostgreSQL database.
 * 
 * **Core Responsibilities:**
 * - Convert between frontend Rocket types and database schema formats
 * - Save/load rocket designs with graceful degradation on failures
 * - Persist simulation results and analysis data
 * - Manage chat message history and session tracking
 * - Extract searchable tags from rocket configurations
 * - Provide user statistics and data insights
 * 
 * **Integration Philosophy:**
 * - **Non-blocking**: Database failures don't crash the application
 * - **Graceful degradation**: Returns empty arrays/null on database errors
 * - **Type safety**: Proper conversion between store types and database types
 * - **Session management**: Tracks user activity and rocket creation statistics
 * - **Authentication aware**: Respects user authentication state
 * 
 * **Database Operations:**
 * - Rocket CRUD operations with tag extraction and categorization
 * - Simulation result persistence with JSONB trajectory data
 * - Chat message storage with session correlation
 * - User session tracking for analytics and activity monitoring
 * 
 * **Error Handling:**
 * - All database operations wrapped in try-catch blocks
 * - Console logging for debugging without disrupting user experience
 * - Fallback to local-only operation when database unavailable
 * 
 * @version 1.0.0
 * @author ROCKETv1 Team
 * @see {@link lib/database/supabase.ts} for database client configuration
 * @see {@link lib/store.ts} for Zustand store integration
 */

import { supabase, getCurrentUser } from '@/lib/database/supabase';
import type { 
  Rocket as DbRocket, 
  NewRocket, 
  Simulation as DbSimulation,
  NewSimulation,
  ChatMessage,
  NewChatMessage,
  AnalysisResult
} from '@/lib/database/supabase';
import { Rocket, SimulationResult, Part } from '@/types/rocket';
import { toJson } from '@/lib/database/types';

/**
 * Database service that integrates with existing functionality
 * Provides persistence layer without breaking existing features
 */
export class DatabaseService {
  private static instance: DatabaseService;

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Convert store rocket to database format
   */
  private convertRocketToDb(rocket: Rocket): Omit<NewRocket, 'user_id'> {
    return {
      name: rocket.name,
      parts: rocket.parts as any,
      motor_id: rocket.motorId,
      drag_coefficient: rocket.Cd,
      units: rocket.units,
      is_public: false,
      tags: this.extractRocketTags(rocket)
    };
  }

  /**
   * Convert database rocket to store format
   */
  private convertRocketFromDb(dbRocket: DbRocket): Rocket {
    return {
      id: dbRocket.id,
      name: dbRocket.name,
      parts: dbRocket.parts as unknown as Part[],
      motorId: dbRocket.motor_id || 'default-motor',
      Cd: typeof dbRocket.drag_coefficient === 'number' 
        ? dbRocket.drag_coefficient 
        : parseFloat(String(dbRocket.drag_coefficient) || '0.35'),
      units: (dbRocket.units as 'metric' | 'imperial') || 'metric'
    };
  }

  /**
   * Extract tags from rocket for categorization
   */
  private extractRocketTags(rocket: Rocket): string[] {
    const tags: string[] = [];
    
    // Add part types
    const partTypes = Array.from(new Set(rocket.parts.map((p: Part) => p.type)));
    tags.push(...partTypes);
    
    // Add size category
    const bodyParts = rocket.parts.filter((p: Part) => p.type === 'body');
    if (bodyParts.length > 0) {
      const totalLength = bodyParts.reduce((sum: number, p: Part) => {
        const bodyPart = p as any; // Type assertion for body-specific properties
        return sum + (bodyPart.length || 0);
      }, 0);
      if (totalLength < 30) tags.push('small');
      else if (totalLength < 60) tags.push('medium');
      else tags.push('large');
    }
    
    // Add motor class
    if (rocket.motorId && rocket.motorId !== 'default-motor') {
      const motorClass = rocket.motorId.charAt(0);
      tags.push(`motor-${motorClass}`);
    }
    
    return tags;
  }

  /**
   * Save rocket to database (non-destructive)
   */
  async saveRocket(rocket: Rocket): Promise<DbRocket | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null; // Return null if not authenticated instead of throwing

      const rocketData = this.convertRocketToDb(rocket);
      
      const { data, error } = await supabase
        .from('rockets')
        .insert({
          ...rocketData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving rocket to database:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Database save failed:', error);
      return null; // Graceful degradation
    }
  }

  /**
   * Load user rockets from database
   */
  async loadUserRockets(): Promise<Rocket[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading rockets:', error);
        return [];
      }

      return (data || []).map(this.convertRocketFromDb);
    } catch (error) {
      console.error('Database load failed:', error);
      return [];
    }
  }

  /**
   * Save simulation result to database
   */
  async saveSimulation(
    rocketId: string, 
    result: SimulationResult, 
    fidelity: string = 'standard'
  ): Promise<DbSimulation | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      const simulationData: Omit<NewSimulation, 'user_id'> = {
        rocket_id: rocketId,
        fidelity,
        status: 'completed',
        max_altitude: result.maxAltitude || null,
        max_velocity: result.maxVelocity || null,
        max_acceleration: result.maxAcceleration || null,
        apogee_time: result.apogeeTime || null,
        landing_velocity: result.landingVelocity || null,
        drift_distance: result.driftDistance || null,
        stability_margin: result.stabilityMargin || null,
        trajectory_data: toJson(result.trajectory) || null,
        flight_events: toJson(result.flightEvents) || null,
        thrust_curve: toJson(result.thrustCurve) || null,
        computation_time: null // Temporarily remove - column may not exist yet
      };

      const { data, error } = await supabase
        .from('simulations')
        .insert({
          ...simulationData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving simulation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Simulation save failed:', error);
      return null;
    }
  }

  /**
   * Save chat message to database
   */
  async saveChatMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    rocketId?: string,
    agentActions?: any
  ): Promise<ChatMessage | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      // Skip saving if using local/fallback session
      if (sessionId.startsWith('local-') || sessionId.startsWith('fallback-')) {
        console.log('Skipping chat message save for local/fallback session');
        return null;
      }

      const messageData: Omit<NewChatMessage, 'user_id'> = {
        session_id: sessionId, // This should now be a proper session_id (VARCHAR)
        rocket_id: rocketId || null,
        role,
        content,
        agent_actions: agentActions || null
        // Temporarily remove message_vector - column may not exist yet
        // message_vector: null
      };

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          ...messageData,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving chat message:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Chat message save failed:', error);
      return null;
    }
  }

  /**
   * Get chat history for session
   */
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading chat history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Chat history load failed:', error);
      return [];
    }
  }

  /**
   * Get current or create new session
   */
  async getCurrentSession(): Promise<string> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        // Return a local session ID for non-authenticated users
        return `local-${Date.now()}`;
      }

      // Try to get recent session (within 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id, session_id') // Get both UUID id and session_id
        .eq('user_id', user.id)
        .gte('last_activity', twentyFourHoursAgo)
        .order('last_activity', { ascending: false })
        .limit(1)
        .single();

      if (existingSession) {
        // Update last activity
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id);
        
        // Return the session_id (VARCHAR) for foreign key reference
        return existingSession.session_id;
      }

      // Create new session with retry logic
      const sessionId = crypto.randomUUID();
      const sessionData = {
        user_id: user.id,
        session_id: sessionId,
        started_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        metadata: {},
        rocket_count: 0,
        simulation_count: 0
      };

      const { data, error } = await supabase
        .from('user_sessions')
        .insert(sessionData)
        .select('session_id')
        .single();

      if (error) {
        console.error('Failed to create user session:', error);
        // Still return a fallback session ID
        return `fallback-${Date.now()}`;
      }

      // Return the session_id (VARCHAR) for foreign key reference
      return data.session_id;
    } catch (error) {
      console.error('Session management failed:', error);
      return `fallback-${Date.now()}`;
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get user statistics (optional feature)
   */
  async getUserStats(): Promise<{
    rocketsCount: number;
    simulationsCount: number;
    messagesCount: number;
  } | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      const [rockets, simulations, messages] = await Promise.all([
        supabase.from('rockets').select('id').eq('user_id', user.id),
        supabase.from('simulations').select('id').eq('user_id', user.id),
        supabase.from('chat_messages').select('id').eq('user_id', user.id)
      ]);

      return {
        rocketsCount: rockets.data?.length || 0,
        simulationsCount: simulations.data?.length || 0,
        messagesCount: messages.data?.length || 0
      };
    } catch (error) {
      console.error('Stats fetch failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Export helper functions for easy integration
export const saveRocketToDb = (rocket: Rocket) => databaseService.saveRocket(rocket);
export const loadUserRockets = () => databaseService.loadUserRockets();
export const saveSimulationToDb = (rocketId: string, result: SimulationResult, fidelity?: string) => 
  databaseService.saveSimulation(rocketId, result, fidelity);
export const saveChatToDb = (sessionId: string, role: 'user' | 'assistant' | 'system', content: string, rocketId?: string, actions?: any) =>
  databaseService.saveChatMessage(sessionId, role, content, rocketId, actions);
export const getCurrentSessionId = () => databaseService.getCurrentSession();
export const testDatabaseConnection = () => databaseService.testConnection(); 