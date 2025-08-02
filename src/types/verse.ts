/**
 * TypeScript types for Bible verse data and memorization cards
 */

// Core verse data from the shared cache
export interface Verse {
  id: string;
  reference: string; // e.g., "John 3:16"
  text: string;
  translation: string; // e.g., "ESV"
}

// User's personal memorization card
export interface VerseCardData {
  id: string;
  verse: Verse;
  currentPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  nextDueDate: string; // ISO date string
  currentStreak: number;
  bestStreak?: number;
  lastReviewedAt?: string; // ISO date string
  archived?: boolean;
}

// Review session results
export interface ReviewResult {
  cardId: string;
  wasSuccessful: boolean;
  reviewTimeSeconds?: number;
}

// Session completion summary
export interface SessionSummary {
  totalCards: number;
  correctAnswers: number;
  incorrectAnswers: number;
  sessionDuration?: number; // seconds
  completedAt?: string; // ISO date string
}

// Reference display modes for memorization hints
export type ReferenceDisplayMode = 'full' | 'first' | 'blank';

// Component props types
export interface VerseCardProps {
  verseCard: VerseCardData;
  referenceDisplayMode: ReferenceDisplayMode;
  showingText: boolean;
  onCorrect: (cardId: string) => void;
  onIncorrect: (cardId: string) => void;
  onToggleView: () => void;
}

export interface VerseStackProps {
  cards: VerseCardData[];
  referenceDisplayMode: ReferenceDisplayMode;
  onCardCorrect: (cardId: string) => void;
  onCardIncorrect: (cardId: string) => void;
  onSessionComplete: (summary: SessionSummary) => void;
}

// Utility type for card review actions
export interface CardActions {
  correct: () => void;
  incorrect: () => void;
  toggle: () => void;
}