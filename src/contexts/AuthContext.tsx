/**
 * Auth Provider
 * 
 * Single source of truth for authentication state management.
 * Supports local-only mode, anonymous users, and full authentication.
 * Provides seamless transition between modes.
 */

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseClient } from '../services/supabase';

// Local user ID for offline-first usage
const LOCAL_USER_ID_KEY = 'verses_local_user_id';

// Generate or retrieve local user ID
function getOrCreateLocalUserId(): string {
  let localUserId = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!localUserId) {
    localUserId = crypto.randomUUID();
    localStorage.setItem(LOCAL_USER_ID_KEY, localUserId);
  }
  return localUserId;
}

type AuthMode = 'local' | 'anonymous' | 'authenticated';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  mode: AuthMode;
  localUserId: string;
}

interface AuthContextValue extends AuthState {
  // Original methods (still supported)
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName?: string) => Promise<any>;
  signOut: () => Promise<any>;
  getAccessToken: () => Promise<string | null>;
  
  // New methods for local-first architecture
  signInAnonymously: () => Promise<any>;
  convertAnonymousToUser: (email: string, password: string, fullName?: string) => Promise<any>;
  getCurrentUserId: () => string; // Returns appropriate user ID based on mode
  isLocalOnly: boolean;
  isAnonymous: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
    mode: 'local',
    localUserId: getOrCreateLocalUserId(),
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