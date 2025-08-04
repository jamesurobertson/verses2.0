# Add Verse Feature - Project Resource Package (PRP)

name: "Add Verse Feature with Dexie Integration"
description: |

## Purpose
Comprehensive PRP optimized for AI agents to implement the Add Verse feature with dual-write architecture (Dexie + Supabase) following existing codebase patterns and achieving working code through iterative refinement.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Follow all rules in CLAUDE.md

---

## Goal
Transform the minimal AddVerse page into a fully functional verse addition interface that integrates with ESV API and implements dual-write architecture (Dexie local database + Supabase remote database), providing offline-first functionality with real-time validation and comprehensive error handling.

## Why
- **User Experience**: Users can add verses even when offline, with seamless sync when online
- **Data Consistency**: Dual-write ensures data availability across network conditions
- **Feature Completeness**: Completes the core memorization workflow (Add → Review → Track)
- **Architecture Foundation**: Establishes offline-first patterns for future features

## What
User-visible behavior: A form where users enter Bible references (e.g., "John 3:16", "Romans 8:28-30"), with real-time validation, automatic verse fetching from ESV API, duplicate detection, and immediate storage to both local and remote databases.

### Success Criteria
- [ ] User can enter any valid Bible reference format and see real-time validation
- [ ] System prevents duplicate verses in both local and remote databases
- [ ] New verses are fetched from ESV API and saved to both Dexie and Supabase
- [ ] Verse cards are created with proper user association (dual-write)
- [ ] Form works offline for validation, shows appropriate offline messaging
- [ ] Database operations complete within performance targets (100ms local, 500ms remote)
- [ ] Comprehensive error handling with user-friendly messages
- [ ] All tests pass and code follows existing patterns

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window

- url: https://dexie.org/docs/Tutorial/React
  why: Modern Dexie 4.x setup with React hooks, live queries, TypeScript patterns
  section: Database declaration, React integration, useLiveQuery
  
- url: https://dexie.org/docs/Typescript  
  why: EntityTable typing, UUID primary keys, modern schema definition
  critical: Use modern Dexie 4.x patterns, not legacy class extension
  
- url: https://www.sabatino.dev/using-uuid-primary-keys-in-dexie/
  why: UUID primary key implementation with $$ prefix syntax
  critical: Matches Supabase UUID schema requirements

- url: https://api.esv.org/docs/passage-text/
  why: API to get ESV verses, ensure it matches current code.
  critical: Successfully queries ESV API.
  
- file: projects/verses/src/services/esvApi.ts
  why: Existing API client pattern with caching, error handling, validation
  pattern: Singleton service, comprehensive error mapping, input sanitization
  
- file: projects/verses/src/services/supabase.ts
  why: Database operations pattern, typed client, helper functions
  pattern: db.verses.findOrCreate, db.verseCards.create, error handling
  
- file: projects/verses/src/utils/bibleRefParser.ts
  why: Reference validation logic, comprehensive format support
  pattern: ParsedReference interface, validation errors, sanitization
  
- file: projects/verses/src/utils/sanitization.ts
  why: Input validation using Zod schemas, XSS protection
  pattern: bibleReferenceSchema with transform and refine
  
- file: projects/verses/src/hooks/useVerses.ts
  why: Data management hook pattern, loading states, error handling
  pattern: useState for state, useEffect for data loading, clear error messages
  
- file: projects/verses/src/components/Button/Button.tsx
  why: Component pattern with TypeScript, variants, props interface
  pattern: Props interface, variants, className combination, testid support
  
- file: projects/verses/database/migrations/000_complete_reset.sql
  why: Exact database schema with UUIDs, constraints, triggers
  critical: Dexie schema must match this exactly for sync consistency
  
- file: projects/verses/src/types/verse.ts
  why: Type definitions for Verse, VerseCardData interfaces
  pattern: Consistent naming, proper typing, interface composition
