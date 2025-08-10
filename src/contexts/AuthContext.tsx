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
import { v4 as uuidv4 } from 'uuid';
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
  
  // Data sync methods
  syncData: () => Promise<void>; // Manual data sync
  
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

  // Helper function to perform anonymous sign-in
  const performAnonymousSignIn = useCallback(async () => {
    try {
      console.log('🔄 Creating anonymous session...');
      const { data: anonData, error: anonError } = await supabaseClient.auth.signInAnonymously();
      
      if (anonError) {
        console.error('❌ Anonymous sign-in failed:', anonError);
        throw anonError;
      }
      
      if (!anonData.user) {
        throw new Error('Anonymous sign-in succeeded but no user returned');
      }
      
      // Anonymous sign-in successful
      console.log('✅ Anonymous sign-in successful:', {
        userId: anonData.user.id,
        isAnonymous: anonData.user.is_anonymous
      });
      
      setState(prevState => ({
        ...prevState,
        user: anonData.user,
        loading: false,
        isAuthenticated: true,
        mode: 'anonymous',
      }));
    } catch (error) {
      console.error('❌ Failed to initialize anonymous session:', error);
      
      // Create a fallback local user if Supabase anonymous auth fails
      console.log('🔄 Creating fallback local session...');
      const fallbackUser = {
        id: `local_${uuidv4()}`,
        is_anonymous: true,
        email: null,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any;
      
      setState(prevState => ({
        ...prevState,
        user: fallbackUser,
        loading: false,
        isAuthenticated: true,
        mode: 'anonymous',
      }));
      
      console.log('✅ Fallback local session created:', {
        userId: fallbackUser.id,
        isLocal: true
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false; // Flag to prevent double execution in Strict Mode
    
    // Helper function to check if current URL contains auth verification tokens
    const isAuthVerificationCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      // Check for Supabase auth callback parameters (after verification redirect)
      const hasUrlTokens = !!(
        urlParams.get('token') || 
        urlParams.get('type') || 
        urlParams.get('code')
      );
      
      // Check for auth tokens in hash (common after OAuth or verification)
      const hasHashTokens = !!(
        hashParams.get('access_token') || 
        hashParams.get('refresh_token') ||
        hashParams.get('type') ||
        hashParams.get('token_hash')
      );
      
      // Also check if we recently came from a verification URL (within last 10 seconds)
      const recentVerification = sessionStorage.getItem('auth_verification_redirect');
      const wasRecentVerification = recentVerification && 
        (Date.now() - parseInt(recentVerification)) < 10000;
      
      const isVerification = hasUrlTokens || hasHashTokens || wasRecentVerification;
      
      if (isVerification) {
        // Mark that we detected a verification flow
        sessionStorage.setItem('auth_verification_redirect', Date.now().toString());
        console.log('🔍 Verification callback detected:', { 
          hasUrlTokens, 
          hasHashTokens, 
          wasRecentVerification,
          url: window.location.href
        });
      }
      
      return isVerification;
    };
    
    // Get initial session
    supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
      console.log('🔄 AuthContext useEffect: session', session);
      console.log('🔄 User from session:', session?.user ? {
        id: session.user.id,
        email: session.user.email,
        is_anonymous: session.user.is_anonymous,
        email_confirmed_at: session.user.email_confirmed_at
      } : null);
      if (cancelled) return; // Prevent double execution
      
      const user = session?.user ?? null;
      const isAnonymous = user?.is_anonymous ?? false;
      const isVerificationFlow = isAuthVerificationCallback();
      
      // If no user exists, check if this is a verification callback
      if (!user) {
        if (isVerificationFlow) {
          console.log('📧 Email verification callback detected, waiting for auth state change...');
          // Don't create anonymous user - let onAuthStateChange handle verification
          setState(prevState => ({
            ...prevState,
            user: null,
            loading: true, // Keep loading while verification processes
            isAuthenticated: false,
            mode: 'anonymous',
          }));
        } else {
          console.log('No existing session found, creating anonymous session...');
          await performAnonymousSignIn();
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

        // If user is authenticated (not anonymous), sync data on app startup
        if (user && !isAnonymous) {
          console.log('🔄 App startup: syncing data for authenticated user...');
          try {
            // First, ensure user profile exists (create if needed)
            await dataService.ensureUserProfile(user.id);
            
            // Then sync any existing profile data from remote
            await dataService.syncUserProfile(user.id);
            
            // Finally sync verse data (bidirectional)
            console.log('🔄 App startup: syncing verse data from cloud...');
            const syncResult = await dataService.sync(user.id);
            console.log('✅ App startup sync completed:', {
              toRemote: `${syncResult.toRemote.synced} synced, ${syncResult.toRemote.failed} failed`,
              fromRemote: `${syncResult.fromRemote.synced} synced, ${syncResult.fromRemote.failed} failed`
            });
          } catch (error) {
            console.error('Failed to sync data on app startup:', error);
          }
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        const isAnonymous = user?.is_anonymous ?? false;
        
        console.log('🔄 Auth state change:', { 
          event, 
          user: user ? { 
            id: user.id, 
            email: user.email, 
            is_anonymous: user.is_anonymous,
            email_confirmed_at: user.email_confirmed_at 
          } : null 
        });

        // Handle email verification and other auth events
        if (event === 'TOKEN_REFRESHED' && user && !isAnonymous && user.email_confirmed_at) {
          console.log('✅ Email verification completed, updating user profile...');
          
          // Clear verification tracking since auth was successful
          sessionStorage.removeItem('auth_verification_redirect');
          
          // Update the user profile to complete email verification
          try {
            await dataService.completeEmailVerification(user.id, user.email);
          } catch (error) {
            console.error('Failed to complete email verification in profile:', error);
          }
        }
        
        if (event === 'SIGNED_IN' && user && !isAnonymous) {
          console.log('✅ User signed in with email/password');
        }
        
        // Only create anonymous user if we've explicitly signed out
        if (!user && event === 'SIGNED_OUT') {
          console.log('🔄 User signed out, creating new anonymous session...');
          await performAnonymousSignIn();
          return; // Don't update state here, let performAnonymousSignIn handle it
        }
        
        // For email verification and other auth flows, don't create anonymous user
        if (!user && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
          console.log(`⚠️ Auth state change '${event}' with no user, but not creating anonymous user due to auth flow`);
          // For verification flows, if no user after processing, create anonymous user as fallback
          if (event === 'TOKEN_REFRESHED') {
            // Give a small delay to let any ongoing auth processing complete
            setTimeout(async () => {
              const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
              if (!currentSession?.user) {
                console.log('🔄 No user after verification timeout, creating anonymous session as fallback...');
                await performAnonymousSignIn();
              }
            }, 1000);
          }
          return; // Don't update state here - let the timeout handle fallback if needed
        }
        
        setState(prevState => ({
          ...prevState,
          user,
          loading: false,
          isAuthenticated: !!user,
          mode: user ? (isAnonymous ? 'anonymous' : 'authenticated') : 'anonymous',
        }));

        // Sync user profile and verse data when user becomes authenticated
        if (user && !isAnonymous && (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
          console.log('🔄 Syncing user data after authentication...', event);
          try {
            // First, ensure user profile exists (create if needed)
            await dataService.ensureUserProfile(user.id);
            
            // Then sync any existing profile data from remote
            await dataService.syncUserProfile(user.id);
            
            // Finally sync verse data (bidirectional)
            console.log('🔄 Syncing verse data from cloud...');
            const syncResult = await dataService.sync(user.id);
            console.log('✅ Verse data sync completed:', {
              toRemote: `${syncResult.toRemote.synced} synced, ${syncResult.toRemote.failed} failed`,
              fromRemote: `${syncResult.fromRemote.synced} synced, ${syncResult.fromRemote.failed} failed`
            });
          } catch (error) {
            console.error('Failed to sync user data:', error);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [performAnonymousSignIn]);

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
    console.log('🔄 Signing out user...');
    const result = await supabaseClient.auth.signOut();
    
    // Let onAuthStateChange handle the anonymous sign-in automatically
    // Don't update state directly here to avoid conflicts
    
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
    if (!state.user || !state.user.is_anonymous) {
      throw new Error('Can only convert anonymous users');
    }

    // Detect user's timezone automatically  
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentAnonymousUserId = state.user.id;
    
    console.log('🔄 Converting anonymous user to permanent account...', { 
      anonymousUserId: currentAnonymousUserId,
      email 
    });

    try {
      // CORRECT APPROACH: Update the existing anonymous user with email/password
      const result = await supabaseClient.auth.updateUser({
        email,
        password,
        data: {
          full_name: fullName || email.split('@')[0],
          timezone: userTimezone
        }
      });

      if (result.error) {
        console.error('❌ Failed to convert anonymous user:', result.error);
        throw result.error;
      }

      console.log('✅ Anonymous user converted successfully', {
        userId: result.data.user?.id,
        email: result.data.user?.email,
        sameUserId: result.data.user?.id === currentAnonymousUserId
      });

      // The user ID should remain the same - just converted from anonymous to authenticated
      if (result.data.user && result.data.user.id === currentAnonymousUserId) {
        setState(prevState => ({
          ...prevState,
          user: result.data.user,
          loading: false,
          isAuthenticated: true,
          mode: 'authenticated', // Now authenticated with email verification pending
        }));

        console.log('🔄 Creating/updating user profile after conversion...');
        try {
          // Ensure user profile exists with conversion data
          await dataService.ensureUserProfile(result.data.user.id, {
            email: result.data.user.email,
            full_name: fullName,
            timezone: userTimezone
          });
        } catch (error) {
          console.error('Failed to create/sync user profile after conversion:', error);
        }
      } else {
        console.error('❌ User ID mismatch after conversion - data may be lost!');
      }

      return result;
    } catch (error) {
      console.error('❌ Error during anonymous user conversion:', error);
      throw error;
    }
  }, [state.user]);

  const getCurrentUserId = useCallback(() => {
    // Return user ID from current session (anonymous or authenticated)
    return state.user?.id || '';
  }, [state.user?.id]);

  const syncData = useCallback(async () => {
    const user = state.user;
    if (user && !user.is_anonymous) {
      try {
        console.log('🔄 Manual data sync requested...');
        await dataService.syncUserProfile(user.id);
        const syncResult = await dataService.sync(user.id);
        console.log('✅ Manual sync completed:', {
          toRemote: `${syncResult.toRemote.synced} synced, ${syncResult.toRemote.failed} failed`,
          fromRemote: `${syncResult.fromRemote.synced} synced, ${syncResult.fromRemote.failed} failed`
        });
      } catch (error) {
        console.error('❌ Manual sync failed:', error);
        throw error;
      }
    }
  }, [state.user]);

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
    
    // Data sync methods
    syncData,
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
    getCurrentUserId,
    syncData
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