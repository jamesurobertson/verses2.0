# Add Verse Feature - Product Requirements Document

## Executive Summary

Transform the minimal AddVerse page into a fully functional verse addition interface that integrates with the ESV API and Supabase database. The feature will allow users to add new Bible verses to their memorization collection with proper validation, duplicate detection, and database integration.

## Current State Analysis

### Existing Infrastructure
- **AddVerse Page**: Minimal placeholder with title and description only
- **ESV API Client**: Fully implemented with caching, error handling, and validation
- **Bible Reference Parser**: Comprehensive parser supporting multiple formats and complex ranges
- **Input Sanitization**: XSS protection and validation utilities
- **Database Schema**: Complete schema with verses, verse_cards, and review_logs tables
- **Supabase Integration**: Working database client with typed operations
- **Component Library**: Button component and styling system
- **Dexie**: Installed but not configured (v4.0.11) - IndexedDB wrapper for offline capabilities

### Database Structure
```sql
-- Supabase Schema (from 000_complete_reset.sql)
verses (
  id uuid PRIMARY KEY,
  reference text NOT NULL,
  text text NOT NULL, 
  translation text DEFAULT 'ESV',
  created_at timestamp,
  updated_at timestamp,
  UNIQUE(reference, translation)
)

verse_cards (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  verse_id uuid REFERENCES verses(id),
  current_phase text DEFAULT 'daily' CHECK (IN 'daily','weekly','biweekly','monthly'),
  phase_progress_count integer DEFAULT 0,
  last_reviewed_at timestamp,
  next_due_date date NOT NULL,
  archived boolean DEFAULT false,
  created_at timestamp,
  updated_at timestamp,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0
)

review_logs (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  verse_card_id uuid REFERENCES verse_cards(id),
  was_successful boolean NOT NULL,
  counted_toward_progress boolean NOT NULL,
  review_time_seconds integer,
  created_at timestamp
)

user_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  email text,
  full_name text,
  preferred_translation text DEFAULT 'ESV',
  reference_display_mode text DEFAULT 'full' CHECK (IN 'full','first','blank'),
  created_at timestamp,
  updated_at timestamp,
  UNIQUE(user_id)
)
```

### Environment Configuration
- ESV API: `VITE_ESV_API_KEY` and `VITE_ESV_API_BASE_URL`
- Supabase: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- ESV API Documentation: https://api.esv.org/docs/passage-text/
- Dexie Documentation https://dexie.org/docs/Tutorial/React


## Feature Requirements

### Core User Flow
1. User enters a Bible reference (e.g., "John 3:16", "Romans 8:28-30")
2. System validates the reference format using existing parser
  2.a. if system cant validate, go ahead with esv api SKIP 3 and 4., it has good parsing. keep track of if it failed for step 5.
3. System checks if verse already exists in local cache (Dexie) then verses table (Supabase)
4. **If verse exists**: Create verse_card with existing verse_id (dual-write to Dexie + Supabase)
5. **If verse doesn't exist**: 
   - Fetch verse text from ESV API
   - if step 2 failed, now check if this verse already exists in verses table. It should not create a new entry if reference is the same. 
   - Save new verse to local cache (Dexie) and verses table (Supabase)
   - Create verse_card with new verse_id (dual-write to Dexie + Supabase)
6. Database triggers automatically create review_logs entry
7. User sees success confirmation

### Browser Testing Checkpoints

#### Checkpoint 1: Basic Form Input
**Objective**: Validate form creation and reference parsing
**Features**:
- Input field for Bible reference
- Real-time validation feedback
- Submit button
- Console.log output of parsed reference
- Error handling for invalid references

**Browser Test Criteria**:
- User types "John 3:16" → console shows parsed reference object
- Invalid references show appropriate error messages
- Form prevents submission of empty/invalid input
- Dexie database opens successfully (check browser DevTools → Application → IndexedDB)

