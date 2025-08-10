/**
 * useSlackReview Hook
 * 
 * Manages review sessions with Slack-style local-only session management,
 * undo functionality, and batch cloud sync. Built on preserved database patterns.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../../../contexts/AuthContext";
import { useTimezone } from '../../../contexts/TimezoneContext';
import { localDb } from '../../../services/localDb';
import { dataService } from '../../../services/dataService';
import { filterDueCards } from '../../../utils/assignmentLogic';
import type { LibraryVerseCard } from '../../Library/hooks/useLibrary';

// New interfaces for Slack-style session with undo functionality
interface ReviewAction {
  id: string;
  cardId: string; 
  wasSuccessful: boolean;
  timestamp: number;
  wordRevealProgress?: number; // For progressive word reveal
}

interface ReviewSession {
  cards: LibraryVerseCard[];
  actions: ReviewAction[]; // LOCAL ONLY - for undo system
  currentCardIndex: number;
  wordRevealIndex: number; // For progressive word reveal
  startTime: number;
}

interface UseSlackReviewReturn {
  dueCards: LibraryVerseCard[];
  todaysCards: LibraryVerseCard[];
  loading: boolean;
  error: string | null;
  session: ReviewSession | null;
  currentCard: LibraryVerseCard | null;
  sessionProgress: {
    current: number;
    total: number;
    correctCount: number;
    incorrectCount: number;
  };
  referenceDisplayMode: string;
  startSession: () => void;
  startTodaysSession: () => void;
  startIncorrectSession: () => void;
  markCardCorrect: () => Promise<void>;
  markCardIncorrect: () => Promise<void>;
  undoLastAction: () => void;
  completeSession: () => Promise<void>;
  refreshDueCards: () => Promise<void>;
}

export function useSlackReview(): UseSlackReviewReturn {
  const { getCurrentUserId, getAccessToken } = useAuth();
  const { timezone } = useTimezone();
  const [dueCards, setDueCards] = useState<LibraryVerseCard[]>([]);
  const [todaysCards, setTodaysCards] = useState<LibraryVerseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [referenceDisplayMode, setReferenceDisplayMode] = useState<string>('');

  // PRESERVE EXACT DATABASE PATTERNS from useReview.ts.backup

  /**
   * Loads cards that were reviewed today - PRESERVED PATTERN
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

      return libraryCards;
    } catch (error) {
      console.error('Failed to load today\'s cards:', error);
      return [];
    }
  }, []);

  /**
   * Loads due cards from local database - PRESERVED PATTERN
   */
  const loadDueCards = useCallback(async (userId: string): Promise<LibraryVerseCard[]> => {
    try {
      // Load ALL user cards (not just those with due dates) - EXACT PATTERN
      const allUserCards = await localDb.verseCards.getByUser(userId);
      const libraryCards: LibraryVerseCard[] = [];

      for (const card of allUserCards) {
        const verse = await localDb.verses.findById(card.verse_id);
        if (verse && !verse.validation_error) { // Exclude verses with validation errors
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

      // Filter cards using assignment logic - EXACT PATTERN
      const dueCards = filterDueCards(libraryCards, timezone);
      return dueCards.filter(card => 'verse' in card) as LibraryVerseCard[];
    } catch (error) {
      console.error('Failed to load due cards:', error);
      return [];
    }
  }, [timezone]);

  /**
   * Load reference display mode - PRESERVED PATTERN
   */
  const loadReferenceDisplayMode = useCallback(async (userId: string) => {
    const userProfile = await localDb.userProfiles.findByUserId(userId);
    if (userProfile) {
      setReferenceDisplayMode(userProfile.reference_display_mode);
    }
  }, []);

  /**
   * Refreshes the due cards list - PRESERVED PATTERN
   */
  const refreshDueCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = getCurrentUserId();
      const [dueCardsData, todaysCardsData] = await Promise.all([
        loadDueCards(userId),
        loadTodaysCards(userId)
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
  }, [getCurrentUserId, loadDueCards, loadTodaysCards]);

  // NEW FUNCTIONALITY - Session Management with Undo

  /**
   * Starts a new review session with due cards
   */
  const startSession = useCallback(() => {
    if (dueCards.length === 0) return;

    setSession({
      cards: [...dueCards], // Create a copy to avoid mutations
      actions: [],
      currentCardIndex: 0,
      wordRevealIndex: 0,
      startTime: Date.now()
    });
  }, [dueCards]);

  /**
   * Starts a review session with today's reviewed cards
   */
  const startTodaysSession = useCallback(() => {
    if (todaysCards.length === 0) return;

    setSession({
      cards: [...todaysCards],
      actions: [],
      currentCardIndex: 0,
      wordRevealIndex: 0,
      startTime: Date.now()
    });
  }, [todaysCards]);

  /**
   * Starts a review session with only incorrect cards
   */
  const startIncorrectSession = useCallback(() => {
    if (!session) return;

    const incorrectCards = session.cards.filter((_, index) => {
      const action = session.actions.find(a => a.cardId === session.cards[index].id);
      return action && !action.wasSuccessful;
    });

    if (incorrectCards.length === 0) return;

    setSession({
      cards: incorrectCards,
      actions: [],
      currentCardIndex: 0,
      wordRevealIndex: 0,
      startTime: Date.now()
    });
  }, [session]);

  /**
   * NEW: Undo functionality - removes last action and restores state
   */
  const undoLastAction = useCallback(() => {
    if (!session || session.actions.length === 0) return;
    
    const actionsWithoutLast = session.actions.slice(0, -1);
    const lastAction = session.actions[session.actions.length - 1];
    
    setSession({
      ...session,
      actions: actionsWithoutLast,
      currentCardIndex: Math.max(0, session.currentCardIndex - 1),
      // Restore word reveal progress if applicable
      wordRevealIndex: lastAction.wordRevealProgress ?? session.wordRevealIndex
    });

    console.log('Undo applied:', { 
      removedAction: lastAction, 
      newIndex: Math.max(0, session.currentCardIndex - 1),
      actionsRemaining: actionsWithoutLast.length
    });
  }, [session]);

  /**
   * Marks current card as correct - LOCAL ONLY during session
   */
  const markCardCorrect = useCallback(async () => {
    if (!session || session.currentCardIndex >= session.cards.length) return;

    const currentCard = session.cards[session.currentCardIndex];
    if (!currentCard) return;

    const action: ReviewAction = {
      id: crypto.randomUUID(),
      cardId: currentCard.id,
      wasSuccessful: true,
      timestamp: Date.now(),
      wordRevealProgress: session.wordRevealIndex
    };

    // Update session state LOCALLY ONLY
    setSession({
      ...session,
      actions: [...session.actions, action],
      currentCardIndex: session.currentCardIndex + 1,
      wordRevealIndex: 0 // Reset for next card
    });

    console.log('Card marked correct (local only):', currentCard.verse.reference);
  }, [session]);

  /**
   * Marks current card as incorrect - LOCAL ONLY during session
   */
  const markCardIncorrect = useCallback(async () => {
    if (!session || session.currentCardIndex >= session.cards.length) return;

    const currentCard = session.cards[session.currentCardIndex];
    if (!currentCard) return;

    const action: ReviewAction = {
      id: crypto.randomUUID(),
      cardId: currentCard.id,
      wasSuccessful: false,
      timestamp: Date.now(),
      wordRevealProgress: session.wordRevealIndex
    };

    // Update session state LOCALLY ONLY
    setSession({
      ...session,
      actions: [...session.actions, action],
      currentCardIndex: session.currentCardIndex + 1,
      wordRevealIndex: 0 // Reset for next card
    });

    console.log('Card marked incorrect (local only):', currentCard.verse.reference);
  }, [session]);

  /**
   * NEW: Complete session with BATCH sync to cloud
   */
  const completeSession = useCallback(async () => {
    if (!session) return;
    
    const userId = getCurrentUserId();
    
    try {
      setLoading(true);
      
      // Batch save all review logs to cloud
      const accessToken = await getAccessToken();
      
      for (const action of session.actions) {
        try {
          // First record locally for immediate persistence
          await localDb.reviewLogs.create({
            user_id: userId,
            verse_card_id: action.cardId,
            was_successful: action.wasSuccessful,
            counted_toward_progress: true, // Will be recalculated by server trigger
            review_time_seconds: null
          });

          // Then sync to remote
          await dataService.recordReview(
            action.cardId,
            userId,
            action.wasSuccessful,
            undefined, // review time
            accessToken || undefined
          );

          console.log('Review synced:', action.cardId, action.wasSuccessful);
        } catch (error) {
          console.error('Failed to sync review:', action.cardId, error);
          // Continue with other actions even if one fails
        }
      }

      // Refresh due cards after completion
      await refreshDueCards();
      
    } catch (error) {
      console.error('Failed to complete session:', error);
      setError('Session saved locally. Will sync when connection improves.');
    } finally {
      setLoading(false);
      // Clear session regardless of sync success
      setSession(null);
    }
  }, [session, getCurrentUserId, getAccessToken, refreshDueCards]);

  // Initialize hook
  useEffect(() => {
    refreshDueCards();
    const userId = getCurrentUserId();
    loadReferenceDisplayMode(userId);
  }, [refreshDueCards, getCurrentUserId, loadReferenceDisplayMode]);

  // Calculate derived values
  const currentCard = session ? session.cards[session.currentCardIndex] || null : null;
  
  const sessionProgress = session ? {
    current: session.currentCardIndex,
    total: session.cards.length,
    correctCount: session.actions.filter(a => a.wasSuccessful).length,
    incorrectCount: session.actions.filter(a => !a.wasSuccessful).length
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
    session,
    currentCard,
    sessionProgress,
    referenceDisplayMode,
    startSession,
    startTodaysSession,
    startIncorrectSession,
    markCardCorrect,
    markCardIncorrect,
    undoLastAction,
    completeSession,
    refreshDueCards
  };
}