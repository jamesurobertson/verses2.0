/**
 * useReview Hook
 * 
 * Manages review sessions using the dual-write architecture.
 * Handles fetching due verses, recording review results, and updating progress.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { localDb } from '../../../services/localDb';
import { dataService } from '../../../services/dataService';
import type { LibraryVerseCard } from '../../Library/hooks/useLibrary';

interface ReviewSession {
  cards: LibraryVerseCard[];
  currentIndex: number;
  correctCount: number;
  incorrectCount: number;
  incorrectCards: LibraryVerseCard[]; // Track cards that were answered incorrectly
  startTime: Date;
}

interface UseReviewReturn {
  dueCards: LibraryVerseCard[];
  todaysCards: LibraryVerseCard[];
  loading: boolean;
  error: string | null;
  sessionActive: boolean;
  currentCard: LibraryVerseCard | null;
  sessionProgress: {
    current: number;
    total: number;
    correctCount: number;
    incorrectCount: number;
  };
  startReview: () => void;
  startTodaysReview: () => void;
  startIncorrectReview: () => void;
  markCardCorrect: () => Promise<void>;
  markCardIncorrect: () => Promise<void>;
  endReview: () => void;
  refreshDueCards: () => Promise<void>;
}

export function useReview(): UseReviewReturn {
  const { user } = useAuth();
  const [dueCards, setDueCards] = useState<LibraryVerseCard[]>([]);
  const [todaysCards, setTodaysCards] = useState<LibraryVerseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);

  /**
   * Loads cards that were reviewed today
   */
  const loadTodaysCards = useCallback(async (userId: string): Promise<LibraryVerseCard[]> => {
    try {
      const localTodaysCards = await localDb.verseCards.getReviewedToday(userId);
      const libraryCards: LibraryVerseCard[] = [];

      for (const card of localTodaysCards) {
        // Get verse data
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
            currentStreak: card.current_streak,
            bestStreak: card.best_streak,
            lastReviewedAt: card.last_reviewed_at,
            archived: card.archived,
            source: 'local'
          });
        }
      }

      return libraryCards;
    } catch (error) {
      console.error('Failed to load today\'s cards:', error);
      return [];
    }
  }, []);

  /**
   * Loads all user cards from local database
   */
  const loadAllCards = useCallback(async (userId: string): Promise<LibraryVerseCard[]> => {
    try {
      const localUserCards = await localDb.verseCards.getByUser(userId);
      const libraryCards: LibraryVerseCard[] = [];

      for (const card of localUserCards) {
        // Get verse data
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
            currentStreak: card.current_streak,
            bestStreak: card.best_streak,
            lastReviewedAt: card.last_reviewed_at,
            archived: card.archived,
            source: 'local'
          });
        }
      }

      return libraryCards;
    } catch (error) {
      console.error('Failed to load all cards:', error);
      return [];
    }
  }, []);

  /**
   * Loads due cards from local database
   */
  const loadDueCards = useCallback(async (userId: string): Promise<LibraryVerseCard[]> => {
    try {
      const localDueCards = await localDb.verseCards.getDue(userId);
      const libraryCards: LibraryVerseCard[] = [];

      for (const card of localDueCards) {
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
            currentStreak: card.current_streak,
            bestStreak: card.best_streak,
            lastReviewedAt: card.last_reviewed_at,
            archived: card.archived,
            source: 'local'
          });
        }
      }

      return libraryCards;
    } catch (error) {
      console.error('Failed to load due cards:', error);
      return [];
    }
  }, []);

  /**
   * Refreshes the due cards list
   */
  const refreshDueCards = useCallback(async () => {
    if (!user) {
      setDueCards([]);
      setTodaysCards([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [dueCardsData, todaysCardsData] = await Promise.all([
        loadDueCards(user.id),
        loadTodaysCards(user.id)
      ]);

      setDueCards(dueCardsData);
      setTodaysCards(todaysCardsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cards';
      setError(errorMessage);
      console.error('Cards refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, loadDueCards, loadTodaysCards]);

  /**
   * Starts a new review session
   */
  const startReview = useCallback(() => {
    if (dueCards.length === 0) return;

    setSession({
      cards: [...dueCards], // Create a copy to avoid mutations
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      incorrectCards: [],
      startTime: new Date()
    });
  }, [dueCards]);

  /**
   * Starts a review session with today's reviewed cards
   */
  const startTodaysReview = useCallback(() => {
    if (todaysCards.length === 0) return;

    setSession({
      cards: [...todaysCards], // Review today's cards
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      incorrectCards: [],
      startTime: new Date()
    });
  }, [todaysCards]);

  /**
   * Starts a review session with only the incorrect cards from the last session
   */
  const startIncorrectReview = useCallback(() => {
    if (!session || session.incorrectCards.length === 0) return;

    setSession({
      cards: [...session.incorrectCards], // Review only the incorrect cards
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      incorrectCards: [],
      startTime: new Date()
    });
  }, [session]);

  /**
   * Marks the current card as correct and advances session
   */
  const markCardCorrect = useCallback(async () => {
    if (!session || !user) return;

    const currentCard = session.cards[session.currentIndex];
    if (!currentCard) return;

    try {
      // Record the review result
      await dataService.recordReview(
        currentCard.id,
        user.id,
        true, // was successful
        true, // counts toward progress
        undefined // review time - could be calculated
      );

      // Update session state
      const newSession = {
        ...session,
        correctCount: session.correctCount + 1,
        currentIndex: session.currentIndex + 1
      };

      setSession(newSession);

      // End session if no more cards
      if (newSession.currentIndex >= newSession.cards.length) {
        endReview();
      }

      // Refresh due cards to reflect changes
      await refreshDueCards();
    } catch (error) {
      console.error('Failed to mark card correct:', error);
      setError('Failed to record review result');
    }
  }, [session, user, refreshDueCards]);

  /**
   * Marks the current card as incorrect and advances session
   */
  const markCardIncorrect = useCallback(async () => {
    if (!session || !user) return;

    const currentCard = session.cards[session.currentIndex];
    if (!currentCard) return;

    try {
      // Record the review result
      await dataService.recordReview(
        currentCard.id,
        user.id,
        false, // was not successful
        false,  // does not count toward progress
        undefined // review time - could be calculated
      );

      // Update session state
      const newSession = {
        ...session,
        incorrectCount: session.incorrectCount + 1,
        incorrectCards: [...session.incorrectCards, currentCard], // Track incorrect card
        currentIndex: session.currentIndex + 1
      };

      setSession(newSession);

      // End session if no more cards
      if (newSession.currentIndex >= newSession.cards.length) {
        endReview();
      }

      // Refresh due cards to reflect changes
      await refreshDueCards();
    } catch (error) {
      console.error('Failed to mark card incorrect:', error);
      setError('Failed to record review result');
    }
  }, [session, user, refreshDueCards]);

  /**
   * Ends the current review session
   */
  const endReview = useCallback(() => {
    if (session) {
      const sessionDuration = (new Date().getTime() - session.startTime.getTime()) / 1000;
      console.log('Review session completed:', {
        totalCards: session.cards.length,
        correctAnswers: session.correctCount,
        incorrectAnswers: session.incorrectCount,
        sessionDuration: Math.round(sessionDuration)
      });
    }

    setSession(null);
  }, [session]);

  // Load due cards when user changes
  useEffect(() => {
    refreshDueCards();
  }, [refreshDueCards]);

  // Calculate derived values
  const sessionActive = session !== null;
  const currentCard = session ? session.cards[session.currentIndex] || null : null;
  const sessionProgress = session ? {
    current: session.currentIndex + 1,
    total: session.cards.length,
    correctCount: session.correctCount,
    incorrectCount: session.incorrectCount
  } : {
    current: 0,
    total: 0,
    correctCount: 0,
    incorrectCount: 0
  };

  return {
    dueCards,
    todaysCards,
    loading,
    error,
    sessionActive,
    currentCard,
    sessionProgress,
    startReview,
    startTodaysReview,
    startIncorrectReview,
    markCardCorrect,
    markCardIncorrect,
    endReview,
    refreshDueCards
  };
}