```

### Current Codebase Tree
```bash
src/
├── components/          # Reusable UI components
│   ├── Button/         # Styled button component with variants
│   ├── MobileNavigation/
│   ├── VerseCard/      # Individual verse display
│   └── VerseStack/     # Stack of review cards
├── contexts/           # React context providers
│   └── AuthContext.tsx  # Global app state
├── hooks/             # Custom React hooks
│   ├── useAuth.ts     # Authentication logic
│   ├── useReview.ts   # Review session management
│   └── useVerses.ts   # Verse data operations
├── pages/             # Route components  
│   ├── AddVerse/      # MINIMAL PLACEHOLDER - needs full implementation
│   ├── Auth/          # Login/signup
│   ├── Library/       # View all saved verses
│   ├── Review/        # Active memorization session
│   └── Settings/      # User preferences
├── services/          # External API integrations
│   ├── esvApi.ts      # ESV Bible API client (COMPLETE)
│   └── supabase.ts    # Database client & types (COMPLETE)
├── types/             # TypeScript type definitions
│   └── verse.ts       # Core data models (COMPLETE)
├── utils/             # Helper functions
│   ├── bibleRefParser.ts    # Parse "John 3:16" format (COMPLETE)
│   ├── env.ts              # Environment validation
│   ├── sanitization.ts     # Input sanitization (COMPLETE)
│   ├── security.ts         # Security utilities
│   └── spacedRepetition.ts # SRS algorithm logic
└── router/            # Route configuration
    └── AppRouter.tsx   # Main routing setup
```

### Desired Codebase Tree (Files to Add)
```bash
src/
├── services/
│   ├── localDb.ts           # Dexie database configuration matching Supabase schema
│   └── dataService.ts       # Unified dual-write operations (local + remote)
├── pages/AddVerse/
│   ├── AddVerse.tsx         # REPLACE minimal placeholder with full form
│   ├── components/
│   │   ├── VerseReferenceInput.tsx  # Input with real-time validation
│   │   ├── LoadingSpinner.tsx       # Loading states during operations
│   │   └── SuccessMessage.tsx       # Success confirmation feedback
│   └── hooks/
│       └── useAddVerse.ts           # Add verse business logic and state
└── tests/
    ├── services/
    │   ├── localDb.test.ts          # Dexie operations and schema tests
    │   └── dataService.test.ts      # Dual-write logic and sync tests
    └── pages/AddVerse/
        ├── AddVerse.test.tsx        # Component integration tests
        └── useAddVerse.test.ts      # Hook business logic tests
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Dexie 4.x uses modern EntityTable typing, not class extension
import { Dexie, type EntityTable } from 'dexie';

// CRITICAL: UUID primary keys use $$ prefix in schema
db.version(1).stores({
  verses: '$$id, reference, translation, created_at',  // $$ = UUID primary key
  verse_cards: '$$id, user_id, verse_id, next_due_date'
});

// CRITICAL: Supabase schema has specific constraints
// - UNIQUE(reference, translation) on verses table
// - Database triggers auto-create review_logs on verse_card insert
// - UUIDs are strings, not auto-increment numbers

// CRITICAL: ESV API requires specific headers and has rate limits
// - Authorization: Token {key} 
// - 429 errors on >10 req/sec
// - Already implemented in esvApi.ts with proper caching

// CRITICAL: Existing test patterns mock minimally, trust external services
// - Mock Supabase operations but not ESV API behavior
// - Use renderHook for custom hooks
// - Follow existing test structure in tests/setup.ts

// CRITICAL: React patterns in this codebase
// - Use React 19 + TypeScript
// - Components use interface Props pattern
// - Hooks return object with loading, error, data pattern
// - Import { h } from 'preact' - NO, this is React not Preact (checked package.json)

// CRITICAL: Data flow pattern
// - Validate input with existing bibleRefParser and sanitization
// - Check local cache (Dexie) first for duplicates
// - Fallback to Supabase check if not found locally
// - Fetch from ESV API if verse doesn't exist
// - Dual-write: local first, then remote with error handling

// CRITICAL: Error handling pattern from existing code
// - User-friendly messages: "Please enter a valid Bible reference"
// - Specific error types: ValidationError, NetworkError, DuplicateError
// - Loading states during async operations
// - Clear success feedback with specific verse reference
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// Dexie Database Schema (MUST match Supabase exactly)
interface VersesDBSchema {
  verses: {
    id: string;           // UUID primary key
    reference: string;    // "John 3:16"
    text: string;         // ESV verse text
    translation: string;  // "ESV"
    created_at: string;   // ISO timestamp
    updated_at: string;   // ISO timestamp
  };
  
  verse_cards: {
    id: string;                    // UUID primary key
    user_id: string;               // Foreign key to auth.users
    verse_id: string;              // Foreign key to verses
    current_phase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    phase_progress_count: number;  // Default 0
    last_reviewed_at: string | null;
    next_due_date: string;         // Date string
    archived: boolean;             // Default false
    created_at: string;
    updated_at: string;
    current_streak: number;        // Default 0
    best_streak: number;           // Default 0
  };
}

