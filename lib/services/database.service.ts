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

      // Try to get recent session (within 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id, session_id') // Get both UUID id and session_id
        .eq('user_id', user.id)
        .gte('last_activity', twentyFourHoursAgo)
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();

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
      const templates = {
        basic: {
          parts: [
            { id: crypto.randomUUID(), type: 'nose' as const, color: '#A0A7B8', shape: 'ogive' as const, length: 15, baseØ: 5 },
            { id: crypto.randomUUID(), type: 'body' as const, color: '#8C8D91', Ø: 10, length: 40 },
            { id: crypto.randomUUID(), type: 'fin' as const, color: '#A0A7B8', root: 10, span: 8, sweep: 6 },
            { id: crypto.randomUUID(), type: 'engine' as const, color: '#0066FF', thrust: 32, Isp: 200 }
          ] as Part[],
          motorId: 'C6-5',
          Cd: 0.35,
          units: 'metric' as const
        },
        advanced: {
          parts: [
            { id: crypto.randomUUID(), type: 'nose' as const, color: '#FF6B35', shape: 'von-karman' as const, length: 20, baseØ: 6 },
            { id: crypto.randomUUID(), type: 'body' as const, color: '#2E86C1', Ø: 12, length: 60 },
            { id: crypto.randomUUID(), type: 'fin' as const, color: '#FF6B35', root: 15, span: 12, sweep: 8 },
            { id: crypto.randomUUID(), type: 'engine' as const, color: '#E74C3C', thrust: 62, Isp: 220 }
          ] as Part[],
          motorId: 'D12-5',
          Cd: 0.32,
          units: 'metric' as const
        },
        sport: {
          parts: [
            { id: crypto.randomUUID(), type: 'nose' as const, color: '#F39C12', shape: 'parabolic' as const, length: 25, baseØ: 8 },
            { id: crypto.randomUUID(), type: 'body' as const, color: '#8E44AD', Ø: 16, length: 80 },
            { id: crypto.randomUUID(), type: 'fin' as const, color: '#F39C12', root: 20, span: 16, sweep: 10 },
            { id: crypto.randomUUID(), type: 'engine' as const, color: '#C0392B', thrust: 125, Isp: 240 }
          ] as Part[],
          motorId: 'E9-6',
          Cd: 0.30,
          units: 'metric' as const
        }
      };

      const newRocket: Rocket = {
        id: crypto.randomUUID(),
        name,
        ...templates[template]
      };

      return newRocket;
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

        // Start a transaction to avoid race conditions
        const { data, error } = await supabase.rpc('create_rocket_version', {
          p_rocket_id: rocketId,
          p_user_id: user.id,
          p_rocket_name: rocket.name,
          p_description: description || 'Version created',
          p_parts: toJson(rocket.parts),
          p_motor_id: rocket.motorId,
          p_drag_coefficient: rocket.Cd,
          p_units: rocket.units,
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
            parts: toJson(rocket.parts),
            motor_id: rocket.motorId,
            drag_coefficient: rocket.Cd,
            units: rocket.units,
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

      // Save new version
      const versionData = {
        rocket_id: rocketId,
        version_number: nextVersion,
        name: `${rocket.name} v${nextVersion}`,
        description: description || `Version ${nextVersion}`,
        parts: toJson(rocket.parts),
        motor_id: rocket.motorId,
        drag_coefficient: rocket.Cd,
        units: rocket.units,
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

      // Create a new version based on the reverted version
      const revertedRocket: Rocket = {
        id: rocketId,
        name: version.name.replace(/ v\d+$/, ''), // Remove version suffix
        parts: version.parts as unknown as Part[],
        motorId: version.motor_id,
        Cd: version.drag_coefficient,
        units: version.units as 'metric' | 'imperial'
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