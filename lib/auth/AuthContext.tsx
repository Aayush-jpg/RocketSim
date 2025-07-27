"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/database/supabase';
import { initializeSessionManagement } from '@/lib/utils/authHelpers';

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
    let mounted = true;
    
    // Initialize session management (cleanup old data)
    initializeSessionManagement();
    
    // Simplified session initialization
    const initializeAuth = async () => {
      try {
        // Get session with simple timeout
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Session error:', error);
        } else if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          // Initialize user session without complex retries
          initializeUserSession(initialSession.user);
        }
      } catch (error) {
        console.warn('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    // Initialize auth immediately
    initializeAuth();

    // Listen for auth changes - simplified
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', event, session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        initializeUserSession(session.user);
      } else {
        setUserSession(null);
      }
      
      setLoading(false);
      
      // Notify store of auth change
      if (typeof window !== 'undefined' && (window as any).__rocketAuthChanged) {
        (window as any).__rocketAuthChanged();
      }
    });

    // Simple safety timeout - reduced from 6s to 3s
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth safety timeout - setting loading to false');
        setLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
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

  // Simplified user session initialization
  const initializeUserSession = async (user: User) => {
    try {
      // First ensure user exists in public.users table
      await ensureUserRecord(user);
      
      // Create session with simple logic
      const sessionId = crypto.randomUUID();
      
      const { data: session, error } = await supabase
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

      if (error) {
        console.warn('Session creation failed, using fallback:', error);
        // Simple fallback without complex retry logic
        setUserSession({
          id: sessionId,
          user_id: user.id,
          session_id: sessionId,
          started_at: new Date().toISOString()
        });
      } else {
        setUserSession(session);
        console.log('✅ User session created');
      }
    } catch (error) {
      console.warn('User session initialization error:', error);
      // Fallback session
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
          redirectTo: `${window.location.origin}/simulator`
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