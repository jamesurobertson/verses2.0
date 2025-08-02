/**
 * Date utility functions for consistent local date handling
 */

/**
 * Gets today's date in YYYY-MM-DD format using local timezone
 */
export function getTodayString(): string {
  const today = new Date();
  return formatDateToYYYYMMDD(today);
}

/**
 * Formats a Date object to YYYY-MM-DD string using local timezone
 */
export function formatDateToYYYYMMDD(date: Date): string {
  return date.getFullYear() + '-' + 
    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
    String(date.getDate()).padStart(2, '0');
}

/**
 * Gets a date string that is X days from the given date
 */
export function getDateStringDaysFromNow(days: number, fromDate: Date = new Date()): string {
  const targetDate = new Date(fromDate);
  targetDate.setDate(targetDate.getDate() + days);
  return formatDateToYYYYMMDD(targetDate);
}

/**
 * Parses a YYYY-MM-DD date string as a local date (not UTC)
 * This prevents timezone conversion issues when displaying dates
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}