// Form State and Validation
interface AddVerseFormState {
  reference: string;
  isValidating: boolean;
  validationError: string | null;
  isLoading: boolean;
  error: string | null;
  success: { reference: string; text: string } | null;
}

// Dual-Write Operation Result
interface DualWriteResult<T> {
  local: T | null;
  remote: T | null;
  errors: {
    local?: Error;
    remote?: Error;
  };
  success: boolean;
}
```

### Task List (In Implementation Order)

```yaml
Task 1 - Setup Dexie Database Service:
CREATE src/services/localDb.ts:
  - PATTERN: Modern Dexie 4.x with EntityTable typing
  - CRITICAL: Schema must exactly match Supabase migration schema
  - UUID primary keys using $$ prefix
  - Proper indexes for performance (reference, user_id, next_due_date)
  - Export singleton db instance

Task 2 - Create Unified Data Service:
CREATE src/services/dataService.ts:
  - PATTERN: Async functions returning standardized results
  - IMPLEMENT dual-write strategy: local first, then remote
  - ERROR HANDLING: Graceful degradation if remote fails
  - SYNC LOGIC: Retry mechanisms for failed remote writes
  - DUPLICATE DETECTION: Check both local and remote before creation

Task 3 - Implement Add Verse Hook:
CREATE src/pages/AddVerse/hooks/useAddVerse.ts:
  - PATTERN: Follow useVerses.ts structure
  - STATE: loading, error, success states
  - FUNCTIONS: addVerse, validateReference, clearState
  - INTEGRATION: Use dataService for dual-write operations
  - VALIDATION: Real-time validation with bibleRefParser

Task 4 - Create Form Components:
CREATE src/pages/AddVerse/components/:
  - VerseReferenceInput.tsx: Real-time validation, error display
  - LoadingSpinner.tsx: Visual feedback during operations
  - SuccessMessage.tsx: Success confirmation with verse details
  - PATTERN: Follow Button component structure for props/styling

Task 5 - Replace AddVerse Page:
MODIFY src/pages/AddVerse/AddVerse.tsx:
  - REPLACE minimal placeholder with full form implementation
  - INTEGRATE form components and useAddVerse hook
  - HANDLE all states: idle, validating, loading, success, error
  - RESPONSIVE design following existing patterns

Task 6 - Comprehensive Testing:
CREATE test files for all new components:
  - PATTERN: Follow existing test structure from Button.test.tsx
  - MOCK: Supabase and Dexie operations, not ESV API
  - COVERAGE: Happy path, validation errors, network failures, sync conflicts
  - INTEGRATION: End-to-end form submission flow
```

### Per Task Pseudocode

```typescript
// Task 1: Dexie Database Setup
import { Dexie, type EntityTable } from 'dexie';

const db = new Dexie('VersesDB') as Dexie & {
  verses: EntityTable<VersesDBSchema['verses'], 'id'>;
  verse_cards: EntityTable<VersesDBSchema['verse_cards'], 'id'>;
};

db.version(1).stores({
  verses: '$$id, reference, translation, created_at',
  verse_cards: '$$id, user_id, verse_id, next_due_date, current_phase'
});