#### Checkpoint 2: Database Integration & API Flow
**Objective**: Complete verse addition workflow
**Features**:
- Database query to check existing verses
- ESV API integration for new verses
- Verse and verse_card creation
- Loading states during operations
- Success/error feedback

**Browser Test Criteria**:
- Existing verse (e.g., "John 3:16") → Quick creation without API call (check local cache first)
- New verse → API call + dual-write to Dexie + Supabase
- Database triggers create review_logs entry automatically
- Proper error handling for API failures
- Data visible in both IndexedDB (DevTools) and Supabase dashboard
- Offline testing: disconnect network, verify local cache still works for existing verses

## Technical Implementation

### Phase 0: Dexie Setup (Prerequisite)
**Goal**: Configure local database foundation

**Components to Create**:
```
src/services/
├── localDb.ts (Dexie configuration and schema)
└── dataService.ts (unified data operations for Dexie + Supabase)
```

**Key Features**:
- Dexie database schema exactly matching Supabase migration (000_complete_reset.sql)
- Unified service layer for dual-write operations 
- Basic connection testing and error handling
- IndexedDB database creation and version management
- UUID support for primary keys (matching Supabase schema)
- Proper indexing for performance (reference, user_id, next_due_date)

### Phase 1: Basic Form Structure
**Goal**: Reach Checkpoint 1

**Components to Create**:
```
src/pages/AddVerse/
├── AddVerse.tsx (main form component)
├── components/
│   ├── VerseReferenceInput.tsx (input with validation)
│   └── SubmitButton.tsx (basic submit functionality)
```

**Key Features**:
- Replace placeholder AddVerse.tsx with functional form
- Real-time validation using existing `bibleRefParser`
- Input sanitization using existing `sanitizeBibleReference`
- Console.log parsed reference on submit
- Visual feedback for validation states

### Phase 2: Database & API Integration
**Goal**: Reach Checkpoint 2

**Additional Components**:
```
src/pages/AddVerse/
├── hooks/
│   └── useAddVerse.ts (database + API logic)
├── components/
│   ├── LoadingSpinner.tsx (loading states)
│   └── SuccessMessage.tsx (confirmation)
```

**Key Features**:
- Dual data layer: check local cache (Dexie) first, fallback to Supabase
- ESV API integration for verse fetching
- Dual-write operations for verse and verse_card creation
- Proper error handling and user feedback
- Loading states during async operations
- Offline capability testing and validation

### API Integration Details

**ESV API Usage**:
- Endpoint: `${VITE_ESV_API_BASE_URL}/passage/text/`
- Headers: `Authorization: Token ${VITE_ESV_API_KEY}`
- Parameters: Reference is forgiving with user input formats
- Response: Contains verse text, canonical reference, and metadata

**Database Operations**:
1. **Check Existing**: Query Dexie first → `localDb.verses.where('reference').equals(ref)`, fallback to Supabase
2. **Create Verse**: Dual-write → `localDb.verses.add()` + `supabase.from('verses').insert()`
3. **Create Card**: Dual-write → `localDb.verse_cards.add()` + `supabase.from('verse_cards').insert()`
4. **Auto Trigger**: Database automatically creates review_logs entry (Supabase only)
5. **Sync Strategy**: Always write to local first, then remote (with retry logic for failures)

## Testing Strategy

### Unit Tests
**Focus**: Form logic and validation (not API behavior)
- Input validation using bibleRefParser
- Form submission handling
- Error state management
- Reference sanitization

**Test Files**:
- `AddVerse.test.tsx`: Form component tests
- `useAddVerse.test.ts`: Hook logic tests (with mocked API/DB)
- `localDb.test.ts`: Dexie configuration and operations
- `dataService.test.ts`: Dual-write logic and sync strategies

### Integration Tests
**Focus**: Complete workflow without external dependencies
- Form submission to dual database creation (Dexie + Supabase mocked)
- Error handling across the flow (network failures, database conflicts)
- Loading state management during dual-write operations
- Success state confirmation with offline/online scenarios
- Cache-first data retrieval patterns

