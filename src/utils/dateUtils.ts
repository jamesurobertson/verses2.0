/**
 * Date utility functions for consistent local date handling
 * Includes both legacy local timezone functions and new timezone-aware utilities
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

/**
 * TIMEZONE-AWARE UTILITIES
 * These functions work with specific timezones for assignment-based scheduling
 */

/**
 * Gets today's date in a specific timezone in YYYY-MM-DD format
 */
export function getUserTodayInTimezone(timezone: string): Date {
  const now = new Date();
  const userDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return userDate;
}

/**
 * Gets today's date string in a specific timezone (YYYY-MM-DD format)
 */
export function getUserTodayStringInTimezone(timezone: string): string {
  const userToday = getUserTodayInTimezone(timezone);
  return formatDateToYYYYMMDD(userToday);
}

/**
 * Converts a UTC date to a specific timezone
 */
export function convertDateToTimezone(utcDate: Date, timezone: string): Date {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * Gets week parity (0 or 1) for biweekly scheduling
 * Uses epoch-based calculation to match SQL migration logic
 */
export function getWeekParityFromDate(date: Date): number {
  const epochDays = Math.floor(date.getTime() / 86400000); // Days since epoch
  return Math.floor(epochDays / 7) % 2;
}

/**
 * Gets day of week (1-7, where 1=Sunday) for the given date
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay() + 1; // Convert from 0-6 to 1-7 (Sunday=1)
}

/**
 * Gets day of month (1-31) for the given date
 */
export function getDayOfMonth(date: Date): number {
  return date.getDate();
}

/**
 * Gets week parity for a date in a specific timezone
 */
export function getWeekParityInTimezone(date: Date, timezone: string): number {
  const userDate = convertDateToTimezone(date, timezone);
  return getWeekParityFromDate(userDate);
}

/**
 * Gets day of week for a date in a specific timezone (1-7, where 1=Sunday)
 */
export function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const userDate = convertDateToTimezone(date, timezone);
  return getDayOfWeek(userDate);
}

/**
 * Gets day of month for a date in a specific timezone
 */
export function getDayOfMonthInTimezone(date: Date, timezone: string): number {
  const userDate = convertDateToTimezone(date, timezone);
  return getDayOfMonth(userDate);
}

/**
 * Formats a date to YYYY-MM-DD string in a specific timezone
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  const userDate = convertDateToTimezone(date, timezone);
  return formatDateToYYYYMMDD(userDate);
}

/**
 * Calculates user's current date and assignment-related values for a specific timezone
 * This is the main function used by assignment logic
 */
export interface UserDateCalculation {
  userToday: Date;
  userDayOfWeek: number;
  userWeekParity: number;
  userDayOfMonth: number;
}

export function calculateUserDateValues(timezone: string, date?: Date): UserDateCalculation {
  const targetDate = date || new Date();
  const userToday = convertDateToTimezone(targetDate, timezone);
  
  return {
    userToday,
    userDayOfWeek: getDayOfWeek(userToday),
    userWeekParity: getWeekParityFromDate(userToday),
    userDayOfMonth: getDayOfMonth(userToday),
  };
}