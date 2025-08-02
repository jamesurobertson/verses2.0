/**
 * useVerses Hook Tests
 * 
 * Test our data management logic - trust Supabase works.
 */

import { renderHook } from '@testing-library/react';
import { useVerses } from './useVerses';

// Mock dependencies - trust they work
jest.mock('./useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

jest.mock('../services/supabase', () => ({
  db: {
    userVerses: {
      getByUserId: jest.fn().mockResolvedValue({ data: [], error: null }),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('useVerses', () => {
  test('should initialize with empty verses', () => {
    const { result } = renderHook(() => useVerses());
    
    expect(result.current.verses).toEqual([]);
    expect(typeof result.current.addVerse).toBe('function');
    expect(typeof result.current.updateVerse).toBe('function');
    expect(typeof result.current.deleteVerse).toBe('function');
  });
});