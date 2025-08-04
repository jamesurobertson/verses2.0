/**
 * Assignment Logic Module
 * 
 * Implements assignment-based due card detection that mirrors the SQL logic
 * from the database migration's due_cards_view. This replaces simple date
 * comparison with phase-aware scheduling based on user timezone.
 */

import { calculateUserDateValues } from './dateUtils';

// Types for assignment-based scheduling
export interface AssignmentCalculation {
  userToday: Date;
  userDayOfWeek: number;
  userWeekParity: number;
  userDayOfMonth: number;
}

export interface LibraryVerseCard {
  id: string;
  currentPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  archived: boolean;
  assignedDayOfWeek: number | null;
  assignedWeekParity: number | null;
  assignedDayOfMonth: number | null;
  nextDueDate: string;
  verse: {
    id: string;
    reference: string;
    text: string;
    translation: string;
  };
}

export interface ReviewPhaseCard {
  id: string;
  currentPhase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  archived: boolean;
  assignedDayOfWeek?: number | null;
  assignedWeekParity?: number | null;
  assignedDayOfMonth?: number | null;
}

/**
 * Determines if a card is due based on assignment logic (mirrors SQL due_cards_view)
 * 
 * This function implements the exact same logic as the SQL migration:
 * - Daily cards are always due
 * - Weekly cards due on assigned weekday
 * - Biweekly cards due on assigned weekday + week parity
 * - Monthly cards due on assigned day of month (1-28 only)
 */
export function isDueBasedOnAssignment(
  card: LibraryVerseCard | ReviewPhaseCard,
  userCalculation: AssignmentCalculation
): boolean {
  // Archived cards are never due
  if (card.archived) {
    return false;
  }

  switch (card.currentPhase) {
    case 'daily':
      // Daily cards are always due
      return true;

    case 'weekly':
      // Weekly cards due on assigned weekday
      return card.assignedDayOfWeek === userCalculation.userDayOfWeek;

    case 'biweekly':
      // Biweekly cards due on assigned weekday + week parity (epoch-based)
      return (
        card.assignedDayOfWeek === userCalculation.userDayOfWeek &&
        card.assignedWeekParity === userCalculation.userWeekParity
      );

    case 'monthly':
      // Monthly cards due on assigned day of month (only days 1-28)
      return (
        card.assignedDayOfMonth === userCalculation.userDayOfMonth &&
        userCalculation.userDayOfMonth <= 28
      );

    default:
      // Unknown phase - not due
      return false;
  }
}

/**
 * Filters an array of cards to return only those that are due based on assignments
 */
export function filterDueCards(
  cards: LibraryVerseCard[] | ReviewPhaseCard[],
  timezone: string
): (LibraryVerseCard | ReviewPhaseCard)[] {
  const userCalculation = calculateUserDateValues(timezone);
  
  return cards.filter(card => 
    isDueBasedOnAssignment(card, userCalculation)
  );
}

/**
 * Counts how many cards are due based on assignment logic
 */
export function countDueCards(
  cards: LibraryVerseCard[] | ReviewPhaseCard[],
  timezone: string
): number {
  return filterDueCards(cards, timezone).length;
}

/**
 * Groups cards by their assignment status for debugging/analysis
 */
export function groupCardsByAssignmentStatus(
  cards: LibraryVerseCard[] | ReviewPhaseCard[],
  timezone: string
) {
  const userCalculation = calculateUserDateValues(timezone);
  
  const result = {
    due: [] as (LibraryVerseCard | ReviewPhaseCard)[],
    notDue: [] as (LibraryVerseCard | ReviewPhaseCard)[],
    archived: [] as (LibraryVerseCard | ReviewPhaseCard)[],
    byPhase: {
      daily: [] as (LibraryVerseCard | ReviewPhaseCard)[],
      weekly: [] as (LibraryVerseCard | ReviewPhaseCard)[],
      biweekly: [] as (LibraryVerseCard | ReviewPhaseCard)[],
      monthly: [] as (LibraryVerseCard | ReviewPhaseCard)[],
    }
  };

  for (const card of cards) {
    // Group by phase
    result.byPhase[card.currentPhase].push(card);

    // Group by status
    if (card.archived) {
      result.archived.push(card);
    } else if (isDueBasedOnAssignment(card, userCalculation)) {
      result.due.push(card);
    } else {
      result.notDue.push(card);
    }
  }

  return result;
}

/**
 * Validates assignment field consistency for a card
 * Helps catch data integrity issues
 */
