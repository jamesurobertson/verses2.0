import { 
  getTodayString,
  formatDateToYYYYMMDD,
  getDateStringDaysFromNow,
  parseLocalDate,
  getDayOfWeek,
  getWeekParityFromDate,
  calculateUserDateValues
} from './dateUtils';

describe('dateUtils', () => {
  describe('formatDateToYYYYMMDD', () => {
    test('formats date correctly', () => {
      const date = new Date('2024-01-15T10:30:00');
      const result = formatDateToYYYYMMDD(date);
      expect(result).toBe('2024-01-15');
    });
  });

  describe('getTodayString', () => {
    test('returns today as YYYY-MM-DD string', () => {
      const result = getTodayString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getDateStringDaysFromNow', () => {
    test('calculates future date correctly', () => {
      const baseDate = new Date('2024-01-15T12:00:00');
      const result = getDateStringDaysFromNow(5, baseDate);
      expect(result).toBe('2024-01-20');
    });
  });

  describe('parseLocalDate', () => {
    test('parses date string correctly', () => {
      const result = parseLocalDate('2024-01-15');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // 0-indexed
      expect(result.getDate()).toBe(15);
    });
  });

  describe('getDayOfWeek', () => {
    test('returns correct day of week (1-7, Sunday=1)', () => {
      const sunday = new Date('2024-01-07T12:00:00'); // Known Sunday
      expect(getDayOfWeek(sunday)).toBe(1);
      
      const monday = new Date('2024-01-08T12:00:00'); // Known Monday  
      expect(getDayOfWeek(monday)).toBe(2);
    });
  });

  describe('getWeekParityFromDate', () => {
    test('returns week parity (0 or 1)', () => {
      const date = new Date('2024-01-15');
      const parity = getWeekParityFromDate(date);
      expect([0, 1]).toContain(parity);
    });
  });

  describe('calculateUserDateValues', () => {
    test('calculates user date values for timezone', () => {
      const result = calculateUserDateValues('UTC', new Date('2024-01-15T12:00:00Z'));
      expect(result).toHaveProperty('userToday');
      expect(result).toHaveProperty('userDayOfWeek');
      expect(result).toHaveProperty('userWeekParity');
      expect(result).toHaveProperty('userDayOfMonth');
      expect(result.userDayOfWeek).toBeGreaterThanOrEqual(1);
      expect(result.userDayOfWeek).toBeLessThanOrEqual(7);
    });
  });
});

