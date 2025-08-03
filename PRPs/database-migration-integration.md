# Database Migration Integration PRP

## Goal
Integrate the new database migration changes that introduce timezone awareness, assignment-based scheduling, and enhanced syncing capabilities into the frontend React application. The implementation must resolve critical schema mismatches, replace simple date logic with assignment-aware scheduling, and maintain the offline-first dual-write architecture.

## Why
- **Critical Compatibility**: Current frontend will break with new backend due to schema mismatches and type conflicts
- **Enhanced User Experience**: Users get timezone-aware scheduling that respects their local time
- **Robust Architecture**: Assignment-based scheduling prevents race conditions and provides better distribution
- **Data Integrity**: Proper syncing ensures local and remote data stay consistent with new fields

## What
Transform the frontend application to work seamlessly with the new migration schema while maintaining offline-first functionality and type safety.

### Success Criteria
- [ ] Local database schema matches remote schema (timezone, assignment fields, aliases)
- [ ] Due card detection uses assignment-aware logic instead of simple date comparison
- [ ] Timezone is captured during signup and used throughout the app
- [ ] Race condition protection prevents duplicate daily reviews
- [ ] All existing tests pass and new tests validate assignment logic
- [ ] Type safety is maintained throughout the migration

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://dexie.org/docs/Version/Version.upgrade()
  why: Database schema migration patterns and upgrade functions
  critical: Always increment version number and handle data transformation

- url: https://dexie.org/docs/Typescript 
  why: TypeScript integration patterns for schema changes
  critical: Use EntityTable types for type safety

- file: /projects/verses/src/services/localDb.ts
  why: Current schema version 8, missing timezone and assignment fields
  critical: ID auto-increment pattern, hook system for timestamps

- file: /projects/verses/src/services/supabase.ts  
  why: Target types, but missing timezone and assignment fields
  critical: UUID vs number ID mismatch, Database interface pattern

- file: /projects/verses/database/migrations/000_complete_reset.sql
  why: Exact target schema with all assignment fields and timezone logic
  critical: Assignment fields, timezone handling, race condition protection

- file: /projects/verses/src/pages/Library/hooks/useLibrary.ts
  why: Current due card logic that needs complete replacement  
  critical: Lines 130-133 contain the simple date logic to replace

- file: /projects/verses/src/pages/Review/hooks/useReview.ts
  why: Review session management that needs timezone awareness
  critical: loadDueCards function needs assignment-aware logic

- file: /projects/verses/src/utils/spacedRepetition.ts
  why: Current phase progression logic to preserve
  critical: PHASE_REQUIREMENTS and calculateNextDueDate functions

- file: /projects/verses/src/utils/dateUtils.ts
  why: Current date handling without timezone awareness
  critical: getTodayString() and formatDateToYYYYMMDD() need timezone context
```

### Current Codebase Structure
```bash
src/
├── services/
│   ├── localDb.ts          # CRITICAL: Version 8, auto-increment IDs, missing fields
│   ├── supabase.ts         # CRITICAL: Missing timezone/assignment types  
│   └── dataService.ts      # CRITICAL: Dual-write logic, needs field mapping
├── pages/
│   ├── Library/hooks/useLibrary.ts    # CRITICAL: Simple due logic (lines 130-133)
│   ├── Review/hooks/useReview.ts      # CRITICAL: loadDueCards function
│   └── Auth/Auth.tsx                  # CRITICAL: Signup needs timezone capture
├── utils/
│   ├── dateUtils.ts        # CRITICAL: No timezone awareness
│   ├── spacedRepetition.ts # PRESERVE: Core SRS logic
│   └── referenceNormalizer.ts
└── types/
    └── verse.ts            # UPDATE: Need assignment field types
```

### Desired Codebase Structure (additions)
```bash
src/
├── contexts/
│   └── TimezoneContext.tsx           # NEW: Timezone awareness throughout app
├── utils/
│   ├── dateUtils.ts                  # ENHANCED: Timezone-aware functions
│   └── assignmentLogic.ts            # NEW: Assignment-based due card detection
└── types/
    └── assignment.ts                 # NEW: Assignment field types
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Dexie version increments are required for schema changes
// From research: Always increment version, use upgrade() for data transformation
db.version(9).stores({  // MUST increment from 8 to 9
  user_profiles: '++id, user_id, timezone, [user_id]'  // NEW table
});

// CRITICAL: ID type mismatch between local (number) and remote (UUID)
// Current: Local uses ++id (auto-increment), Remote uses UUID
// Decision needed: Convert local to UUID or implement ID mapping

// CRITICAL: Assignment logic from SQL migration
// Weekly: assigned_day_of_week (1-7, where 1=Sunday)
// Biweekly: assigned_day_of_week + assigned_week_parity (0,1) 
// Monthly: assigned_day_of_month (1-28 only)

// CRITICAL: Timezone handling
// Use Intl.DateTimeFormat().resolvedOptions().timeZone for detection
// Store in user_profiles.timezone, use throughout app for date calculations

