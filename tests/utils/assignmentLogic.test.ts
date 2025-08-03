/**
 * Unit tests for assignment logic module
 * Tests the assignment-based due card detection system
 */

// Mock the dateUtils module before importing the assignment logic
jest.mock('../../src/utils/dateUtils', () => ({
  calculateUserDateValues: jest.fn(() => ({
    userToday: new Date('2024-01-15'),
    userDayOfWeek: 1, // Sunday
    userWeekParity: 0,
    userDayOfMonth: 15
  }))
}));

import { 
  isDueBasedOnAssignment, 
  filterDueCards, 
  countDueCards,
  validateCardAssignments,
  explainCardDueStatus,
  type LibraryVerseCard,
  type AssignmentCalculation 
} from '../../src/utils/assignmentLogic';

// Mock card data for testing
const createMockCard = (
  phase: 'daily' | 'weekly' | 'biweekly' | 'monthly',
  archived = false,
  assignedDayOfWeek: number | null = null,
  assignedWeekParity: number | null = null,
  assignedDayOfMonth: number | null = null
): LibraryVerseCard => ({
  id: 'test-card-1',
  currentPhase: phase,
  archived,
  assignedDayOfWeek,
  assignedWeekParity,
  assignedDayOfMonth,
  nextDueDate: '2024-01-01',
  verse: {
    id: 'test-verse-1',
    reference: 'John 3:16',
    text: 'For God so loved the world...',
    translation: 'ESV'
  }
});

// Mock user calculation for testing
const createMockUserCalculation = (
  dayOfWeek = 1, // Sunday
  weekParity = 0,
  dayOfMonth = 15
): AssignmentCalculation => ({
  userToday: new Date('2024-01-15'), // Sunday
  userDayOfWeek: dayOfWeek,
  userWeekParity: weekParity,
  userDayOfMonth: dayOfMonth
});

describe('isDueBasedOnAssignment', () => {
  test('daily cards are always due', () => {
    const card = createMockCard('daily');
    const userCalc = createMockUserCalculation();
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(true);
  });

  test('archived cards are never due', () => {
    const card = createMockCard('daily', true); // archived
    const userCalc = createMockUserCalculation();
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(false);
  });

  test('weekly cards due on assigned weekday', () => {
    const card = createMockCard('weekly', false, 1); // assigned to Sunday
    const userCalc = createMockUserCalculation(1); // user day is Sunday
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(true);
  });

  test('weekly cards not due on different weekday', () => {
    const card = createMockCard('weekly', false, 2); // assigned to Monday
    const userCalc = createMockUserCalculation(1); // user day is Sunday
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(false);
  });

  test('biweekly cards due on assigned weekday and week parity', () => {
    const card = createMockCard('biweekly', false, 1, 0); // Sunday, even week
    const userCalc = createMockUserCalculation(1, 0); // Sunday, even week
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(true);
  });

  test('biweekly cards not due on wrong week parity', () => {
    const card = createMockCard('biweekly', false, 1, 0); // Sunday, even week
    const userCalc = createMockUserCalculation(1, 1); // Sunday, odd week
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(false);
  });

  test('biweekly cards not due on wrong weekday', () => {
    const card = createMockCard('biweekly', false, 1, 0); // Sunday, even week
    const userCalc = createMockUserCalculation(2, 0); // Monday, even week
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(false);
  });

  test('monthly cards due on assigned day of month (within 1-28)', () => {
    const card = createMockCard('monthly', false, null, null, 15); // 15th of month
    const userCalc = createMockUserCalculation(1, 0, 15); // 15th of month
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(true);
  });

  test('monthly cards not due on different day of month', () => {
    const card = createMockCard('monthly', false, null, null, 15); // 15th of month
    const userCalc = createMockUserCalculation(1, 0, 16); // 16th of month
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(false);
  });

  test('monthly cards not due when day of month > 28', () => {
    const card = createMockCard('monthly', false, null, null, 15); // 15th of month
    const userCalc = createMockUserCalculation(1, 0, 30); // 30th of month (invalid)
    
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(false);
  });
});

