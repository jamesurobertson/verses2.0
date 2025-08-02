/**
 * useAuth Hook
 * 
 * Simple authentication state management following Supabase patterns.
 * We trust Supabase's implementation and only test our business logic.
 */

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseClient } from '../services/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
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

  const signIn = (email: string, password: string) => {
    return supabaseClient.auth.signInWithPassword({ email, password });
  };

  const signUp = (email: string, password: string) => {
    console.log({email, password})
    return supabaseClient.auth.signUp({ email, password });
  };

  const signOut = () => {
    return supabaseClient.auth.signOut();
  };

  return {
    user: state.user,
    loading: state.loading,
    isAuthenticated: state.isAuthenticated,
    signIn,
    signUp,
    signOut,
  };
}
