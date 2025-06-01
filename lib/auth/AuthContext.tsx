"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/database/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userSession: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userSession, setUserSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session with timeout protection
    const getInitialSession = async () => {
      try {
        // Add timeout to prevent hanging auth check
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth initialization timeout')), 8000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session: initialSession }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            await initializeUserSession(initialSession.user);
          }
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        // Set to not loading even on error to prevent infinite loading
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await initializeUserSession(session.user);
      } else {
        setUserSession(null);
      }
      
      // Always ensure loading is false after auth state change
      setLoading(false);
    });

    // Safety timeout to ensure loading doesn't stay true indefinitely
    const safetyTimeout = setTimeout(() => {
      console.warn('Auth loading timeout - forcing loading to false');
      setLoading(false);
    }, 10000); // 10 second safety timeout

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Initialize user session - using only user_sessions table
  const initializeUserSession = async (user: User) => {
    try {
      // Create a new session record for tracking user activity
      // We don't need a custom users table - Supabase auth.users is sufficient
      const sessionId = crypto.randomUUID(); // Use proper UUID format
      
      // Add timeout for session creation to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session creation timeout')), 5000)
      );
      
      const sessionPromise = supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          metadata: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
            timestamp: new Date().toISOString(),
            email: user.email
          },
          started_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .select()
        .single();

      const { data: session, error: sessionError } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;

      if (sessionError) {
        console.warn('Could not create session record:', sessionError);
        // Create a fallback session object with proper UUID
        const fallbackSessionId = crypto.randomUUID();
        setUserSession({
          id: fallbackSessionId,
          user_id: user.id,
          session_id: fallbackSessionId,
          started_at: new Date().toISOString()
        });
        return;
      }

      setUserSession(session);
    } catch (error) {
      console.warn('Error initializing user session:', error);
      // Fallback to a basic session object with proper UUID
      const fallbackSessionId = crypto.randomUUID();
      setUserSession({
        id: fallbackSessionId,
        user_id: user.id,
        session_id: fallbackSessionId,
        started_at: new Date().toISOString()
      });
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Google sign-in error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      // Update session end time if we have one
      if (userSession?.id) {
        try {
          await supabase
            .from('user_sessions')
            .update({
              last_activity: new Date().toISOString()
            })
            .eq('id', userSession.id);
        } catch (sessionError) {
          console.warn('Could not update session end time:', sessionError);
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUserSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Profile update error:', error);
      return { data: null, error };
    }
  };

  const value = {
    user,
    session,
    userSession,
    loading,
    signInWithGoogle,
    signOut,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 