/**
 * Rocketez - Database Integration Service
 * 
 * This service provides a database persistence layer for component-based rocket designs.
 * It stores and retrieves rocket designs using the professional component-based architecture
 * with SI units and material properties.
 * 
 * **Core Responsibilities:**
 * - Store component-based rocket designs in database
 * - Save/load rocket designs with full component fidelity
 * - Persist simulation results and analysis data
 * - Manage chat message history and session tracking
 * - Extract searchable tags from rocket configurations
 * - Provide user statistics and data insights
 * 
 * **Integration Philosophy:**
 * - **Component-first**: All rockets use professional component-based model
 * - **SI Units**: Consistent use of metric system throughout
 * - **Type safety**: Full TypeScript support for component properties
 * - **Material properties**: Store density, thickness, surface roughness
 * - **Engineering precision**: Professional-grade data storage
 * 
 * **Database Schema:**
 * - Rockets stored as JSONB with component structure
 * - Full material property preservation
 * - SI unit consistency enforced
 * - Professional metadata tracking
 * 
 * @version 1.0.0 - Component-based architecture only
 * @author Rocketez Team
 */

import { supabase, getCurrentUser } from '@/lib/database/supabase';
import type { 
  Rocket as DbRocket, 
  NewRocket, 
  Simulation as DbSimulation,
  NewSimulation,
  ChatMessage,
  NewChatMessage,
  AnalysisResult,
  Project as DbProject
} from '@/lib/database/supabase';
import { Rocket, SimulationResult } from '@/types/rocket';
import { toJson } from '@/lib/database/types';
import { MATERIALS } from '@/lib/data/materials';
import { createRocketFromTemplate, TEMPLATES } from '@/lib/data/templates';
import { cache } from '@/lib/cache';

// Database optimization utilities
class DatabaseOptimizer {
  private static queryQueue = new Map<string, Promise<any>>();
  private static batchQueue = new Map<string, any[]>();
  private static batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Debounce identical database queries
   */
  static async debouncedQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    if (this.queryQueue.has(key)) {
      return this.queryQueue.get(key);
    }

    const promise = queryFn();
    this.queryQueue.set(key, promise);

    // Clean up after query completes
    promise.finally(() => {
      this.queryQueue.delete(key);
    });

    return promise;
  }

  /**
   * Batch multiple operations
   */
  static async addToBatch(operation: string, data: any): Promise<void> {
    if (!this.batchQueue.has(operation)) {
      this.batchQueue.set(operation, []);
    }
    
    this.batchQueue.get(operation)!.push(data);

    // Process batch after 100ms of inactivity
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatches();
    }, 100);
  }

  private static async processBatches(): Promise<void> {
    const batches = new Map(this.batchQueue);
    this.batchQueue.clear();

    for (const [operation, items] of Array.from(batches.entries())) {
      try {
        await this.executeBatch(operation, items);
      } catch (error) {
        console.error(`Batch operation ${operation} failed:`, error);
      }
    }
  }

  private static async executeBatch(operation: string, items: any[]): Promise<void> {
    switch (operation) {
      case 'save_performance_metrics':
        await supabase.from('performance_metrics').insert(items);
        break;
      case 'save_analysis_results':
        await supabase.from('analysis_results').insert(items);
        break;
      // Add more batch operations as needed
    }
  }
}

