// TDD Tests for spaced repetition logic
import {
  processReview,
  calculateNextDueDate
} from './spacedRepetition';

describe('calculateNextDueDate', () => {
  test('calculates next due date for daily phase', () => {
    const today = new Date('2024-01-01');
    const nextDate = calculateNextDueDate('daily', today);
    expect(nextDate.toISOString().split('T')[0]).toBe('2024-01-02');
  });

  test('calculates next due date for weekly phase', () => {
    const today = new Date('2024-01-01');
    const nextDate = calculateNextDueDate('weekly', today);
    expect(nextDate.toISOString().split('T')[0]).toBe('2024-01-08');
  });

  test('calculates next due date for biweekly phase', () => {
    const today = new Date('2024-01-01');
    const nextDate = calculateNextDueDate('biweekly', today);
    expect(nextDate.toISOString().split('T')[0]).toBe('2024-01-15');
  });

  test('calculates next due date for monthly phase', () => {
    const today = new Date('2024-01-01');
    const nextDate = calculateNextDueDate('monthly', today);
    expect(nextDate.toISOString().split('T')[0]).toBe('2024-02-01');
  });
});

describe('processReview', () => {
  test('successful review in daily phase increments progress', () => {
    const result = processReview('daily', 0, true, true);
    
    expect(result.current_phase).toBe('daily');
    expect(result.phase_progress_count).toBe(1);
    expect(result.countsTowardProgress).toBe(true);
  });

  test('failed review in daily phase keeps same progress', () => {
    const result = processReview('daily', 5, false, true);
    
    expect(result.current_phase).toBe('daily');
    expect(result.phase_progress_count).toBe(5); // No progress change on failure
    expect(result.countsTowardProgress).toBe(true);
  });

  test('successful review with 14 progress advances to weekly', () => {
    const result = processReview('daily', 13, true, true); // 13 + 1 = 14
    
    expect(result.current_phase).toBe('weekly');
    expect(result.phase_progress_count).toBe(0); // Reset to 0 for new phase
    expect(result.countsTowardProgress).toBe(true);
  });

  test('successful review in weekly phase with 4 progress advances to biweekly', () => {
    const result = processReview('weekly', 3, true, true); // 3 + 1 = 4
    
    expect(result.current_phase).toBe('biweekly');
    expect(result.phase_progress_count).toBe(0);
  });

  test('successful review in biweekly phase with 4 progress advances to monthly', () => {
    const result = processReview('biweekly', 3, true, true); // 3 + 1 = 4
    
    expect(result.current_phase).toBe('monthly');
    expect(result.phase_progress_count).toBe(0);
  });

  test('successful review in monthly phase stays in monthly', () => {
    const result = processReview('monthly', 10, true, true);
    
    expect(result.current_phase).toBe('monthly');
    expect(result.phase_progress_count).toBe(11); // Just increments
  });

  test('review that does not count toward progress returns current state', () => {
    const result = processReview('daily', 5, true, false);
    
    expect(result.current_phase).toBe('daily');
    expect(result.phase_progress_count).toBe(5); // No change
    expect(result.countsTowardProgress).toBe(false);
  });

  test('returns next due date in correct format', () => {
    const result = processReview('daily', 0, true, true);
    
    // Should be YYYY-MM-DD format
    expect(result.next_due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});