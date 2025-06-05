"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/database/supabase';
import { markAuthAttempt, autoRecoverFromAuthTimeout } from '@/lib/utils/authHelpers';

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
    // Check for previous auth timeout issues and auto-recover
    autoRecoverFromAuthTimeout();
    
    // Mark this auth attempt
    markAuthAttempt();
    
    // Get initial session with timeout protection
    const getInitialSession = async () => {
      try {
        // Reduce timeout from 8000ms to 5000ms (5 seconds)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth initialization timeout')), 5000)
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
          
          // Only initialize user session after a brief delay to avoid race conditions
          if (initialSession?.user) {
            setTimeout(() => initializeUserSession(initialSession.user), 500);
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
        // Add delay to prevent race conditions with user record creation
        setTimeout(() => initializeUserSession(session.user), 300);
      } else {
        setUserSession(null);
      }
      
      // Always ensure loading is false after auth state change
      setLoading(false);
    });

    // Reduce safety timeout from 10000ms to 6000ms (6 seconds)
    const safetyTimeout = setTimeout(() => {
      console.warn('Auth loading timeout - forcing loading to false');
      setLoading(false);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Ensure user exists in public.users table
  const ensureUserRecord = async (user: User) => {
    try {
      // Check if user exists in public.users table
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Error checking user existence:', checkError);
        return;
      }

      if (!existingUser) {
        // Create user record in public.users table
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            preferences: {},
            experience_level: 'beginner',
            subscription_tier: 'free'
          });

        if (insertError) {
          console.warn('Could not create user record (may already exist):', insertError);
        } else {
          console.log('✅ Created user record in public.users table');
        }
      }
    } catch (error) {
      console.warn('Error ensuring user record:', error);
    }
  };

  // Initialize user session - now with better error handling
  const initializeUserSession = async (user: User) => {
    try {
      // First ensure user exists in public.users table
      await ensureUserRecord(user);
      
      // Create a new session record for tracking user activity
      const sessionId = crypto.randomUUID(); // Use proper UUID format
      
      // Reduce timeout from 5000ms to 3000ms (3 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session creation timeout')), 3000)
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
        
        // Check if it's a foreign key constraint error specifically
        if (sessionError.code === '23503') {
          console.error('Foreign key constraint violation - user may not exist in database');
          console.log('Attempting to resolve user synchronization issue...');
          
          // Try to sync the user again and retry session creation ONCE
          await ensureUserRecord(user);
          
          // Single retry with shorter timeout
          try {
            const retryPromise = supabase
              .from('user_sessions')
              .insert({
                user_id: user.id,
                session_id: crypto.randomUUID(),
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

            const retryTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Retry timeout')), 2000)
            );

            const { data: retrySession, error: retryError } = await Promise.race([
              retryPromise,
              retryTimeout
            ]) as any;

            if (retryError) {
              throw retryError;
            }
            
            setUserSession(retrySession);
            console.log('✅ Successfully created session after user sync');
            return;
          } catch (retryError) {
            console.error('Retry session creation also failed:', retryError);
          }
        }
        
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
      console.log('✅ Successfully created user session');
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