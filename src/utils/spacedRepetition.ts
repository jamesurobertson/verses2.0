// Spaced Repetition System Implementation

import { formatDateToYYYYMMDD } from './dateUtils';

export type ReviewPhase = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ReviewResult {
  current_phase: ReviewPhase;
  phase_progress_count: number;
  next_due_date: string; // YYYY-MM-DD format
  countsTowardProgress: boolean;
}

// Phase progression requirements
const PHASE_REQUIREMENTS = {
  daily: 14,    // 14 successful reviews to advance to weekly
  weekly: 4,    // 4 successful reviews to advance to biweekly
  biweekly: 4,  // 4 successful reviews to advance to monthly
  monthly: Infinity // Continue indefinitely
} as const;

// Phase intervals in days
const PHASE_INTERVALS = {
  daily: 1,      // 1 day
  weekly: 7,     // 7 days (1 week)
  biweekly: 14,  // 14 days (2 weeks)
  monthly: 30    // 30 days (approximate month)
} as const;

/**
 * Calculates the next due date based on the current phase.
 */
export function calculateNextDueDate(phase: ReviewPhase, fromDate: Date = new Date()): Date {
  if (!fromDate || !(fromDate instanceof Date) || isNaN(fromDate.getTime())) {
    throw new Error('Invalid date provided');
  }

  if (!PHASE_INTERVALS[phase]) {
    throw new Error(`Invalid review phase: ${phase}`);
  }

  const nextDate = new Date(fromDate);

  if (phase === 'monthly') {
    // For monthly, add exactly one month
    nextDate.setMonth(nextDate.getMonth() + 1);
    
    // Handle month boundary edge cases (e.g., Jan 31 -> Feb 28/29)
    if (nextDate.getDate() !== fromDate.getDate()) {
      nextDate.setDate(0); // Go to last day of previous month
    }
  } else {
    // For other phases, add the specified number of days
    nextDate.setDate(nextDate.getDate() + PHASE_INTERVALS[phase]);
  }

  return nextDate;
}

/**
 * Processes a review and determines the new card state.
 * Takes current phase and progress, returns database update object.
 */
export function processReview(
  currentPhase: ReviewPhase,
  currentProgress: number,
  wasSuccessful: boolean, 
  countsTowardProgress: boolean
): ReviewResult {
  // Validate input
  if (!PHASE_REQUIREMENTS[currentPhase] && currentPhase !== 'monthly') {
    throw new Error('Invalid phase or progress count');
  }
  
  if (currentProgress < 0) {
    throw new Error('Invalid phase or progress count');
  }
  
  // If this doesn't count toward progress, return current state with updated due date
  if (!countsTowardProgress) {
    return {
      current_phase: currentPhase,
      phase_progress_count: currentProgress,
      next_due_date: formatDateToYYYYMMDD(calculateNextDueDate(currentPhase)),
      countsTowardProgress: false
    };
  }

  // If review was unsuccessful, stay in same phase with no progress change
  if (!wasSuccessful) {
    return {
      current_phase: currentPhase,
      phase_progress_count: currentProgress,
      next_due_date: formatDateToYYYYMMDD(calculateNextDueDate(currentPhase)),
      countsTowardProgress: true
    };
  }

  // Review was successful and counts toward progress
  const newProgress = currentProgress + 1;
  const phaseRequirement = PHASE_REQUIREMENTS[currentPhase];

  // Check if we should advance to the next phase
  if (newProgress >= phaseRequirement && currentPhase !== 'monthly') {
    const nextPhase = getNextPhase(currentPhase);
    return {
      current_phase: nextPhase,
      phase_progress_count: 0, // Reset progress for new phase
      next_due_date: formatDateToYYYYMMDD(calculateNextDueDate(nextPhase)),
      countsTowardProgress: true
    };
  }

  // Stay in current phase with incremented progress
  return {
    current_phase: currentPhase,
    phase_progress_count: newProgress,
    next_due_date: formatDateToYYYYMMDD(calculateNextDueDate(currentPhase)),
    countsTowardProgress: true
  };
}

/**
 * Gets the next phase in the progression sequence.
 */
function getNextPhase(currentPhase: ReviewPhase): ReviewPhase {
  const progression: Record<ReviewPhase, ReviewPhase> = {
    daily: 'weekly',
    weekly: 'biweekly',
    biweekly: 'monthly',
    monthly: 'monthly' // Monthly continues indefinitely
  };
  
  return progression[currentPhase];
}