// CRITICAL: Race condition protection
// SQL has unique constraint: ONE review per card per UTC day
// Frontend must check before allowing duplicate reviews
```

## Implementation Blueprint

### Data Models and Structure

First, update the core data models to ensure type safety and consistency:

```typescript
// Enhanced LocalDBSchema with assignment fields
export interface LocalDBSchema {
  user_profiles: {  // NEW TABLE
    id?: number;
    user_id: string;
    email: string | null;
    full_name: string | null;
    timezone: string;
    preferred_translation: string;
    reference_display_mode: string;
    created_at: string;
    updated_at: string;
  };
  
  verses: {
    // ... existing fields
    aliases: string[];  // ADD: Array of normalized references
  };
  
  verse_cards: {
    // ... existing fields
    assigned_day_of_week: number | null;    // ADD: 1-7 (Sunday=1)
    assigned_week_parity: number | null;    // ADD: 0 or 1 for biweekly
    assigned_day_of_month: number | null;   // ADD: 1-28 for monthly
  };
}

// Assignment calculation types
export interface AssignmentCalculation {
  userToday: Date;
  userDayOfWeek: number;
  userWeekParity: number;
  userDayOfMonth: number;
}

// Assignment result from database logic
export interface OptimalAssignment {
  dayOfWeek: number | null;
  weekParity: number | null;
  dayOfMonth: number | null;
}
```

### List of Tasks to Complete (In Order)

```yaml
Task 1: Update Local Database Schema
MODIFY src/services/localDb.ts:
  - INCREMENT version from 8 to 9
  - ADD user_profiles table with timezone field
  - ADD assignment fields to verse_cards table  
  - ADD aliases field to verses table
  - CREATE upgrade function to populate new fields with defaults

Task 2: Update TypeScript Types
MODIFY src/services/supabase.ts:
  - ADD timezone field to user_profiles Row/Insert/Update interfaces
  - ADD assignment fields to verse_cards interfaces
  - ADD aliases field to verses interfaces
  - ENSURE type consistency with localDb.ts

Task 3: Create Timezone Context
CREATE src/contexts/TimezoneContext.tsx:
  - PROVIDE timezone state throughout app
  - CALCULATE user's current date in their timezone
  - SUPPLY timezone-aware date helper functions

Task 4: Update Date Utilities
MODIFY src/utils/dateUtils.ts:
  - ADD timezone-aware versions of existing functions
  - CREATE getUserTodayInTimezone(timezone: string)
  - CREATE getWeekParityFromDate(date: Date) helper

Task 5: Create Assignment Logic Module
CREATE src/utils/assignmentLogic.ts:
  - IMPLEMENT isDueBasedOnAssignment function
  - MIRROR SQL logic from due_cards_view 
  - HANDLE all four phases: daily, weekly, biweekly, monthly

Task 6: Replace Due Card Logic in useLibrary
MODIFY src/pages/Library/hooks/useLibrary.ts:
  - FIND lines 130-133 (current simple date logic)
  - REPLACE with assignment-aware logic using new utility
  - ADD timezone context integration

Task 7: Replace Due Card Logic in useReview  
MODIFY src/pages/Review/hooks/useReview.ts:
  - UPDATE loadDueCards function to use assignment logic
  - ADD timezone awareness to all date operations
  - PRESERVE existing session management logic

Task 8: Update Signup Flow for Timezone Capture
MODIFY src/pages/Auth/Auth.tsx:
  - DETECT user timezone using Intl API
  - INCLUDE timezone in signup metadata
  - CREATE user_profile record with timezone

Task 9: Add Race Condition Protection
MODIFY src/services/dataService.ts:
  - CHECK for existing reviews today before recording new ones
  - USE UTC dates for consistency with backend constraint
  - THROW descriptive errors for duplicate attempts

Task 10: Update Data Service for New Fields
MODIFY src/services/dataService.ts:
  - ADD assignment field handling in sync operations
  - UPDATE addVerse to handle aliases array
  - ENHANCE getUserVerses to include assignment data

Task 11: Resolve ID Type Mismatch
DECIDE between Option A (UUID local) or Option B (ID mapping):
  Option A: CONVERT local database to use UUIDs
  Option B: CREATE id_mappings table for local↔remote mapping
```

### Per-Task Pseudocode

```typescript
// Task 1: Database Schema Update
db.version(9).stores({
  // PATTERN: Add new tables and fields, preserve existing data
  user_profiles: '++id, user_id, timezone, [user_id]',
  verse_cards: '++id, user_id, verse_id, next_due_date, current_phase, archived, assigned_day_of_week, assigned_week_parity, assigned_day_of_month, [user_id+verse_id]',
  verses: '++id, reference, translation, *aliases, [reference+translation]'
}).upgrade(trans => {
  // CRITICAL: Populate new fields with sensible defaults
  return trans.verse_cards.toCollection().modify(card => {
    // Set assignment fields to null for existing cards
    card.assigned_day_of_week = null;
    card.assigned_week_parity = null; 
    card.assigned_day_of_month = null;
  });
});

