/**
 * useVerseDetails Hook
 * 
 * Manages individual verse details data using the dual-write architecture.
 * Provides access to a specific verse card with full details for management.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { localDb } from '../../../services/localDb';

// Detailed verse card interface with all management fields
export interface VerseDetails {
  id: string;
  verse: {
    id: string;
    reference: string;
    text: string;
    translation: string;
  };
  currentPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  phaseProgressCount: number;
  nextDueDate: string;
  assignedDayOfWeek: number | null;    // 1-7 (Sunday=1) for weekly/biweekly
  assignedWeekParity: number | null;   // 0 or 1 for biweekly scheduling
  assignedDayOfMonth: number | null;   // 1-28 for monthly scheduling
  currentStreak: number;
  bestStreak: number;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseVerseDetailsReturn {
  verseDetails: VerseDetails | null;
  loading: boolean;
  error: string | null;
  refreshDetails: () => Promise<void>;
  clearError: () => void;
}

export function useVerseDetails(verseCardId: string): UseVerseDetailsReturn {
  const { user } = useAuth();
  const [verseDetails, setVerseDetails] = useState<VerseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads verse details from local database
   */
  const loadVerseDetails = useCallback(async (cardId: string): Promise<VerseDetails | null> => {
    try {
      const card = await localDb.verseCards.get(cardId);
      if (!card) {
        throw new Error('Verse card not found');
      }

      const verse = await localDb.verses.findById(card.verse_id);
      if (!verse) {
        throw new Error('Verse not found');
      }

      return {
        id: card.id!,
        verse: {
          id: verse.id!,
          reference: verse.reference,
          text: verse.text,
          translation: verse.translation
        },
        currentPhase: card.current_phase,
        phaseProgressCount: card.phase_progress_count,
        nextDueDate: card.next_due_date,
        assignedDayOfWeek: card.assigned_day_of_week,
        assignedWeekParity: card.assigned_week_parity,
        assignedDayOfMonth: card.assigned_day_of_month,
        currentStreak: card.current_streak,
        bestStreak: card.best_streak,
        lastReviewedAt: card.last_reviewed_at,
        createdAt: card.created_at,
        updatedAt: card.updated_at
      };
    } catch (error) {
      console.error('Failed to load verse details:', error);
      return null;
    }
  }, []);

  /**
   * Refreshes the verse details from local storage
   */
  const refreshDetails = useCallback(async () => {
    if (!user || !verseCardId) {
      setVerseDetails(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const details = await loadVerseDetails(verseCardId);
      if (!details) {
        throw new Error('Verse details not found');
      }

      setVerseDetails(details);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load verse details';
      setError(errorMessage);
      console.error('Verse details load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, verseCardId, loadVerseDetails]);

  /**
   * Clears error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load details when user or verseCardId changes
  useEffect(() => {
    refreshDetails();
  }, [refreshDetails]);

  return {
    verseDetails,
    loading,
    error,
    refreshDetails,
    clearError
  };
}