/**
 * App Context Tests
 * 
 * Test our state management logic only - trust React Context works.
 */

import { renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext';

const mockVerse = {
  id: 'test-1',
  verse: {
    id: 'verse-1',
    reference: 'John 3:16',
    text: 'For God so loved the world...',
    translation: 'ESV',
  },
  currentPhase: 'daily' as const,
  nextDueDate: '2025-07-24',
  currentStreak: 1,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}

describe('AppContext', () => {
  test('should add verse to state', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.addVerse(mockVerse);
    });

    expect(result.current.state.verses).toHaveLength(1);
    expect(result.current.state.verses[0]).toEqual(mockVerse);
  });

  test('should start and end session', () => {
    const { result } = renderHook(() => useApp(), { wrapper });

    act(() => {
      result.current.startSession([mockVerse]);
    });

    expect(result.current.state.currentSession.isActive).toBe(true);
    expect(result.current.state.currentSession.cards).toHaveLength(1);

    act(() => {
      result.current.endSession();
    });

    expect(result.current.state.currentSession.isActive).toBe(false);
    expect(result.current.state.currentSession.cards).toHaveLength(0);
  });
});