export function validateCardAssignments(card: LibraryVerseCard | ReviewPhaseCard): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  switch (card.currentPhase) {
    case 'daily':
      // Daily cards should have no assignment fields set
      if (card.assignedDayOfWeek !== null) {
        errors.push('Daily card should not have assignedDayOfWeek set');
      }
      if (card.assignedWeekParity !== null) {
        errors.push('Daily card should not have assignedWeekParity set');
      }
      if (card.assignedDayOfMonth !== null) {
        errors.push('Daily card should not have assignedDayOfMonth set');
      }
      break;

    case 'weekly':
      // Weekly cards should have day of week but not parity or day of month
      if (card.assignedDayOfWeek === null) {
        errors.push('Weekly card must have assignedDayOfWeek set');
      } else if (card.assignedDayOfWeek! < 1 || card.assignedDayOfWeek! > 7) {
        errors.push('Weekly card assignedDayOfWeek must be 1-7');
      }
      if (card.assignedWeekParity !== null) {
        errors.push('Weekly card should not have assignedWeekParity set');
      }
      if (card.assignedDayOfMonth !== null) {
        errors.push('Weekly card should not have assignedDayOfMonth set');
      }
      break;

    case 'biweekly':
      // Biweekly cards should have day of week and week parity
      if (card.assignedDayOfWeek === null) {
        errors.push('Biweekly card must have assignedDayOfWeek set');
      } else if (card.assignedDayOfWeek! < 1 || card.assignedDayOfWeek! > 7) {
        errors.push('Biweekly card assignedDayOfWeek must be 1-7');
      }
      if (card.assignedWeekParity === null) {
        errors.push('Biweekly card must have assignedWeekParity set');
      } else if (card.assignedWeekParity !== 0 && card.assignedWeekParity !== 1) {
        errors.push('Biweekly card assignedWeekParity must be 0 or 1');
      }
      if (card.assignedDayOfMonth !== null) {
        errors.push('Biweekly card should not have assignedDayOfMonth set');
      }
      break;

    case 'monthly':
      // Monthly cards should have day of month but not day of week or parity
      if (card.assignedDayOfMonth === null) {
        errors.push('Monthly card must have assignedDayOfMonth set');
      } else if (card.assignedDayOfMonth! < 1 || card.assignedDayOfMonth! > 28) {
        errors.push('Monthly card assignedDayOfMonth must be 1-28');
      }
      if (card.assignedDayOfWeek !== null) {
        errors.push('Monthly card should not have assignedDayOfWeek set');
      }
      if (card.assignedWeekParity !== null) {
        errors.push('Monthly card should not have assignedWeekParity set');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Debug utility to explain why a card is or isn't due
 */
export function explainCardDueStatus(
  card: LibraryVerseCard | ReviewPhaseCard,
  timezone: string
): string {
  if (card.archived) {
    return 'Card is archived';
  }

  const userCalculation = calculateUserDateValues(timezone);
  const isDue = isDueBasedOnAssignment(card, userCalculation);

  const debugInfo = [
    `Phase: ${card.currentPhase}`,
    `User DOW: ${userCalculation.userDayOfWeek}`,
    `User Week Parity: ${userCalculation.userWeekParity}`,
    `User DOM: ${userCalculation.userDayOfMonth}`,
    `Assigned DOW: ${card.assignedDayOfWeek}`,
    `Assigned Week Parity: ${card.assignedWeekParity}`,
    `Assigned DOM: ${card.assignedDayOfMonth}`,
  ].join(', ');

  switch (card.currentPhase) {
    case 'daily':
      return `Due (daily always due). ${debugInfo}`;
    
    case 'weekly':
      return `${isDue ? 'Due' : 'Not due'} (weekly: assigned DOW ${card.assignedDayOfWeek} ${
        isDue ? '==' : '!='
      } user DOW ${userCalculation.userDayOfWeek}). ${debugInfo}`;
    
    case 'biweekly':
      return `${isDue ? 'Due' : 'Not due'} (biweekly: assigned DOW ${card.assignedDayOfWeek} ${
        card.assignedDayOfWeek === userCalculation.userDayOfWeek ? '==' : '!='
      } user DOW ${userCalculation.userDayOfWeek} AND assigned parity ${card.assignedWeekParity} ${
        card.assignedWeekParity === userCalculation.userWeekParity ? '==' : '!='
      } user parity ${userCalculation.userWeekParity}). ${debugInfo}`;
    
    case 'monthly': {
      const domValid = userCalculation.userDayOfMonth <= 28;
      return `${isDue ? 'Due' : 'Not due'} (monthly: assigned DOM ${card.assignedDayOfMonth} ${
        card.assignedDayOfMonth === userCalculation.userDayOfMonth ? '==' : '!='
      } user DOM ${userCalculation.userDayOfMonth}, DOM valid: ${domValid}). ${debugInfo}`;
    }
    
    default:
      return `Unknown phase: ${card.currentPhase}. ${debugInfo}`;
  }
}