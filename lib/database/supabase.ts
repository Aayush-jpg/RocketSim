import { createClient } from '@supabase/supabase-js';

// Database types based on our schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string | null
          created_at: string | null
          updated_at: string | null
          preferences: Json
          experience_level: string | null
          subscription_tier: string | null
        }
        Insert: {
          id?: string
          email: string
          username?: string | null
          created_at?: string | null
          updated_at?: string | null
          preferences?: Json
          experience_level?: string | null
          subscription_tier?: string | null
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          created_at?: string | null
          updated_at?: string | null
          preferences?: Json
          experience_level?: string | null
          subscription_tier?: string | null
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string | null
          session_id: string
          started_at: string | null
          last_activity: string | null
          metadata: Json
          rocket_count: number | null
          simulation_count: number | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id: string
          started_at?: string | null
          last_activity?: string | null
          metadata?: Json
          rocket_count?: number | null
          simulation_count?: number | null
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string
          started_at?: string | null
          last_activity?: string | null
          metadata?: Json
          rocket_count?: number | null
          simulation_count?: number | null
        }
      }
      rockets: {
        Row: {
          id: string
          user_id: string | null
          name: string
          parts: Json
          motor_id: string | null
          drag_coefficient: number | null
          units: string | null
          created_at: string | null
          updated_at: string | null
          is_public: boolean | null
          tags: string[] | null
          design_vector: number[] | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          parts: Json
          motor_id?: string | null
          drag_coefficient?: number | null
          units?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_public?: boolean | null
          tags?: string[] | null
          design_vector?: number[] | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          parts?: Json
          motor_id?: string | null
          drag_coefficient?: number | null
          units?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_public?: boolean | null
          tags?: string[] | null
          design_vector?: number[] | null
        }
      }
      simulations: {
        Row: {
          id: string
          user_id: string | null
          rocket_id: string | null
          environment_id: string | null
          fidelity: string
          status: string
          max_altitude: number | null
          max_velocity: number | null
          max_acceleration: number | null
          apogee_time: number | null
          flight_time: number | null
          landing_velocity: number | null
          drift_distance: number | null
          stability_margin: number | null
          trajectory_data: Json | null
          flight_events: Json | null
          thrust_curve: Json | null
          created_at: string | null
          computation_time: number | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          rocket_id?: string | null
          environment_id?: string | null
          fidelity: string
          status?: string
          max_altitude?: number | null
          max_velocity?: number | null
          max_acceleration?: number | null
          apogee_time?: number | null
          flight_time?: number | null
          landing_velocity?: number | null
          drift_distance?: number | null
          stability_margin?: number | null
          trajectory_data?: Json | null
          flight_events?: Json | null
          thrust_curve?: Json | null
          created_at?: string | null
          computation_time?: number | null
        }
        Update: {
          id?: string
          user_id?: string | null
          rocket_id?: string | null
          environment_id?: string | null
          fidelity?: string
          status?: string
          max_altitude?: number | null
          max_velocity?: number | null
          max_acceleration?: number | null
          apogee_time?: number | null
          flight_time?: number | null
          landing_velocity?: number | null
          drift_distance?: number | null
          stability_margin?: number | null
          trajectory_data?: Json | null
          flight_events?: Json | null
          thrust_curve?: Json | null
          created_at?: string | null
          computation_time?: number | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          rocket_id: string | null
          role: string
          content: string
          context_data: Json | null
          agent_actions: Json | null
          tokens_used: number | null
          message_vector: number[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          rocket_id?: string | null
          role: string
          content: string
          context_data?: Json | null
          agent_actions?: Json | null
          tokens_used?: number | null
          message_vector?: number[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          rocket_id?: string | null
          role?: string
          content?: string
          context_data?: Json | null
          agent_actions?: Json | null
          tokens_used?: number | null
          message_vector?: number[] | null
          created_at?: string | null
        }
      }
      analysis_results: {
        Row: {
          id: string
          rocket_id: string | null
          simulation_id: string | null
          user_id: string | null
          analysis_type: string
          results: Json
          parameters: Json | null
          created_at: string | null
          computation_time: number | null
        }
        Insert: {
          id?: string
          rocket_id?: string | null
          simulation_id?: string | null
          user_id?: string | null
          analysis_type: string
          results: Json
          parameters?: Json | null
          created_at?: string | null
          computation_time?: number | null
        }
        Update: {
          id?: string
          rocket_id?: string | null
          simulation_id?: string | null
          user_id?: string | null
          analysis_type?: string
          results?: Json
          parameters?: Json | null
          created_at?: string | null
          computation_time?: number | null
        }
      }
      motors: {
        Row: {
          id: string
          manufacturer: string
          name: string
          impulse_class: string
          total_impulse: number | null
          burn_time: number | null
          average_thrust: number | null
          max_thrust: number | null
          propellant_mass: number | null
          total_mass: number | null
          diameter: number | null
          length: number | null
          thrust_curve: Json | null
          specifications: Json | null
          created_at: string | null
        }
        Insert: {
          id: string
          manufacturer: string
          name: string
          impulse_class: string
          total_impulse?: number | null
          burn_time?: number | null
          average_thrust?: number | null
          max_thrust?: number | null
          propellant_mass?: number | null
          total_mass?: number | null
          diameter?: number | null
          length?: number | null
          thrust_curve?: Json | null
          specifications?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          manufacturer?: string
          name?: string
          impulse_class?: string
          total_impulse?: number | null
          burn_time?: number | null
          average_thrust?: number | null
          max_thrust?: number | null
          propellant_mass?: number | null
          total_mass?: number | null
          diameter?: number | null
          length?: number | null
          thrust_curve?: Json | null
          specifications?: Json | null
          created_at?: string | null
        }
      }
      weather_cache: {
        Row: {
          id: string
          location_key: string
          weather_data: Json
          source: string
          expires_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          location_key: string
          weather_data: Json
          source: string
          expires_at: string
          created_at?: string | null
        }
        Update: {
          id?: string
          location_key?: string
          weather_data?: Json
          source?: string
          expires_at?: string
          created_at?: string | null
        }
      }
      environment_configs: {
        Row: {
          id: string
          user_id: string | null
          name: string
          latitude: number
          longitude: number
          elevation: number
          wind_model: Json
          atmospheric_model: Json
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          latitude: number
          longitude: number
          elevation: number
          wind_model: Json
          atmospheric_model: Json
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          latitude?: number
          longitude?: number
          elevation?: number
          wind_model?: Json
          atmospheric_model?: Json
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Environment variables with validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env file.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env file.');
}

// Create Supabase clients
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Server-side client with service role key for admin operations
export const supabaseAdmin = supabaseServiceKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Type exports for convenience
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// Specific type exports
export type Rocket = Tables<'rockets'>;
export type NewRocket = Inserts<'rockets'>;
export type UpdateRocket = Updates<'rockets'>;

export type Simulation = Tables<'simulations'>;
export type NewSimulation = Inserts<'simulations'>;

export type ChatMessage = Tables<'chat_messages'>;
export type NewChatMessage = Inserts<'chat_messages'>;

export type AnalysisResult = Tables<'analysis_results'>;
export type NewAnalysisResult = Inserts<'analysis_results'>;

export type User = Tables<'users'>;
export type UserSession = Tables<'user_sessions'>;

export type Motor = Tables<'motors'>;
export type WeatherCache = Tables<'weather_cache'>;

// Auth helpers
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const requireAuth = async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Authentication required');
  return user;
};

// Database connection test
export const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').single();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}; 