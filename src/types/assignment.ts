/**
 * Assignment-related types for the database migration integration
 * 
 * These types support the new assignment-based scheduling system
 * that replaces simple date comparison with timezone-aware logic.
 */

// Assignment calculation types
export interface AssignmentCalculation {
  userToday: Date;
  userDayOfWeek: number;        // 1-7 (Sunday=1)
  userWeekParity: number;       // 0 or 1 for biweekly scheduling
  userDayOfMonth: number;       // 1-31
}

// Assignment result from optimal assignment calculation
export interface OptimalAssignment {
  dayOfWeek: number | null;     // 1-7 (Sunday=1) for weekly/biweekly
  weekParity: number | null;    // 0 or 1 for biweekly
  dayOfMonth: number | null;    // 1-28 for monthly
}

// Assignment field updates for database operations
export interface AssignmentFields {
  assigned_day_of_week: number | null;
  assigned_week_parity: number | null;
  assigned_day_of_month: number | null;
}

// Phase progression phases
export type ReviewPhase = 'daily' | 'weekly' | 'biweekly' | 'monthly';

// Enhanced library verse card with assignment fields
export interface LibraryVerseCardWithAssignments {
  id: string;
  currentPhase: ReviewPhase;
  archived: boolean;
  assignedDayOfWeek: number | null;
  assignedWeekParity: number | null;
  assignedDayOfMonth: number | null;
  nextDueDate: string;
  currentStreak: number;
  bestStreak: number;
  lastReviewedAt: string | null;
  verse: {
    id: string;
    reference: string;
    text: string;
    translation: string;
  };
  source: 'local' | 'remote' | 'both';
}

// Timezone context types
export interface TimezoneInfo {
  timezone: string;
  userToday: Date;
  userNow: Date;
}

// Due card calculation result
export interface DueCardCalculation {
  card: LibraryVerseCardWithAssignments;
  isDue: boolean;
  reason: string;
  userCalculation: AssignmentCalculation;
}

// Assignment validation result
export interface AssignmentValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Phase transition information
export interface PhaseTransition {
  fromPhase: ReviewPhase;
  toPhase: ReviewPhase;
  requiresAssignment: boolean;
  optimalAssignment?: OptimalAssignment;
}

// User profile with timezone information  
export interface UserProfileWithTimezone {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  timezone: string;
  preferred_translation: string;
  reference_display_mode: string;
  created_at: string;
  updated_at: string;
}