### Manual Browser Testing
**At Each Checkpoint**: 
- User experience validation
- Visual feedback verification
- Error handling confirmation
- Performance assessment
- IndexedDB inspection via browser DevTools
- Network disconnection testing for offline scenarios
- Data consistency verification between local and remote stores

**No API Behavior Testing**: ESV API is stable and reliable

## Success Criteria

### Functional Requirements
- [ ] User can enter any valid Bible reference format
- [ ] System prevents duplicate verses in both local and remote databases
- [ ] New verses are fetched from ESV API and saved to both Dexie and Supabase
- [ ] Verse cards are created with proper user association (dual-write)
- [ ] Review logs are automatically generated (Supabase triggers)
- [ ] Appropriate error handling for all failure modes (network, database, API)
- [ ] Local cache works when offline for existing verses

### Performance Requirements
- [ ] Form validation provides real-time feedback
- [ ] Local database queries (Dexie) complete within 100ms
- [ ] Remote database queries (Supabase) complete within 500ms
- [ ] ESV API calls complete within 2 seconds
- [ ] Dual-write operations complete within 1 second
- [ ] Loading states prevent user confusion during sync operations

### Security Requirements
- [ ] All user input is properly sanitized
- [ ] No XSS vulnerabilities in reference handling
- [ ] Database operations respect RLS policies
- [ ] API keys are properly secured in environment

### User Experience Requirements
- [ ] Clear visual feedback for all states
- [ ] Intuitive error messages
- [ ] Mobile-responsive design
- [ ] Accessible keyboard navigation

## Risk Mitigation

### Technical Risks
- **ESV API Failures**: Implement retry logic and offline fallback
- **Database Constraints**: Handle unique constraint violations gracefully in both Dexie and Supabase
- **Invalid References**: Comprehensive validation before API calls
- **Sync Conflicts**: Handle cases where local and remote data diverge
- **Storage Quotas**: Monitor IndexedDB storage limits and implement cleanup strategies

### User Experience Risks
- **Slow API Response**: Loading states and progress indicators
- **Unclear Errors**: User-friendly error messages with suggested fixes
- **Duplicate Attempts**: Clear feedback when verse already exists

## Future Enhancements

### Potential Features (Out of Scope)
- Bulk verse import from passage ranges
- Custom verse text editing
- Multiple translation support
- Verse tagging and categorization
- Import from other Bible apps

### Integration Opportunities
- Connect to existing Review session workflow
- Integration with Library page for verse management
- Analytics for popular verses and user patterns

## Dependencies

### Internal Dependencies
- Existing ESV API client (`src/services/esvApi.ts`)
- Bible reference parser (`src/utils/bibleRefParser.ts`)
- Input sanitization (`src/utils/sanitization.ts`)
- Supabase client (`src/services/supabase.ts`)
- useVerses hook (`src/hooks/useVerses.ts`)
- Button component (`src/components/Button/`)
- **New**: Dexie local database service (`src/services/localDb.ts`)
- **New**: Unified data service layer (`src/services/dataService.ts`)

### External Dependencies
- ESV API service (stable, well-documented)
- Supabase database (existing schema)
- User authentication context
- Dexie library (v4.0.11) - already installed
- Browser IndexedDB support (universally available)

### Environment Requirements
- Valid ESV API key
- Configured Supabase connection
- Database schema deployed with proper triggers
- Browser with IndexedDB support (all modern browsers)
- Sufficient client storage quota for local caching

---

**Document Version**: 1.1  
**Last Updated**: 2025-08-02  
**Changes in v1.1**: Added Dexie integration as Phase 0 prerequisite, updated all workflows for dual-write architecture, enhanced testing criteria for offline capabilities  
**Next Review**: After Phase 0 (Dexie setup) completion
