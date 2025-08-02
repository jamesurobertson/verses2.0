// Spaced Repetition System Implementation

export type ReviewPhase = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface VerseCard {
  id: string;
  verse: {
    reference: string;
    text: string;
    translation: string;
  };
  currentPhase: ReviewPhase;
  phaseProgressCount: number;
  lastReviewedAt: Date | null;
  nextDueDate: Date;
  archived: boolean;
}

export interface ReviewResult {
  newPhase: ReviewPhase;
  newProgressCount: number;
  nextDueDate: Date;
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
 */
export function processReview(
  card: VerseCard, 
  wasSuccessful: boolean, 
  countsTowardProgress: boolean
): ReviewResult {
  // Validate input
  if (!PHASE_REQUIREMENTS[card.currentPhase] && card.currentPhase !== 'monthly') {
    throw new Error('Invalid phase or progress count');
  }
  
  if (card.phaseProgressCount < 0) {
    throw new Error('Invalid phase or progress count');
  }

  const currentPhase = card.currentPhase;
  const currentProgress = card.phaseProgressCount;
  
  // If this doesn't count toward progress, return current state with updated due date
  if (!countsTowardProgress) {
    return {
      newPhase: currentPhase,
      newProgressCount: currentProgress,
      nextDueDate: calculateNextDueDate(currentPhase),
      countsTowardProgress: false
    };
  }

  // If review was unsuccessful, stay in same phase with no progress change
  if (!wasSuccessful) {
    return {
      newPhase: currentPhase,
      newProgressCount: currentProgress,
      nextDueDate: calculateNextDueDate(currentPhase),
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
      newPhase: nextPhase,
      newProgressCount: 0, // Reset progress for new phase
      nextDueDate: calculateNextDueDate(nextPhase),
      countsTowardProgress: true
    };
  }

  // Stay in current phase with incremented progress
  return {
    newPhase: currentPhase,
    newProgressCount: newProgress,
    nextDueDate: calculateNextDueDate(currentPhase),
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

/**
 * Filters cards to return only those that are due today or overdue.
 */
export function getDueCards(cards: VerseCard[]): VerseCard[] {
  if (!cards || cards.length === 0) {
    return [];
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return cards.filter(card => {
    // Exclude archived cards
    if (card.archived) {
      return false;
    }

    // Include if due date is today or earlier
    const cardDueDate = new Date(card.nextDueDate);
    const cardDueDateStart = new Date(
      cardDueDate.getFullYear(), 
      cardDueDate.getMonth(), 
      cardDueDate.getDate()
    );

    return cardDueDateStart <= todayStart;
  });
}

/**
 * Gets cards that are available for additional review (already reviewed today).
 */
export function getAdditionalReviewCards(cards: VerseCard[]): VerseCard[] {
  if (!cards || cards.length === 0) {
    return [];
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return cards.filter(card => {
    // Exclude archived cards
    if (card.archived) {
      return false;
    }

    // Include if already reviewed today (lastReviewedAt is today)
    if (!card.lastReviewedAt) {
      return false;
    }

    const lastReviewed = new Date(card.lastReviewedAt);
    return lastReviewed >= todayStart && lastReviewed <= todayEnd;
  });
}

/**
 * Creates a new verse card with default settings.
 */
export function createNewVerseCard(
  _userId: string,
  verse: { reference: string; text: string; translation: string }
): Omit<VerseCard, 'id'> {
  return {
    verse,
    currentPhase: 'daily',
    phaseProgressCount: 0,
    lastReviewedAt: null,
    nextDueDate: calculateNextDueDate('daily'), // Due tomorrow
    archived: false
  };
}

/**
 * Checks if a card is due for review today.
 */
export function isCardDue(card: VerseCard): boolean {
  const dueCards = getDueCards([card]);
  return dueCards.length > 0;
}

/**
 * Gets statistics about a collection of cards.
 */
export function getCardStats(cards: VerseCard[]) {
  const stats = {
    total: cards.length,
    archived: 0,
    byPhase: {
      daily: 0,
      weekly: 0,
      biweekly: 0,
      monthly: 0
    },
    due: 0,
    overdue: 0
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  cards.forEach(card => {
    if (card.archived) {
      stats.archived++;
      return;
    }

    stats.byPhase[card.currentPhase]++;

    const cardDueDate = new Date(card.nextDueDate);
    const cardDueDateStart = new Date(
      cardDueDate.getFullYear(), 
      cardDueDate.getMonth(), 
      cardDueDate.getDate()
    );

    if (cardDueDateStart.getTime() === todayStart.getTime()) {
      stats.due++;
    } else if (cardDueDateStart < todayStart) {
      stats.overdue++;
    }
  });

  return stats;
}

/**
 * Calculates the completion percentage for a card in its current phase.
 */
export function getPhaseProgress(card: VerseCard): number {
  const requirement = PHASE_REQUIREMENTS[card.currentPhase];
  if (requirement === Infinity) {
    return 100; // Monthly phase is always "complete"
  }
  
  return Math.min(100, (card.phaseProgressCount / requirement) * 100);
}

/**
 * Estimates when a card will advance to the next phase based on daily review rate.
 */
export function estimatePhaseAdvancement(card: VerseCard, dailySuccessRate = 0.8): Date | null {
  const requirement = PHASE_REQUIREMENTS[card.currentPhase];
  if (requirement === Infinity) {
    return null; // Monthly phase doesn't advance
  }

  const remainingReviews = requirement - card.phaseProgressCount;
  if (remainingReviews <= 0) {
    return new Date(); // Already ready to advance
  }

  // Estimate days needed based on success rate
  const estimatedDays = Math.ceil(remainingReviews / dailySuccessRate);
  
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);
  
  return estimatedDate;
}