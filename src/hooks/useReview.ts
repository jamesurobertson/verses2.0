/**
 * useReview Hook
 * 
 * Manages review sessions and spaced repetition logic.
 */

import { useState, useCallback } from 'react';
import { processReview } from '../utils/spacedRepetition';
import { useVerses } from './useVerses';
import type { VerseCardData, SessionSummary } from '../types/verse';

interface UseReviewReturn {
  dueCards: VerseCardData[];
  sessionActive: boolean;
  startReview: () => VerseCardData[];
  endReview: (summary: SessionSummary) => void;
  markCardCorrect: (cardId: string) => Promise<void>;
  markCardIncorrect: (cardId: string) => Promise<void>;
}

export function useReview(): UseReviewReturn {
  const { verses, updateVerse } = useVerses();
  const [sessionActive, setSessionActive] = useState(false);

  // For now, return empty array since we have type mismatches to fix
  const dueCards: VerseCardData[] = [];

  const startReview = useCallback(() => {
    setSessionActive(true);
    return dueCards;
  }, [dueCards]);

  const endReview = useCallback((summary: SessionSummary) => {
    setSessionActive(false);
    // Could store session stats here
    console.log('Session completed:', summary);
  }, []);

  const markCardCorrect = useCallback(async (cardId: string) => {
    const card = verses.find(v => v.id === cardId);
    if (!card) return;

    // Convert VerseCardData to VerseCard format for processReview
    const verseCard = {
      id: card.id,
      verse: card.verse,
      currentPhase: card.currentPhase,
      phaseProgressCount: 0, // This would come from database
      lastReviewedAt: new Date(),
      nextDueDate: new Date(card.nextDueDate),
      archived: false,
    };

    const result = processReview(verseCard, true, true);
    
    // Convert back to VerseCardData format
    const updatedCard = {
      ...card,
      currentPhase: result.newPhase,
      nextDueDate: result.nextDueDate.toISOString().split('T')[0],
      currentStreak: card.currentStreak + 1,
    };
    
    await updateVerse(updatedCard);
  }, [verses, updateVerse]);

  const markCardIncorrect = useCallback(async (cardId: string) => {
    const card = verses.find(v => v.id === cardId);
    if (!card) return;

    // Convert VerseCardData to VerseCard format for processReview
    const verseCard = {
      id: card.id,
      verse: card.verse,
      currentPhase: card.currentPhase,
      phaseProgressCount: 0, // This would come from database
      lastReviewedAt: new Date(),
      nextDueDate: new Date(card.nextDueDate),
      archived: false,
    };

    const result = processReview(verseCard, false, true);
    
    // Convert back to VerseCardData format
    const updatedCard = {
      ...card,
      currentPhase: result.newPhase,
      nextDueDate: result.nextDueDate.toISOString().split('T')[0],
      currentStreak: 0, // Reset streak on failure
    };
    
    await updateVerse(updatedCard);
  }, [verses, updateVerse]);

  return {
    dueCards,
    sessionActive,
    startReview,
    endReview,
    markCardCorrect,
    markCardIncorrect,
  };
}