describe('filterDueCards', () => {
  test('filters cards correctly based on assignment logic', () => {
    const cards = [
      createMockCard('daily'), // Should be due
      createMockCard('weekly', false, 1), // Should be due (Sunday)
      createMockCard('weekly', false, 2), // Should not be due (Monday)
      createMockCard('daily', true), // Should not be due (archived)
    ];
    
    const timezone = 'America/New_York';
    
    const dueCards = filterDueCards(cards, timezone);
    
    expect(dueCards).toHaveLength(2); // daily + weekly on Sunday
    expect(dueCards[0].currentPhase).toBe('daily');
    expect(dueCards[1].currentPhase).toBe('weekly');
  });
});

describe('countDueCards', () => {
  test('counts due cards correctly', () => {
    const cards = [
      createMockCard('daily'),
      createMockCard('weekly', false, 1),
      createMockCard('weekly', false, 2),
      createMockCard('daily', true), // archived
    ];
    
    const timezone = 'America/New_York';
    
    const count = countDueCards(cards, timezone);
    expect(count).toBe(2);
  });
});

describe('validateCardAssignments', () => {
  test('validates daily card assignments', () => {
    const validDaily = createMockCard('daily');
    const result = validateCardAssignments(validDaily);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('detects invalid daily card assignments', () => {
    const invalidDaily = createMockCard('daily', false, 1); // daily with day of week
    const result = validateCardAssignments(invalidDaily);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Daily card should not have assignedDayOfWeek set');
  });

  test('validates weekly card assignments', () => {
    const validWeekly = createMockCard('weekly', false, 3); // Wednesday
    const result = validateCardAssignments(validWeekly);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('detects invalid weekly card assignments', () => {
    const invalidWeekly = createMockCard('weekly'); // no day of week assigned
    const result = validateCardAssignments(invalidWeekly);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Weekly card must have assignedDayOfWeek set');
  });

  test('validates biweekly card assignments', () => {
    const validBiweekly = createMockCard('biweekly', false, 3, 1); // Wednesday, odd week
    const result = validateCardAssignments(validBiweekly);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('detects invalid biweekly card assignments', () => {
    const invalidBiweekly = createMockCard('biweekly', false, 3); // missing week parity
    const result = validateCardAssignments(invalidBiweekly);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Biweekly card must have assignedWeekParity set');
  });

  test('validates monthly card assignments', () => {
    const validMonthly = createMockCard('monthly', false, null, null, 15);
    const result = validateCardAssignments(validMonthly);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('detects invalid monthly card assignments', () => {
    const invalidMonthly = createMockCard('monthly'); // no day of month assigned
    const result = validateCardAssignments(invalidMonthly);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Monthly card must have assignedDayOfMonth set');
  });

  test('validates day of month range for monthly cards', () => {
    const invalidRange = createMockCard('monthly', false, null, null, 30); // > 28
    const result = validateCardAssignments(invalidRange);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Monthly card assignedDayOfMonth must be 1-28');
  });
});

describe('explainCardDueStatus', () => {
  test('explains why daily cards are due', () => {
    const card = createMockCard('daily');
    const explanation = explainCardDueStatus(card, 'America/New_York');
    
    expect(explanation).toContain('Due (daily always due)');
  });

  test('explains why archived cards are not due', () => {
    const card = createMockCard('daily', true);
    const explanation = explainCardDueStatus(card, 'America/New_York');
    
    expect(explanation).toBe('Card is archived');
  });

  test('explains weekly card status', () => {
    const card = createMockCard('weekly', false, 1); // Sunday
    
    const explanation = explainCardDueStatus(card, 'America/New_York');
    
    expect(explanation).toContain('weekly');
    expect(explanation).toContain('assigned DOW 1');
  });
});