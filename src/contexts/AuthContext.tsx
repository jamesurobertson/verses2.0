/**
 * Auth Provider
 * 
 * Single source of truth for authentication state management.
 * Provides authentication context throughout the app.
 */

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseClient } from '../services/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName?: string) => Promise<any>;
  signOut: () => Promise<any>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        loading: false,
        isAuthenticated: !!session?.user,
      });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setState({
          user: session?.user ?? null,
          loading: false,
          isAuthenticated: !!session?.user,
        });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    return supabaseClient.auth.signInWithPassword({ email, password });
  }, []);

  const signUp = useCallback((email: string, password: string, fullName?: string) => {
    // Detect user's timezone automatically
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0], // Use part before @ as default name
          timezone: userTimezone
        }
      }
    });
  }, []);

  const signOut = useCallback(() => {
    return supabaseClient.auth.signOut();
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const value = useMemo(() => ({
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    signIn,
    signUp,
    signOut,
    getAccessToken,
  }), [state.user, state.loading, state.isAuthenticated, signIn, signUp, signOut, getAccessToken]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}