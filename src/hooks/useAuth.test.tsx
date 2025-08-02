/**
 * useAuth Hook Tests
 * 
 * Simple tests focusing on our business logic, not Supabase internals.
 */

import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from './useAuth';

// Simple mock - we trust Supabase works
jest.mock('../services/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null }
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

describe('useAuth Hook', () => {
  test('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
    expect(typeof result.current.signIn).toBe('function');
    expect(typeof result.current.signUp).toBe('function');
    expect(typeof result.current.signOut).toBe('function');
  });
});