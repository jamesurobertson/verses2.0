// TDD Step 1: RED - Write failing tests FIRST for spaced repetition logic
import {
  processReview,
  calculateNextDueDate,
  getDueCards,
  getAdditionalReviewCards,
  createNewVerseCard,
  ReviewPhase,
  VerseCard,
  ReviewResult
} from '../../src/utils/spacedRepetition';

// Test data factories
function createTestCard(overrides: Partial<VerseCard> = {}): VerseCard {
  return {
    id: 'test-card-1',
    verse: {
      reference: 'John 3:16',
      text: 'For God so loved the world...',
      translation: 'ESV'
    },
    currentPhase: 'daily',
    phaseProgressCount: 0,
    lastReviewedAt: null,
    nextDueDate: new Date(),
    archived: false,
    ...overrides
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

describe('Spaced Repetition System (TDD)', () => {
  // These functions don't exist yet - tests should fail!

  describe('Phase Progression Logic', () => {
    test('should advance from daily to weekly after 14 successful reviews', () => {
      const card = createTestCard({ 
        currentPhase: 'daily', 
        phaseProgressCount: 13 
      });
      
      const before = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000); // 6 days from now
      const result = processReview(card, true, true);
      const after = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now
      
      expect(result.newPhase).toBe('weekly');
      expect(result.newProgressCount).toBe(0); // Reset counter for new phase
      expect(result.nextDueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.nextDueDate.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.countsTowardProgress).toBe(true);
    });

    test('should advance from weekly to biweekly after 4 successful reviews', () => {
      const card = createTestCard({ 
        currentPhase: 'weekly', 
        phaseProgressCount: 3 
      });
      
      const baseDate = new Date();
      const result = processReview(card, true, true);
      
      expect(result.newPhase).toBe('biweekly');
      expect(result.newProgressCount).toBe(0);
      // Allow for small timing differences (within 1 second)
      const expectedDate = addWeeks(baseDate, 2);
      const timeDiff = Math.abs(result.nextDueDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
    });

    test('should advance from biweekly to monthly after 4 successful reviews', () => {
      const card = createTestCard({ 
        currentPhase: 'biweekly', 
        phaseProgressCount: 3 
      });
      
      const before = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000); // 29 days from now
      const result = processReview(card, true, true);
      const after = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000); // 32 days from now
      
      expect(result.newPhase).toBe('monthly');
      expect(result.newProgressCount).toBe(0);
      expect(result.nextDueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.nextDueDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should continue monthly phase indefinitely', () => {
      const card = createTestCard({ 
        currentPhase: 'monthly', 
        phaseProgressCount: 100 
      });
      
      const before = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000); // 29 days from now
      const result = processReview(card, true, true);
      const after = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000); // 32 days from now
      
      expect(result.newPhase).toBe('monthly');
      expect(result.newProgressCount).toBe(101);
      expect(result.nextDueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.nextDueDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should not advance phase on failure', () => {
      const card = createTestCard({ 
        currentPhase: 'daily', 
        phaseProgressCount: 13 
      });
      
      const result = processReview(card, false, true);
      
      expect(result.newPhase).toBe('daily');
      expect(result.newProgressCount).toBe(13); // No progress lost
      // Allow for small timing differences (within 1 second)
      const baseDate = new Date();
      const expectedDate = addDays(baseDate, 1);
      const timeDiff = Math.abs(result.nextDueDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
    });

    test('should increment progress count on successful review without advancing', () => {
      const card = createTestCard({ 
        currentPhase: 'daily', 
        phaseProgressCount: 5 
      });
      
      const before = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours from now
      const result = processReview(card, true, true);
      const after = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours from now
      
      expect(result.newPhase).toBe('daily');
      expect(result.newProgressCount).toBe(6);
      expect(result.nextDueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.nextDueDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Additional Review Logic (Critical Feature)', () => {
    test('should not count additional reviews toward progress', () => {
      const card = createTestCard({ 
        currentPhase: 'daily', 
        phaseProgressCount: 5,
        lastReviewedAt: new Date() // Already reviewed today
      });
      
      const before = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours from now
      const result = processReview(card, true, false); // countsTowardProgress = false
      const after = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours from now
      
      expect(result.newPhase).toBe('daily');
      expect(result.newProgressCount).toBe(5); // Unchanged
      expect(result.countsTowardProgress).toBe(false);
      // Should still update due date for regular flow
      expect(result.nextDueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.nextDueDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should identify cards available for additional review', () => {
      const cards = [
        createTestCard({ 
          id: '1', 
          currentPhase: 'daily',
          lastReviewedAt: new Date(), // Reviewed today
          nextDueDate: addDays(new Date(), 1) // Due tomorrow
        }),
        createTestCard({ 
          id: '2', 
          currentPhase: 'weekly',
          lastReviewedAt: addDays(new Date(), -2), // Not reviewed today
          nextDueDate: new Date() // Due today
        }),
        createTestCard({ 
          id: '3', 
          currentPhase: 'daily',
          lastReviewedAt: new Date(), // Reviewed today
          nextDueDate: addDays(new Date(), 1) // Due tomorrow
        })
      ];
      
      const additionalCards = getAdditionalReviewCards(cards);
      
      expect(additionalCards).toHaveLength(2); // Cards 1 and 3
      expect(additionalCards.map(c => c.id)).toEqual(['1', '3']);
    });
  });

  describe('Due Card Filtering', () => {
    test('should return cards due today or overdue', () => {
      const today = new Date();
      const cards = [
        createTestCard({ 
          id: '1', 
          nextDueDate: today // Due today
        }),
        createTestCard({ 
          id: '2', 
          nextDueDate: addDays(today, -1) // Overdue
        }),
        createTestCard({ 
          id: '3', 
          nextDueDate: addDays(today, 1) // Due tomorrow
        }),
        createTestCard({ 
          id: '4', 
          nextDueDate: addDays(today, -3) // Very overdue
        })
      ];
      
      const dueCards = getDueCards(cards);
      
      expect(dueCards).toHaveLength(3); // Cards 1, 2, and 4
      expect(dueCards.map(c => c.id)).toEqual(['1', '2', '4']);
    });

    test('should exclude archived cards from due cards', () => {
      const cards = [
        createTestCard({ 
          id: '1', 
          nextDueDate: new Date(),
          archived: false
        }),
        createTestCard({ 
          id: '2', 
          nextDueDate: new Date(),
          archived: true // Archived
        })
      ];
      
      const dueCards = getDueCards(cards);
      
      expect(dueCards).toHaveLength(1);
      expect(dueCards[0].id).toBe('1');
    });
  });

  describe('Due Date Calculations', () => {
    test('should calculate correct due dates for each phase', () => {
      const baseDate = new Date('2024-01-01T12:00:00Z');
      
      expect(calculateNextDueDate('daily', baseDate)).toEqual(
        new Date('2024-01-02T12:00:00Z')
      );
      expect(calculateNextDueDate('weekly', baseDate)).toEqual(
        new Date('2024-01-08T12:00:00Z')
      );
      expect(calculateNextDueDate('biweekly', baseDate)).toEqual(
        new Date('2024-01-15T12:00:00Z')
      );
      expect(calculateNextDueDate('monthly', baseDate)).toEqual(
        new Date('2024-02-01T12:00:00Z')
      );
    });

    test('should handle month boundaries correctly', () => {
      const endOfMonth = new Date('2024-01-31T12:00:00Z');
      
      const monthlyDue = calculateNextDueDate('monthly', endOfMonth);
      expect(monthlyDue.getMonth()).toBe(1); // February (0-indexed)
      expect(monthlyDue.getDate()).toBe(29); // Feb 29, 2024 (leap year)
    });
  });

  describe('New Verse Card Creation', () => {
    test('should create new verse card with correct defaults', () => {
      const verse = {
        reference: 'Romans 8:28',
        text: 'And we know that in all things...',
        translation: 'ESV'
      };
      
      const before = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours from now
      const card = createNewVerseCard('user-123', verse);
      const after = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours from now
      
      expect(card.verse).toEqual(verse);
      expect(card.currentPhase).toBe('daily');
      expect(card.phaseProgressCount).toBe(0);
      expect(card.lastReviewedAt).toBeNull();
      expect(card.archived).toBe(false);
      expect(card.nextDueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(card.nextDueDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid phases gracefully', () => {
      expect(() => calculateNextDueDate('invalid' as ReviewPhase, new Date()))
        .toThrow('Invalid review phase: invalid');
    });

    test('should handle null/undefined dates', () => {
      expect(() => calculateNextDueDate('daily', null as any))
        .toThrow('Invalid date provided');
    });

    test('should handle empty card arrays', () => {
      expect(getDueCards([])).toEqual([]);
      expect(getAdditionalReviewCards([])).toEqual([]);
    });

    test('should handle cards with corrupted data', () => {
      const corruptedCard = {
        ...createTestCard(),
        currentPhase: 'corrupted' as ReviewPhase,
        phaseProgressCount: -1
      };
      
      expect(() => processReview(corruptedCard, true, true))
        .toThrow('Invalid phase or progress count');
    });
  });

  describe('Performance Requirements', () => {
    test('should handle large numbers of cards efficiently', () => {
      // Create 1000 test cards
      const cards = Array.from({ length: 1000 }, (_, i) => 
        createTestCard({ 
          id: `card-${i}`,
          nextDueDate: i % 2 === 0 ? new Date() : addDays(new Date(), 1)
        })
      );
      
      const startTime = Date.now();
      const dueCards = getDueCards(cards);
      const endTime = Date.now();
      
      expect(dueCards).toHaveLength(500); // Half are due
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Business Logic Validation', () => {
    test('should enforce minimum phase requirements', () => {
      // Daily phase needs exactly 14 successes to advance
      for (let i = 0; i < 13; i++) {
        const card = createTestCard({ 
          currentPhase: 'daily', 
          phaseProgressCount: i 
        });
        const result = processReview(card, true, true);
        expect(result.newPhase).toBe('daily');
      }
      
      // 14th success should advance
      const finalCard = createTestCard({ 
        currentPhase: 'daily', 
        phaseProgressCount: 13 
      });
      const finalResult = processReview(finalCard, true, true);
      expect(finalResult.newPhase).toBe('weekly');
    });

    test('should maintain progress consistency across reviews', () => {
      let card = createTestCard({ 
        currentPhase: 'daily', 
        phaseProgressCount: 0 
      });
      
      // Simulate 14 successful reviews
      for (let i = 0; i < 14; i++) {
        const result = processReview(card, true, true);
        card = {
          ...card,
          currentPhase: result.newPhase as ReviewPhase,
          phaseProgressCount: result.newProgressCount,
          nextDueDate: result.nextDueDate
        };
      }
      
      expect(card.currentPhase).toBe('weekly');
      expect(card.phaseProgressCount).toBe(0);
    });
  });
});