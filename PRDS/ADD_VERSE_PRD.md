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

### Database Structure
```sql
verses (id, reference, text, translation, created_at, updated_at)
verse_cards (id, user_id, verse_id, current_phase, next_due_date, etc.)
review_logs (id, user_id, verse_card_id, was_successful, etc.)
```

### Environment Configuration
- ESV API: `VITE_ESV_API_KEY` and `VITE_ESV_API_BASE_URL`
- Supabase: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- ESV API Documentation: https://api.esv.org/docs/passage-text/

## Feature Requirements

### Core User Flow
1. User enters a Bible reference (e.g., "John 3:16", "Romans 8:28-30")
2. System validates the reference format using existing parser
  2.a. if system cant validate, go ahead with esv api SKIP 3 and 4., it has good parsing. keep track of if it failed for step 5.
3. System checks if verse already exists in verses table
4. **If verse exists**: Create verse_card with existing verse_id
5. **If verse doesn't exist**: 
   - Fetch verse text from ESV API
   - if step 2 failed, now check if this verse already exists in verses table. It should not create a new entry if reference is the same. 
   - Save new verse to verses table
   - Create verse_card with new verse_id
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

#### Checkpoint 2: Database Integration & API Flow
**Objective**: Complete verse addition workflow
**Features**:
- Database query to check existing verses
- ESV API integration for new verses
- Verse and verse_card creation
- Loading states during operations
- Success/error feedback

**Browser Test Criteria**:
- Existing verse (e.g., "John 3:16") → Quick creation without API call
- New verse → API call + verse creation + card creation
- Database triggers create review_logs entry automatically
- Proper error handling for API failures

## Technical Implementation

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
- Query verses table by reference using Supabase client
- ESV API integration for verse fetching
- Database operations for verse and verse_card creation
- Proper error handling and user feedback
- Loading states during async operations

### API Integration Details

**ESV API Usage**:
- Endpoint: `${VITE_ESV_API_BASE_URL}/passage/text/`
- Headers: `Authorization: Token ${VITE_ESV_API_KEY}`
- Parameters: Reference is forgiving with user input formats
- Response: Contains verse text, canonical reference, and metadata

**Database Operations**:
1. **Check Existing**: `SELECT * FROM verses WHERE reference = ? AND translation = ?`
2. **Create Verse**: `INSERT INTO verses (reference, text, translation)`
3. **Create Card**: `INSERT INTO verse_cards (user_id, verse_id, next_due_date)`
4. **Auto Trigger**: Database automatically creates review_logs entry

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

### Integration Tests
**Focus**: Complete workflow without external dependencies
- Form submission to database creation
- Error handling across the flow
- Loading state management
- Success state confirmation

### Manual Browser Testing
**At Each Checkpoint**: 
- User experience validation
- Visual feedback verification
- Error handling confirmation
- Performance assessment

**No API Behavior Testing**: ESV API is stable and reliable

## Success Criteria

### Functional Requirements
- [ ] User can enter any valid Bible reference format
- [ ] System prevents duplicate verses in database
- [ ] New verses are fetched from ESV API and saved
- [ ] Verse cards are created with proper user association
- [ ] Review logs are automatically generated
- [ ] Appropriate error handling for all failure modes

### Performance Requirements
- [ ] Form validation provides real-time feedback
- [ ] Database queries complete within 500ms
- [ ] ESV API calls complete within 2 seconds
- [ ] Loading states prevent user confusion

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
- **Database Constraints**: Handle unique constraint violations gracefully
- **Invalid References**: Comprehensive validation before API calls

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

### External Dependencies
- ESV API service (stable, well-documented)
- Supabase database (existing schema)
- User authentication context

### Environment Requirements
- Valid ESV API key
- Configured Supabase connection
- Database schema deployed with proper triggers

---

**Document Version**: 1.0  
**Last Updated**: 2025-08-02  
**Next Review**: After Checkpoint 1 completion
