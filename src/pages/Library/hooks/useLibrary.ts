/**
 * useLibrary Hook
 * 
 * Manages verse library data using the dual-write architecture (local + remote).
 * Provides access to user's verse collection with offline-first functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTimezone } from '../../../contexts/TimezoneContext';
import { localDb } from '../../../services/localDb';
import { countDueCards } from '../../../utils/assignmentLogic';

// Library-specific verse card interface with assignment fields
export interface LibraryVerseCard {
  id: string;
  verse: {
    id: string;
    reference: string;
    text: string;
    translation: string;
  };
  currentPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  nextDueDate: string;
  assignedDayOfWeek: number | null;    // 1-7 (Sunday=1) for weekly/biweekly
  assignedWeekParity: number | null;   // 0 or 1 for biweekly scheduling
  assignedDayOfMonth: number | null;   // 1-28 for monthly scheduling
  currentStreak: number;
  bestStreak: number;
  lastReviewedAt: string | null;
  archived: boolean;
  source: 'local' | 'remote' | 'both';
}

interface UseLibraryReturn {
  verses: LibraryVerseCard[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  dueCount: number;
  refreshLibrary: () => Promise<void>;
  clearError: () => void;
}

export function useLibrary(): UseLibraryReturn {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  const [verses, setVerses] = useState<LibraryVerseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads verses from local database (primary source)
   */
  const loadLocalVerses = useCallback(async (userId: string): Promise<LibraryVerseCard[]> => {
    try {
      const localCards = await localDb.verseCards.getByUser(userId);
      const libraryCards: LibraryVerseCard[] = [];

      for (const card of localCards) {
        const verse = await localDb.verses.findById(card.verse_id);
        if (verse) {
          libraryCards.push({
            id: card.id!,
            verse: {
              id: verse.id!,
              reference: verse.reference,
              text: verse.text,
              translation: verse.translation
            },
            currentPhase: card.current_phase,
            nextDueDate: card.next_due_date,
            assignedDayOfWeek: card.assigned_day_of_week,
            assignedWeekParity: card.assigned_week_parity,
            assignedDayOfMonth: card.assigned_day_of_month,
            currentStreak: card.current_streak,
            bestStreak: card.best_streak,
            lastReviewedAt: card.last_reviewed_at,
            archived: card.archived,
            source: 'local'
          });
        }
      }

      return libraryCards.sort((a, b) => new Date(b.verse.reference).getTime() - new Date(a.verse.reference).getTime());
    } catch (error) {
      console.error('Failed to load local verses:', error);
      return [];
    }
  }, []);

  /**
   * Refreshes the verse library from local storage
   */
  const refreshLibrary = useCallback(async () => {
    if (!user) {
      setVerses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load from local database (primary source)
      const localVerses = await loadLocalVerses(user.id);
      setVerses(localVerses);

      // TODO: In the future, we could merge with remote data here
      // const remoteVerses = await dataService.getUserVerses(user.id);
      // const mergedVerses = mergeLocalAndRemote(localVerses, remoteVerses);
      // setVerses(mergedVerses);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load verse library';
      setError(errorMessage);
      console.error('Library refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, loadLocalVerses]);

  /**
   * Clears error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load library when user changes
  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // Calculate derived values using assignment-aware logic
  const totalCount = verses.length;
  const dueCount = countDueCards(verses, timezone);

  return {
    verses,
    loading,
    error,
    totalCount,
    dueCount,
    refreshLibrary,
    clearError
  };
}