/**
 * Database service for component-based rocket architecture
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
   * Convert component rocket to database format
   */
  private convertRocketToDb(rocket: Rocket): Omit<NewRocket, 'user_id'> {
    return {
      name: rocket.name,
      project_id: rocket.project_id || null,
      parts: {
        nose_cone: rocket.nose_cone,
        body_tubes: rocket.body_tubes,
        fins: rocket.fins,
        motor: rocket.motor,
        parachutes: rocket.parachutes,
        coordinate_system: rocket.coordinate_system,
        rail_guides_position_m: rocket.rail_guides_position_m
      } as any,
      motor_id: rocket.motor.motor_database_id,
      drag_coefficient: this.calculateDragCoefficient(rocket),
      units: 'metric', // Always metric for component-based rockets
      is_public: false,
      tags: this.extractRocketTags(rocket)
    };
  }

  /**
   * Convert database rocket to component format
   */
  private convertRocketFromDb(dbRocket: DbRocket): Rocket {
    const parts = dbRocket.parts as any;
    
    return {
      id: dbRocket.id,
      project_id: dbRocket.project_id || undefined,
      name: dbRocket.name,
      rocket_type: parts.rocket_type || "solid", // Default to solid if not specified
      nose_cone: parts.nose_cone,
      body_tubes: parts.body_tubes || [],
      fins: parts.fins || [],
      motor: parts.motor,
      parachutes: parts.parachutes || [],
      coordinate_system: parts.coordinate_system || "tail_to_nose",
      rail_guides_position_m: parts.rail_guides_position_m
    };
  }

  /**
   * Calculate drag coefficient from component properties
   */
  private calculateDragCoefficient(rocket: Rocket): number {
    // Professional calculation based on component geometry
    const noseDrag = this.calculateNoseDrag(rocket.nose_cone);
    const bodyDrag = this.calculateBodyDrag(rocket.body_tubes);
    const finDrag = this.calculateFinDrag(rocket.fins);
    
    return noseDrag + bodyDrag + finDrag;
  }

  private calculateNoseDrag(nose: any): number {
    // Simplified nose drag calculation based on shape and length
    const baseCoeff: { [key: string]: number } = {
      'ogive': 0.15,
      'conical': 0.18,
      'elliptical': 0.12,
      'parabolic': 0.14
    };
    return baseCoeff[nose.shape] || 0.15;
  }

  private calculateBodyDrag(bodies: any[]): number {
    // Body tube drag is minimal in subsonic flight
    return 0.02 * bodies.length;
  }

  private calculateFinDrag(fins: any[]): number {
    // Fin drag calculation based on fin area and configuration
    let totalDrag = 0;
    fins.forEach(fin => {
      const finArea = fin.root_chord_m * fin.span_m * fin.fin_count;
      totalDrag += 0.01 * finArea; // Simplified calculation
    });
    return totalDrag;
  }

  /**
   * Extract tags from component rocket for categorization
   */
  private extractRocketTags(rocket: Rocket): string[] {
    const tags: string[] = [];
    
    // Add component types
    tags.push('nose_cone', 'body_tube', 'motor');
    if (rocket.fins.length > 0) tags.push('fins');
    if (rocket.parachutes.length > 0) tags.push('parachute');
    
    // Add size category based on total length
    const totalLength = rocket.nose_cone.length_m + 
      rocket.body_tubes.reduce((sum, body) => sum + body.length_m, 0);
    
    if (totalLength < 0.5) tags.push('small');
    else if (totalLength < 1.2) tags.push('medium');
      else tags.push('large');
    
    // Add motor class
    if (rocket.motor.motor_database_id && rocket.motor.motor_database_id !== 'default-motor') {
      const motorClass = rocket.motor.motor_database_id.charAt(0);
      tags.push(`motor-${motorClass}`);
    }
    
    // Add material types using centralized constants
    const materials = new Set<string>();
    if (rocket.nose_cone.material_density_kg_m3 === MATERIALS.DENSITY_FIBERGLASS) materials.add('fiberglass');
    if (rocket.nose_cone.material_density_kg_m3 === MATERIALS.DENSITY_ALUMINUM) materials.add('aluminum');
    if (rocket.nose_cone.material_density_kg_m3 === MATERIALS.DENSITY_PLYWOOD) materials.add('plywood');
    
    rocket.fins.forEach(fin => {
      if (fin.material_density_kg_m3 === MATERIALS.DENSITY_PLYWOOD) materials.add('plywood');
      if (fin.material_density_kg_m3 === MATERIALS.DENSITY_FIBERGLASS) materials.add('fiberglass');
    });
    
    tags.push(...Array.from(materials));
    
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
   * Update existing rocket to database (prevents duplicates)
   */
  async updateRocket(rocket: Rocket): Promise<DbRocket | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      const rocketData = this.convertRocketToDb(rocket);
      
      const { data, error } = await supabase
        .from('rockets')
        .update({
          name: rocketData.name,
          parts: rocketData.parts,
          motor_id: rocketData.motor_id,
          drag_coefficient: rocketData.drag_coefficient,
          units: rocketData.units,
          updated_at: new Date().toISOString()
        })
        .eq('id', rocket.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating rocket in database:', error);
        return null;
      }

      console.log('✅ Rocket updated successfully:', rocket.name);
      return data;
    } catch (error) {
      console.error('Database update failed:', error);
      return null;
    }
  }

  /**
   * Load user rockets from database with optimization
   */
  async loadUserRockets(): Promise<Rocket[]> {
    return DatabaseOptimizer.debouncedQuery('user-rockets', async () => {
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
    });
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
        flight_time: result.flightTime || null,
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

      // Handle session_id validation to prevent foreign key constraint violations
      let validatedSessionId: string | null = null;
      
      if (sessionId) {
        // Check if this session exists in the database
        const { data: existingSession, error: sessionCheckError } = await supabase
          .from('user_sessions')
          .select('session_id')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingSession && !sessionCheckError) {
          // Session exists in database, safe to use
          validatedSessionId = sessionId;
          console.log('✅ Session exists in database, linking chat message to session:', sessionId);
        } else {
          // Session doesn't exist in database yet, create it
          console.log('⚠️ Session not found in database, creating new session. Session ID:', sessionId);
          
          try {
            const newSessionData = {
              user_id: user.id,
              session_id: sessionId,
              started_at: new Date().toISOString(),
              last_activity: new Date().toISOString(),
              metadata: {},
              rocket_count: 0,
              simulation_count: 0
            };

            const { data: newSession, error: createError } = await supabase
              .from('user_sessions')
              .insert(newSessionData)
              .select('session_id')
              .single();

            if (newSession && !createError) {
              validatedSessionId = sessionId;
              console.log('✅ Created new session in database:', sessionId);
            } else {
              console.error('❌ Failed to create session:', createError);
              validatedSessionId = null;
            }
          } catch (createError) {
            console.error('❌ Exception creating session:', createError);
            validatedSessionId = null;
          }
        }
      }

      // If we couldn't validate or create a session, skip saving
      if (!validatedSessionId) {
        console.log('⚠️ No valid session available, skipping chat message save');
        return null;
      }

      // Handle rocket_id validation to prevent foreign key constraint violations
      let validatedRocketId: string | null = null;
      
      if (rocketId) {
        // Check if this rocket exists in the database
        const { data: existingRocket, error: rocketCheckError } = await supabase
          .from('rockets')
          .select('id')
          .eq('id', rocketId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingRocket && !rocketCheckError) {
          // Rocket exists in database, safe to use
          validatedRocketId = rocketId;
          console.log('✅ Rocket exists in database, linking chat message to rocket:', rocketId);
        } else {
          // Rocket doesn't exist in database yet
          console.log('⚠️ Rocket not found in database, saving chat message without rocket link. Rocket ID:', rocketId);
          console.log('   This is normal for new/unsaved rocket designs.');
          validatedRocketId = null;
          
          // Optional: We could auto-save the rocket here, but that might be too aggressive
          // For now, we'll just save the message without the rocket link
        }
      }

      const messageData: Omit<NewChatMessage, 'user_id'> = {
        session_id: validatedSessionId, // Use validated session_id
        rocket_id: validatedRocketId, // Use validated rocket_id or null
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

      // Add timeout protection for database operations
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session lookup timeout')), 4000)
      );

      // Try to get recent session (within 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const sessionPromise = supabase
        .from('user_sessions')
        .select('id, session_id') // Get both UUID id and session_id
        .eq('user_id', user.id)
        .gte('last_activity', twentyFourHoursAgo)
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: existingSession } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]);

      if (existingSession) {
        // Update last activity with timeout
        try {
          const updatePromise = supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id);
          
          const updateTimeout = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Update timeout')), 2000)
          );
          
          await Promise.race([updatePromise, updateTimeout]);
        } catch (updateError) {
          console.warn('Could not update session activity:', updateError);
        }
        
        // Return the session_id (VARCHAR) for foreign key reference
        return existingSession.session_id;
      }

      // Create new session with retry logic and timeout
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

      const createPromise = supabase
        .from('user_sessions')
        .insert(sessionData)
        .select('session_id')
        .single();
      
      const createTimeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Create session timeout')), 3000)
      );

      const { data, error } = await Promise.race([
        createPromise,
        createTimeout
      ]);

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

  /**
   * Get user simulations for files panel
   */
  async getUserSimulations(): Promise<DbSimulation[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('simulations')
        .select(`
          *,
          rockets!inner(name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading user simulations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to load user simulations:', error);
      return [];
    }
  }

  /**
   * Get user chat sessions for files panel
   */
  async getUserChatSessions(): Promise<{
    session_id: string;
    started_at: string;
    last_activity: string;
    rocket_count: number;
    message_count: number;
  }[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      // First, get sessions with message counts, excluding system/welcome messages
      const { data: rawSessions, error } = await supabase
        .from('user_sessions')
        .select(`
          session_id,
          started_at,
          last_activity,
          rocket_count,
          chat_messages!inner(
            id,
            role,
            content
          )
        `)
        .eq('user_id', user.id)
        .order('last_activity', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading user chat sessions:', error);
        return [];
      }

      // Process sessions to filter out empty/orphaned ones
      const processedSessions = (rawSessions || [])
        .map(session => {
          // Count non-system messages (exclude welcome messages)
          const meaningfulMessages = session.chat_messages.filter((msg: any) => 
            msg.role !== 'system' && 
            !msg.content.toLowerCase().includes('welcome to') &&
            !msg.content.toLowerCase().includes('rocketsim')
          );

          return {
            session_id: session.session_id,
            started_at: session.started_at,
            last_activity: session.last_activity,
            rocket_count: session.rocket_count || 0,
            message_count: meaningfulMessages.length
          };
        })
        // Filter out sessions with no meaningful messages or rockets
        .filter(session => 
          session.message_count > 0 || session.rocket_count > 0
        );

      return processedSessions;
    } catch (error) {
      console.error('Failed to load user chat sessions:', error);
      return [];
    }
  }

  /**
   * Clean up orphaned chat sessions (sessions with no rockets and only system messages)
   */
  async cleanupOrphanedSessions(): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) return false;

      // Find sessions with no rockets and only system messages
      const { data: orphanedSessions } = await supabase
        .from('user_sessions')
        .select(`
          id,
          session_id,
          rocket_count,
          chat_messages(role, content)
        `)
        .eq('user_id', user.id)
        .eq('rocket_count', 0);

      if (orphanedSessions) {
        const sessionsToDelete = orphanedSessions.filter(session => {
          const hasOnlySystemMessages = session.chat_messages.every((msg: any) => 
            msg.role === 'system' || 
            msg.content.toLowerCase().includes('welcome to') ||
            msg.content.toLowerCase().includes('rocketsim')
          );
          return hasOnlySystemMessages;
        });

        if (sessionsToDelete.length > 0) {
          // Delete chat messages first
          const sessionIds = sessionsToDelete.map(s => s.session_id);
          await supabase
            .from('chat_messages')
            .delete()
            .in('session_id', sessionIds)
            .eq('user_id', user.id);

          // Then delete sessions
          const sessionUuids = sessionsToDelete.map(s => s.id);
          await supabase
            .from('user_sessions')
            .delete()
            .in('id', sessionUuids)
            .eq('user_id', user.id);

          console.log(`Cleaned up ${sessionsToDelete.length} orphaned chat sessions`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to cleanup orphaned sessions:', error);
      return false;
    }
  }

  /**
   * Create a new rocket from template
   */
  async createNewRocket(name: string, template: 'basic' | 'advanced' | 'sport' = 'basic'): Promise<Rocket | null> {
    try {
      // Map template names to our centralized template IDs
      const templateMap = {
        basic: 'basic_starter',
        advanced: 'high_performance', 
        sport: 'sport_rocket'
      };
      
      const templateId = templateMap[template];
      const rocket = createRocketFromTemplate(templateId, name);
      
      if (!rocket) {
        console.error('Failed to create rocket from template:', templateId);
        return null;
      }

      return rocket;
    } catch (error) {
      console.error('Failed to create new rocket:', error);
      return null;
    }
  }

  /**
   * Delete a rocket
   */
  async deleteRocket(rocketId: string): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) return false;

      const { error } = await supabase
        .from('rockets')
        .delete()
        .eq('id', rocketId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting rocket:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete rocket:', error);
      return false;
    }
  }

  /**
   * Get rocket associated with a chat session
   */
  async getRocketForSession(sessionId: string): Promise<string | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      // Get the most recent rocket_id from chat messages in this session
      const { data, error } = await supabase
        .from('chat_messages')
        .select('rocket_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .not('rocket_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log('No rocket found for session:', sessionId);
        return null;
      }

      return data.rocket_id;
    } catch (error) {
      console.error('Error getting rocket for session:', error);
      return null;
    }
  }

  /**
   * Load a specific rocket by ID
   */
  async loadRocketById(rocketId: string): Promise<Rocket | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .eq('id', rocketId)
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        console.error('Error loading rocket by ID:', error);
        return null;
      }

      return this.convertRocketFromDb(data);
    } catch (error) {
      console.error('Failed to load rocket by ID:', error);
      return null;
    }
  }

  /**
   * Save a new version of an existing rocket
   */
  async saveRocketVersion(
    rocketId: string, 
    rocket: Rocket, 
    description?: string, 
    createdByAction?: string
  ): Promise<any | null> {
    // Add retry logic to handle race conditions
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const user = await getCurrentUser();
        if (!user) return null;

        // Validate rocket ID and ensure it exists in database
        if (!rocketId || rocketId.length < 10 || rocketId.includes('local-')) {
          console.log('Cannot create version for unsaved rocket:', rocketId);
          return null;
        }

        // Check if rocket exists in database
        const { data: existingRocket } = await supabase
          .from('rockets')
          .select('id')
          .eq('id', rocketId)
          .eq('user_id', user.id)
          .single();

        if (!existingRocket) {
          console.log('Rocket not found in database, cannot create version:', rocketId);
          return null;
        }

        // Convert rocket for database storage
        const rocketData = this.convertRocketToDb(rocket);

        // Start a transaction to avoid race conditions
        const { data, error } = await supabase.rpc('create_rocket_version', {
          p_rocket_id: rocketId,
          p_user_id: user.id,
          p_rocket_name: rocket.name,
          p_description: description || 'Version created',
          p_parts: rocketData.parts,
          p_motor_id: rocketData.motor_id,
          p_drag_coefficient: rocketData.drag_coefficient,
          p_units: rocketData.units,
          p_created_by_action: createdByAction
        });

        if (error) {
          // Check if RPC function doesn't exist yet (fallback to old method)
          if (error.code === '42883') {
            console.log('RPC function not found, using fallback method...');
            return this.saveRocketVersionFallback(rocketId, rocket, description, createdByAction, user.id);
          }
          
          // Check if it's a unique constraint violation
          if (error.code === '23505' && attempt < 2) {
            console.log(`Version conflict on attempt ${attempt + 1}, retrying...`);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
            continue;
          }
          
          console.error('Error saving rocket version:', error);
          return null;
        }

        // Update the main rocket record with latest version
        await supabase
          .from('rockets')
          .update({
            name: rocket.name,
            parts: rocketData.parts,
            motor_id: rocketData.motor_id,
            drag_coefficient: rocketData.drag_coefficient,
            units: rocketData.units,
            updated_at: new Date().toISOString()
          })
          .eq('id', rocketId);

        console.log(`Created version ${data?.version_number} for rocket ${rocketId}`);
        return data;
        
      } catch (error) {
        console.error('Failed to save rocket version (attempt', attempt + 1, '):', error);
        if (attempt === 2) {
          // Final attempt failed
          return null;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
    
    return null; // All attempts failed
  }

  /**
   * Fallback method for creating rocket versions (when RPC function doesn't exist)
   */
  private async saveRocketVersionFallback(
    rocketId: string,
    rocket: Rocket,
    description?: string,
    createdByAction?: string,
    userId?: string
  ): Promise<any | null> {
    try {
      const user_id = userId || (await getCurrentUser())?.id;
      if (!user_id) return null;

      // Convert rocket for database storage
      const rocketData = this.convertRocketToDb(rocket);

      // Get the current highest version number with a small delay to reduce race conditions
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      const { data: versions } = await supabase
        .from('rocket_versions')
        .select('version_number')
        .eq('rocket_id', rocketId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (versions && versions[0]?.version_number || 0) + 1;

      // Mark all previous versions as not current
      await supabase
        .from('rocket_versions')
        .update({ is_current: false })
        .eq('rocket_id', rocketId);

      // CRITICAL FIX: Include project_id in version data
      const versionData = {
        rocket_id: rocketId,
        project_id: rocket.project_id || null, // Include project_id from rocket
        version_number: nextVersion,
        name: `${rocket.name} v${nextVersion}`,
        description: description || `Version ${nextVersion}`,
        parts: rocketData.parts,
        motor_id: rocketData.motor_id,
        drag_coefficient: rocketData.drag_coefficient,
        units: rocketData.units,
        created_by_action: createdByAction,
        is_current: true,
        user_id: user_id
      };

      const { data, error } = await supabase
        .from('rocket_versions')
        .insert(versionData)
        .select()
        .single();

      if (error) {
        console.error('Error in fallback rocket version save:', error);
        return null;
      }

      console.log(`Created version ${nextVersion} for rocket ${rocketId} (fallback method)`);
      return data;
    } catch (error) {
      console.error('Fallback version save failed:', error);
      return null;
    }
  }

  /**
   * Get version history for a rocket
   */
  async getRocketVersions(rocketId: string): Promise<any[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      // Validate rocket ID format (should be a UUID)
      if (!rocketId || rocketId.length < 10 || rocketId.includes('local-')) {
        console.log('Invalid or local rocket ID, no versions available:', rocketId);
        return [];
      }

      const { data, error } = await supabase
        .from('rocket_versions')
        .select('*')
        .eq('rocket_id', rocketId)
        .eq('user_id', user.id)
        .order('version_number', { ascending: false });

      if (error) {
        console.error('Error loading rocket versions:', error);
        return [];
      }

      console.log(`Loaded ${data?.length || 0} versions for rocket ${rocketId}`);
      return data || [];
    } catch (error) {
      console.error('Failed to load rocket versions:', error);
      return [];
    }
  }

  /**
   * Revert to a specific rocket version
   */
  async revertToRocketVersion(rocketId: string, versionId: string): Promise<Rocket | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      // Get the version data
      const { data: version, error } = await supabase
        .from('rocket_versions')
        .select('*')
        .eq('id', versionId)
        .eq('rocket_id', rocketId)
        .eq('user_id', user.id)
        .single();

      if (error || !version) {
        console.error('Error loading version:', error);
        return null;
      }

      // Parse the version parts data and convert to component format
      const versionPartsData = typeof version.parts === 'string' ? JSON.parse(version.parts) : version.parts;
      
      // Create a component-based rocket from the version data
      const revertedRocket: Rocket = {
        id: rocketId,
        name: version.name.replace(/ v\d+$/, ''), // Remove version suffix
        rocket_type: versionPartsData.rocket_type || "solid", // Default to solid if not specified
        nose_cone: versionPartsData.nose_cone,
        body_tubes: versionPartsData.body_tubes || [],
        fins: versionPartsData.fins || [],
        motor: versionPartsData.motor,
        parachutes: versionPartsData.parachutes || [],
        coordinate_system: versionPartsData.coordinate_system || "tail_to_nose",
        rail_guides_position_m: versionPartsData.rail_guides_position_m
      };

      // Save as new version with "reverted" description
      await this.saveRocketVersion(
        rocketId,
        revertedRocket,
        `Reverted to version ${version.version_number}`,
        'user_revert'
      );

      return revertedRocket;
    } catch (error) {
      console.error('Failed to revert rocket version:', error);
      return null;
    }
  }

  // Project management functions
  async createProject(name: string, description?: string): Promise<DbProject | null> {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name,
          description: description || `Rocket project: ${name}`,
          is_public: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      return null;
    }
  }

  async getUserProjects(limit: number = 20, offset: number = 0): Promise<{ projects: DbProject[], totalCount: number }> {
    const cacheKey = `user-projects-${limit}-${offset}`;
    return DatabaseOptimizer.debouncedQuery(cacheKey, async () => {
      try {
        console.log(`🔍 getUserProjects: Starting to fetch user projects (limit: ${limit}, offset: ${offset})...`);
        const user = await getCurrentUser();
        console.log('🔍 getUserProjects: Current user:', user ? user.id : 'null');
        if (!user) {
          console.log('🔍 getUserProjects: No user found, returning empty array');
          return { projects: [], totalCount: 0 };
        }

        console.log('🔍 getUserProjects: Querying project_summary table...');
        
        // First get the total count
        const { count, error: countError } = await supabase
          .from('project_summary')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) {
          console.error('🔍 getUserProjects: Count query error:', countError);
          throw countError;
        }

        // Then get the paginated data
        const { data, error } = await supabase
          .from('project_summary')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        console.log('🔍 getUserProjects: Query result:', { 
          dataCount: data?.length || 0, 
          totalCount: count || 0, 
          error 
        });
        
        if (error) {
          console.error('🔍 getUserProjects: Data query error:', error);
          throw error;
        }

        const projects = data || [];
        console.log('🔍 getUserProjects: Returning projects:', projects.length);
        return { projects, totalCount: count || 0 };
      } catch (error) {
        console.error('❌ getUserProjects: Error fetching projects:', error);
        return { projects: [], totalCount: 0 };
      }
    });
  }

  async updateProject(project: Partial<DbProject> & { id: string }): Promise<DbProject | null> {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('projects')
        .update({
          ...project,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating project:', error);
      return null;
    }
  }

  async deleteProject(projectId: string): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      return false;
    }
  }

  async getProjectRockets(projectId: string): Promise<DbRocket[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching project rockets:', error);
      return [];
    }
  }

  async getLatestProjectRocket(projectId: string): Promise<DbRocket | null> {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching latest project rocket:', error);
      return null;
    }
  }

  // Chat functions updated for projects
  async getChatHistoryByProject(projectId: string, limit: number = 50): Promise<any[]> {
    try {
      const user = await getCurrentUser();
      if (!user) return [];

      // Add timeout to prevent hanging queries (5 second timeout)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Chat history query timeout')), 5000)
      );

      const queryPromise = supabase
        .from('chat_messages')
        .select('id, role, content, context_data, created_at')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(limit);

      console.log('📞 Starting chat history query for project:', projectId);
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error('❌ Chat history query error:', error);
        throw error;
      }

      console.log('✅ Chat history loaded successfully:', data?.length || 0, 'messages');
      return data || [];
    } catch (error: any) {
      if (error?.message === 'Chat history query timeout') {
        console.error('⏱️ Chat history query timed out after 5 seconds');
      } else {
        console.error('❌ Error fetching chat history by project:', error);
      }
      return [];
    }
  }

  // Updated rocket functions to work with projects
  async saveRocketToDb(rocket: Rocket, projectId?: string): Promise<DbRocket | null> {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      // If no project ID provided and rocket doesn't have one, create a new project
      let finalProjectId = projectId || rocket.project_id;
      if (!finalProjectId) {
        const newProject = await this.createProject(rocket.name);
        if (!newProject) throw new Error('Failed to create project');
        finalProjectId = newProject.id;
      }

      const rocketData = {
        user_id: user.id,
        project_id: finalProjectId,
        name: rocket.name,
        parts: rocket as any,
        motor_id: rocket.motor.motor_database_id,
        drag_coefficient: 0.5, // Default value
        units: 'metric',
        is_public: false
      };

      const { data, error } = await supabase
        .from('rockets')
        .insert(rocketData)
        .select()
        .single();

      if (error) throw error;

      // Also update the project's updated_at timestamp
      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', finalProjectId);

      return data;
    } catch (error) {
      console.error('Error saving rocket to database:', error);
      return null;
    }
  }

  async saveChatToDb(
    messages: Array<{role: string, content: string, agent?: string}>,
    projectId: string,
    rocketId?: string
  ): Promise<boolean> {
    try {
      const user = await getCurrentUser();
      if (!user) return false;

      console.log('🔍 saveChatToDb called with:');
      console.log('   - projectId:', projectId);
      console.log('   - rocketId:', rocketId);
      console.log('   - userId:', user.id);
      console.log('   - messages count:', messages.length);

      const sessionId = await this.getCurrentSession();
      console.log('   - sessionId:', sessionId);

      // --- START FIX: Validate rocket_id before use ---
      let validatedRocketId: string | null = null;
      if (rocketId) {
        // Check if this rocket actually exists in the database
        const { data: existingRocket, error: rocketCheckError } = await supabase
          .from('rockets')
          .select('id')
          .eq('id', rocketId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingRocket && !rocketCheckError) {
          // The rocket exists, it's safe to link the chat message to it.
          validatedRocketId = rocketId;
        } else {
          // The rocket does NOT exist. Save the message without a rocket link
          // to prevent the foreign key constraint violation.
          console.warn(`Rocket with ID ${rocketId} not found. Saving chat message without the rocket link to prevent a crash.`);
          validatedRocketId = null;
        }
      }
      // --- END FIX ---
      
      const chatMessages = messages.map(msg => ({
        user_id: user.id,
        session_id: sessionId,
        project_id: projectId, // CRITICAL: This should NOT be null
        rocket_id: validatedRocketId, // Use the validated ID, which may be null
        role: msg.role,
        content: msg.content,
        context_data: msg.agent ? { agent: msg.agent } : null
      }));

      console.log('🔍 Chat messages to insert:', chatMessages);
      console.log('🔍 First message project_id:', chatMessages[0]?.project_id);

      const { error } = await supabase
        .from('chat_messages')
        .insert(chatMessages);

      if (error) {
        console.error('❌ Database insert error:', error);
        throw error;
      }
      
      console.log('✅ Messages inserted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving chat to database:', error);
      return false;
    }
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Export helper functions for easy integration
export const saveRocketToDb = (rocket: Rocket, projectId?: string) => databaseService.saveRocketToDb(rocket, projectId);
export const loadUserRockets = () => databaseService.loadUserRockets();
export const saveSimulationToDb = (rocketId: string, result: SimulationResult, fidelity?: string) => 
  databaseService.saveSimulation(rocketId, result, fidelity);
export const saveChatToDb = (messages: Array<{role: string, content: string, agent?: string}>, projectId: string, rocketId?: string) =>
  databaseService.saveChatToDb(messages, projectId, rocketId);
export const getCurrentSessionId = () => databaseService.getCurrentSession();
export const testDatabaseConnection = () => databaseService.testConnection();

// Export new helper functions for left panel
export const getUserSimulations = () => databaseService.getUserSimulations();
export const getUserChatSessions = () => databaseService.getUserChatSessions();
export const createNewRocket = (name: string, template: 'basic' | 'advanced' | 'sport' = 'basic') => 
  databaseService.createNewRocket(name, template);
export const deleteRocket = (rocketId: string) => databaseService.deleteRocket(rocketId);
export const getUserStats = () => databaseService.getUserStats();
export const getRocketForSession = (sessionId: string) => databaseService.getRocketForSession(sessionId);
export const loadRocketById = (rocketId: string) => databaseService.loadRocketById(rocketId);
export const saveRocketVersion = (rocketId: string, rocket: Rocket, description?: string, createdByAction?: string) => 
  databaseService.saveRocketVersion(rocketId, rocket, description, createdByAction);
export const getRocketVersions = (rocketId: string) => databaseService.getRocketVersions(rocketId);
export const revertToRocketVersion = (rocketId: string, versionId: string) => 
  databaseService.revertToRocketVersion(rocketId, versionId);
export const cleanupOrphanedSessions = () => databaseService.cleanupOrphanedSessions();

// Project management functions - using class methods
export const createProject = (name: string, description?: string) => databaseService.createProject(name, description);
export const getUserProjects = (limit: number = 20, offset: number = 0) => databaseService.getUserProjects(limit, offset);
export const updateProject = (project: Partial<DbProject> & { id: string }) => databaseService.updateProject(project);
export const deleteProject = (projectId: string) => databaseService.deleteProject(projectId);
export const getProjectRockets = (projectId: string) => databaseService.getProjectRockets(projectId);
export const getLatestProjectRocket = (projectId: string) => databaseService.getLatestProjectRocket(projectId);
export const getChatHistoryByProject = (projectId: string, limit?: number) => databaseService.getChatHistoryByProject(projectId, limit);
export const updateRocket = (rocket: Rocket) => databaseService.updateRocket(rocket); 