// Task 2: Data Service Pattern
export const dataService = {
  async addVerse(reference: string, text: string, userId: string): Promise<DualWriteResult<any>> {
    try {
      // 1. Check duplicates in both stores
      const localExists = await db.verses.where('reference').equals(reference).first();
      if (localExists) return { duplicate: true, existing: localExists };
      
      // 2. Create verse locally first
      const localVerse = await db.verses.add({
        id: crypto.randomUUID(),
        reference, text, translation: 'ESV',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // 3. Create verse remotely (with retry on failure)
      const remoteVerse = await supabaseClient.from('verses').insert({...}).select().single();
      
      // 4. Create verse card (dual-write)
      // ... similar pattern
      
      return { local: localVerse, remote: remoteVerse, success: true };
    } catch (error) {
      // Detailed error handling with recovery strategies
    }
  }
};

// Task 3: Add Verse Hook Pattern
export function useAddVerse() {
  const [state, setState] = useState<AddVerseFormState>({
    reference: '',
    isValidating: false,
    validationError: null,
    isLoading: false,
    error: null,
    success: null
  });

  const validateReference = useCallback(async (ref: string) => {
    // Real-time validation using existing bibleRefParser
    // Update validationError state
  }, []);

  const addVerse = useCallback(async (reference: string) => {
    // 1. Final validation
    // 2. Check ESV API for verse text
    // 3. Use dataService.addVerse for dual-write
    // 4. Update state based on results
  }, []);

  return { ...state, validateReference, addVerse, clearState };
}

// Task 4: Component Patterns  
interface VerseReferenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation: (isValid: boolean, error?: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VerseReferenceInput: React.FC<VerseReferenceInputProps> = ({...}) => {
  // Real-time validation with debouncing
  // Visual feedback for validation states
  // Accessible form input with proper labels
};
```

### Integration Points
```yaml
DATABASE:
  - Dexie: Create VersesDB with schema matching Supabase
  - Supabase: Use existing db.verses and db.verseCards helpers
  - Sync: Implement conflict resolution for UUID collisions

AUTHENTICATION:
  - Integration: Use existing useAuth hook for user context
  - Security: Ensure user_id is properly associated with verse cards

API:
  - ESV: Use existing esvApi.getPassage with caching
  - Validation: Use existing bibleRefParser and sanitization
  - Error: Map API errors to user-friendly messages

ROUTING:
  - Navigation: Success should offer navigation to Library or Review
  - State: Clear form state on route changes
  - URL: Consider /add-verse?ref=John%203:16 for bookmarkable links
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                    # ESLint checks
npm run type-check             # TypeScript compilation
npm test -- --passWithNoTests  # Ensure test setup works

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests (Follow existing patterns)
```typescript
// CREATE src/services/localDb.test.ts
describe('LocalDB', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test('creates verse with UUID primary key', async () => {
    const verse = await db.verses.add({
      reference: 'John 3:16',
      text: 'For God so loved...',
      translation: 'ESV',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    expect(verse.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('prevents duplicate verses', async () => {
    // Test unique constraint on reference + translation
  });
});

// CREATE src/pages/AddVerse/AddVerse.test.tsx
describe('AddVerse Page', () => {
  test('validates reference in real-time', async () => {
    render(<AddVerse />);
    const input = screen.getByLabelText(/bible reference/i);
    
    await user.type(input, 'John 3:16');
    // Should show valid state
    
    await user.clear(input);
    await user.type(input, 'Invalid Reference');
    // Should show error state
  });

  test('handles successful verse creation', async () => {
    // Mock successful API and database operations
    // Test complete flow from input to success message
  });
});
```

```bash
# Run and iterate until passing:
npm test src/services/localDb.test.ts
npm test src/pages/AddVerse/AddVerse.test.tsx
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start the development server
npm run dev

# Test in browser DevTools console:
# 1. Check Dexie database exists
console.log(await db.verses.toArray());

# 2. Test form validation
# Navigate to /add-verse, enter "John 3:16", verify validation

# 3. Test offline functionality
# Disconnect network, try adding verse, verify local storage

# 4. Test dual-write
# Reconnect network, verify sync to Supabase
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run type-check`
- [ ] Dexie database creates successfully in browser DevTools
- [ ] Form validates Bible references in real-time
- [ ] Successful verse creation shows in both IndexedDB and Supabase
- [ ] Duplicate detection works for both local and remote
- [ ] Offline functionality gracefully degrades
- [ ] Error messages are user-friendly and actionable
- [ ] Loading states provide clear visual feedback
- [ ] Success state offers clear next actions

---

## Anti-Patterns to Avoid
- ❌ Don't create new validation patterns - use existing bibleRefParser
- ❌ Don't ignore the existing error handling patterns from esvApi.ts
- ❌ Don't mock external APIs in tests - mock database operations only  
- ❌ Don't use auto-increment IDs - must use UUIDs to match Supabase
- ❌ Don't skip dual-write validation - data consistency is critical
- ❌ Don't hardcode API keys or database URLs - use existing env utils
- ❌ Don't create synchronous functions where async is expected
- ❌ Don't ignore loading states - users need feedback during operations

## Performance & UX Considerations
- ✅ Real-time validation with debouncing (300ms)
- ✅ Local-first operations for perceived speed
- ✅ Progressive enhancement: core functionality works offline
- ✅ Optimistic UI updates with rollback on errors
- ✅ Clear visual hierarchy: validation → loading → success/error
- ✅ Keyboard accessibility and mobile-responsive design
- ✅ Retry mechanisms for network failures with exponential backoff