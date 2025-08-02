/**
 * TypeScript types for Bible verse data and memorization cards
 * These types should match our database schema exactly.
 */

// Reference display modes for memorization hints
export type ReferenceDisplayMode = 'full' | 'first' | 'blank';

// Session completion summary
export interface SessionSummary {
  totalCards: number;
  correctAnswers: number;
  incorrectAnswers: number;
  sessionDuration?: number; // seconds
  completedAt?: string; // ISO date string
}