/**
 * Auth Provider
 * 
 * Single source of truth for authentication state management.
 * Defaults to anonymous users with option to create permanent accounts.
 * Greenfield approach - no local-only mode needed.
 */

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseClient } from '../services/supabase';
import { dataService } from '../services/dataService';

type AuthMode = 'anonymous' | 'authenticated';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  mode: AuthMode;
}

interface AuthContextValue extends AuthState {
  // Authentication methods
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName?: string) => Promise<any>;
  signOut: () => Promise<any>;
  getAccessToken: () => Promise<string | null>;
  
  // Anonymous user methods
  signInAnonymously: () => Promise<any>;
  convertAnonymousToUser: (email: string, password: string, fullName?: string) => Promise<any>;
  getCurrentUserId: () => string; // Returns user ID
  isAnonymous: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
    mode: 'anonymous',
  });

  useEffect(() => {
    let cancelled = false; // Flag to prevent double execution in Strict Mode
    
    // Get initial session
    supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
      console.log('🔄 AuthContext useEffect: session', session);
      if (cancelled) return; // Prevent double execution
      
      const user = session?.user ?? null;
      const isAnonymous = user?.is_anonymous ?? false;
      
      // If no user exists, automatically sign in anonymously (default behavior)
      if (!user) {
        try {
          console.log('No existing session found, signing in anonymously...');
          const { data: anonData, error: anonError } = await supabaseClient.auth.signInAnonymously();
          
          if (cancelled) return; // Check again after async operation
          
          if (anonError) {
            console.error('Anonymous sign-in failed:', anonError);
            throw anonError;
          }
          
          // Anonymous sign-in successful
          console.log('✅ Anonymous sign-in successful');
          setState(prevState => ({
            ...prevState,
            user: anonData.user,
            loading: false,
            isAuthenticated: true,
            mode: 'anonymous',
          }));
        } catch (error) {
          if (cancelled) return; // Check again after async operation
          
          console.error('Failed to initialize anonymous session:', error);
          // Still set loading to false so app doesn't hang
          setState(prevState => ({
            ...prevState,
            user: null,
            loading: false,
            isAuthenticated: false,
            mode: 'anonymous', // Keep anonymous mode even if sign-in failed
          }));
        }
      } else {
        // User already exists (anonymous or authenticated)
        setState(prevState => ({
          ...prevState,
          user,
          loading: false,
          isAuthenticated: !!user,
          mode: isAnonymous ? 'anonymous' : 'authenticated',
        }));
      }
    });

    // Cleanup function to prevent double execution
    return () => {
      cancelled = true;
    };

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        const isAnonymous = user?.is_anonymous ?? false;
        
        setState(prevState => ({
          ...prevState,
          user,
          loading: false,
          isAuthenticated: !!user,
          mode: user ? (isAnonymous ? 'anonymous' : 'authenticated') : 'anonymous',
        }));

        // Sync user profile when user becomes authenticated (anonymous→authenticated conversion)
        if (user && !isAnonymous && (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
          console.log('🔄 Syncing user profile after authentication...', event);
          try {
            await dataService.syncUserProfile(user.id);
          } catch (error) {
            console.error('Failed to sync user profile:', error);
          }
        }
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

  const signOut = useCallback(async () => {
    const result = await supabaseClient.auth.signOut();
    // After sign out, automatically sign in anonymously again
    try {
      const { data: anonData, error: anonError } = await supabaseClient.auth.signInAnonymously();
      if (!anonError && anonData.user) {
        setState(prevState => ({
          ...prevState,
          user: anonData.user,
          isAuthenticated: true,
          mode: 'anonymous',
        }));
      }
    } catch (error) {
      console.error('Failed to re-authenticate anonymously after sign out:', error);
      setState(prevState => ({
        ...prevState,
        user: null,
        isAuthenticated: false,
        mode: 'anonymous',
      }));
    }
    return result;
  }, []);

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  // New methods for local-first architecture
  const signInAnonymously = useCallback(async () => {
    return supabaseClient.auth.signInAnonymously();
  }, []);

  const convertAnonymousToUser = useCallback(async (email: string, password: string, fullName?: string) => {
    // Detect user's timezone automatically  
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Convert anonymous user to permanent user
    const result = await supabaseClient.auth.updateUser({
      email,
      password,
      data: {
        full_name: fullName || email.split('@')[0],
        timezone: userTimezone
      }
    });

    // Sync user profile after conversion
    if (result.data.user && !result.error) {
      console.log('🔄 Syncing user profile after account creation...');
      try {
        // Small delay to ensure the trigger has created the profile
        setTimeout(async () => {
          await dataService.syncUserProfile(result.data.user!.id);
        }, 1000);
      } catch (error) {
        console.error('Failed to sync user profile after conversion:', error);
      }
    }

    return result;
  }, []);

  const getCurrentUserId = useCallback(() => {
    // Return user ID from current session (anonymous or authenticated)
    return state.user?.id || '';
  }, [state.user?.id]);

  const value = useMemo(() => ({
    // State properties
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    mode: state.mode,
    
    // Computed properties
    isAnonymous: state.mode === 'anonymous',
    
    // Authentication methods
    signIn,
    signUp,
    signOut,
    getAccessToken,
    
    // Anonymous user methods
    signInAnonymously,
    convertAnonymousToUser,
    getCurrentUserId,
  }), [
    state.user, 
    state.loading, 
    state.isAuthenticated, 
    state.mode,
    signIn, 
    signUp, 
    signOut, 
    getAccessToken,
    signInAnonymously,
    convertAnonymousToUser,
    getCurrentUserId
  ]);

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