// Task 5: Assignment Logic (Mirror SQL due_cards_view)
function isDueBasedOnAssignment(
  card: LibraryVerseCard,
  userCalculation: AssignmentCalculation
): boolean {
  if (card.archived) return false;
  
  switch (card.currentPhase) {
    case 'daily':
      return true; // Daily cards always due
    case 'weekly':
      return card.assignedDayOfWeek === userCalculation.userDayOfWeek;
    case 'biweekly':
      return card.assignedDayOfWeek === userCalculation.userDayOfWeek &&
             card.assignedWeekParity === userCalculation.userWeekParity;
    case 'monthly':
      return card.assignedDayOfMonth === userCalculation.userDayOfMonth &&
             userCalculation.userDayOfMonth <= 28;
    default:
      return false;
  }
}

// Task 8: Timezone Capture Pattern
async function handleSignup(email: string, password: string, name: string) {
  // PATTERN: Always capture timezone during signup
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        timezone: userTimezone  // CRITICAL: Include in metadata
      }
    }
  });
}

// Task 9: Race Condition Protection Pattern
async function recordReview(verseCardId: number, userId: string, wasSuccessful: boolean) {
  // CRITICAL: Check for existing review today (UTC-based)
  const todayUTC = new Date().toISOString().split('T')[0];
  const existingReview = await localDb.reviewLogs
    .where(['verse_card_id', 'user_id'])
    .equals([verseCardId, userId])
    .filter(log => log.created_at.split('T')[0] === todayUTC)
    .first();

  if (existingReview) {
    throw new Error('Card already reviewed today');
  }
  
  // Proceed with review recording...
}
```

### Integration Points
```yaml
DATABASE:
  - migration: "Increment localDb version to 9"
  - upgrade: "Populate assignment fields with null defaults"
  - constraint: "Handle race condition checking locally"

CONTEXTS:
  - add: "TimezoneContext for app-wide timezone awareness"
  - pattern: "Use React Context + useContext hook"

AUTH:
  - modify: "Signup flow to capture and store user timezone"
  - trigger: "Backend auto-creates user_profiles with timezone"

UTILS:
  - enhance: "dateUtils.ts with timezone-aware functions"
  - create: "assignmentLogic.ts with due card detection"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding  
npm run lint              # ESLint check
npm run type-check        # TypeScript validation

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests for Each New Feature
```typescript
// CREATE tests/utils/assignmentLogic.test.ts
describe('isDueBasedOnAssignment', () => {
  test('daily cards are always due', () => {
    const card = { currentPhase: 'daily', archived: false } as LibraryVerseCard;
    const userCalc = {} as AssignmentCalculation; // Irrelevant for daily
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(true);
  });

  test('weekly cards due on assigned weekday', () => {
    const card = { 
      currentPhase: 'weekly', 
      assignedDayOfWeek: 1, // Sunday
      archived: false 
    } as LibraryVerseCard;
    const userCalc = { userDayOfWeek: 1 } as AssignmentCalculation;
    expect(isDueBasedOnAssignment(card, userCalc)).toBe(true);
  });

  test('archived cards never due', () => {
    const card = { currentPhase: 'daily', archived: true } as LibraryVerseCard;
    expect(isDueBasedOnAssignment(card, {} as AssignmentCalculation)).toBe(false);
  });
});

// CREATE tests/services/dataService.test.ts  
describe('race condition protection', () => {
  test('prevents duplicate reviews same day', async () => {
    // Setup: Create review log for today
    await localDb.reviewLogs.create({
      user_id: 'test-user',
      verse_card_id: 1,
      was_successful: true,
      counted_toward_progress: true,
      created_at: new Date().toISOString()
    });

    // Test: Attempt second review should fail
    await expect(
      dataService.recordReview(1, 'test-user', true)
    ).rejects.toThrow('Card already reviewed today');
  });
});
```

```bash
# Run and iterate until passing:
npm test -- assignmentLogic.test.ts
npm test -- dataService.test.ts
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start development server
npm run dev

# Test assignment logic integration
# 1. Add a verse (should get null assignments for daily phase)
# 2. Review it multiple times (should prevent duplicates) 
# 3. Advance through phases (should get proper assignments)
# 4. Check due cards on assigned days only

# Expected: Assignment-based scheduling works correctly
# If error: Check browser console and network tab for details
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run type-check`
- [ ] Database version incremented to 9 successfully
- [ ] Timezone captured during signup and used in calculations
- [ ] Due cards appear only on assigned days (not simple date comparison)
- [ ] Race condition protection prevents duplicate daily reviews
- [ ] Assignment fields properly synced to/from remote database
- [ ] Existing spaced repetition logic preserved and enhanced

---

## Anti-Patterns to Avoid
- ❌ Don't skip database version increment - will cause schema conflicts
- ❌ Don't ignore timezone in date calculations - will break assignment logic  
- ❌ Don't allow duplicate reviews - violates backend constraint
- ❌ Don't hardcode assignment values - use optimal distribution functions
- ❌ Don't break existing spaced repetition progression logic
- ❌ Don't forget to handle null assignment values for existing cards

---

**Confidence Score: 8/10** - High confidence for one-pass implementation due to comprehensive context, specific patterns from codebase, detailed SQL schema reference, and executable validation gates. The main complexity is in the assignment logic implementation, but the SQL migration provides exact patterns to follow.