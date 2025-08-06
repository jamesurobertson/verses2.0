# Verse Details Page - Project Resource Package (PRP)

name: "Individual Verse Details Page Implementation"
description: |

## Purpose
Comprehensive PRP to create a dedicated verse details page accessible from the Library, providing complete verse information and management capabilities including delete functionality.

## Core Principles
1. **User-Centric Design**: Clear, comprehensive verse information display
2. **Navigation Integration**: Seamless routing from Library page
3. **Data Safety**: Soft delete (archive) approach for verse removal
4. **Design Consistency**: Follow existing app patterns and styling
5. **Responsive Design**: Work across all device sizes

---

## Goal
Create a comprehensive verse details page that displays all relevant verse information and provides verse management capabilities, accessible by clicking verses in the Library page.

## Why
- **User Control**: Users need detailed view and management of their verses
- **Information Architecture**: Detailed information shouldn't clutter the Library list view
- **Delete Functionality**: Users need ability to remove verses from their collection
- **Navigation Flow**: Natural progression from list view to detail view

## What
New route and page component showing detailed verse information with delete functionality, integrated into the existing routing system and accessible from Library page clicks.

### Success Criteria
- [ ] New route `/verse/:verseCardId` accessible and functional
- [ ] Clicking verse in Library navigates to details page
- [ ] All specified verse information displayed correctly
- [ ] Delete button archives verse (soft delete)
- [ ] Page follows existing design patterns and responsiveness
- [ ] Navigation back to Library works correctly
- [ ] Error handling for missing verses

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Existing patterns to follow and integrate with

- file: /projects/verses/src/pages/Library/Library.tsx
  why: Current Library page structure, verse display patterns, click handling
  pattern: Verse list rendering, data fetching, component structure
  critical: Need to add click navigation to verse details

- file: /projects/verses/src/router/AppRouter.tsx
  why: Current routing structure, route definition patterns
  pattern: Route configuration, parameter handling, component mapping
  critical: Add new route for verse details page

- file: /projects/verses/src/services/dataService.ts
  why: Existing data operations, archive functionality
  pattern: archiveVerse method, dual-write operations, error handling
  critical: Use existing archiveVerse method for delete functionality

- file: /projects/verses/src/services/localDb.ts
  why: Database schema, verse and verse card relationships
  pattern: Compound queries, data relationships, type definitions
  critical: Understanding verse_cards and verses relationship for data display

- file: /projects/verses/src/pages/Settings/Settings.tsx
  why: Existing page structure, responsive design patterns
  pattern: Page layout, header structure, section organization
  critical: Follow established page layout and styling patterns

- file: /projects/verses/src/components/Button/Button.tsx
  why: Button component variants for delete action
  pattern: Button variants, loading states, styling classes
  critical: Use appropriate button variant for delete action
```

### Database Schema Context
```typescript
// VERSE DETAILS DATA STRUCTURE
interface VerseDetailsData {
  // From verses table
  verse: {
    id: string;
    reference: string;        // "John 3:16"
    text: string;            // ESV verse text
    translation: string;     // "ESV"
    is_verified: boolean;    // ESV verification status
  };
  
  // From verse_cards table
  verseCard: {
    id: string;
    current_phase: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    assigned_day_of_week: number | null;      // 1-7 (Sunday=1)
    assigned_week_parity: number | null;      // 0 or 1 for biweekly
    assigned_day_of_month: number | null;     // 1-28 for monthly
    current_streak: number;                   // Current successful streak
    best_streak: number;                      // All-time best streak
    phase_progress_count: number;             // Progress in current phase
    last_reviewed_at: string | null;          // ISO timestamp
    next_due_date: string;                    // YYYY-MM-DD format
    created_at: string;                       // When card was created
    archived: boolean;                        // Soft delete status
  };
}

// FIELDS TO DISPLAY (from PRD)
// ✅ SHOW: verse reference and text
// ✅ SHOW: current phase (daily/weekly/biweekly/monthly)  
// ✅ SHOW: assigned day of week/month
// ✅ SHOW: week parity (for biweekly verses)
// ✅ SHOW: current streak
// ✅ SHOW: best streak
// ✅ SHOW: current phase progress count
// ❌ HIDE: archived status (internal use only)
```

### Current Routing Structure
```typescript
// EXISTING ROUTES (from AppRouter.tsx)
const routes = [
  { path: '/', element: <Library /> },
  { path: '/add', element: <AddVerse /> },
  { path: '/review', element: <Review /> },
  { path: '/settings', element: <Settings /> },
  // ADD: { path: '/verse/:verseCardId', element: <VerseDetails /> }
];
```

### Known Gotchas & Implementation Details
```typescript
// CRITICAL: Route parameter extraction
// Use useParams to get verseCardId from URL
const { verseCardId } = useParams<{ verseCardId: string }>();

// CRITICAL: Data fetching pattern
// Use compound query to get both verse and verse_card data
const verseCard = await db.verse_cards.get(verseCardId);
const verse = await db.verses.get(verseCard.verse_id);

// CRITICAL: Delete functionality
// Use existing archiveVerse method from dataService
await dataService.archiveVerse(verseCardId, userId);

// CRITICAL: Navigation integration  
// Update Library.tsx to handle verse clicks
<div onClick={() => navigate(`/verse/${verseCard.id}`)} />

// CRITICAL: Error handling
// Handle cases where verse/card not found
if (!verseCard || !verse) {
  return <div>Verse not found</div>;
}

// CRITICAL: Phase scheduling display logic
const getScheduleDescription = (verseCard) => {
  switch (verseCard.current_phase) {
    case 'daily': return 'Every day';
    case 'weekly': return `Every ${getDayName(verseCard.assigned_day_of_week)}`;
    case 'biweekly': return `Every other ${getDayName(verseCard.assigned_day_of_week)} (${verseCard.assigned_week_parity === 0 ? 'even' : 'odd'} weeks)`;
    case 'monthly': return `${getOrdinal(verseCard.assigned_day_of_month)} of every month`;
  }
};
```

## Implementation Blueprint

### Component Structure

```typescript
// New page component structure
src/pages/VerseDetails/
├── VerseDetails.tsx              # Main page component
├── VerseDetails.test.tsx         # Component tests
├── components/
│   ├── VerseInfoSection.tsx      # Verse reference and text display
│   ├── ScheduleInfoSection.tsx   # Phase and scheduling information  
│   ├── StatsSection.tsx          # Streaks and progress stats
│   └── DeleteVerseButton.tsx     # Delete confirmation and action
└── hooks/
    └── useVerseDetails.ts        # Data fetching and state management
```

### Task List (Implementation Order)

```yaml
Task 1 - Create Route and Basic Page Structure:
CREATE src/pages/VerseDetails/VerseDetails.tsx:
  - IMPLEMENT basic page layout following existing patterns
  - ADD route parameter handling with useParams
  - CREATE loading and error states
  - IMPLEMENT navigation back to Library

Task 2 - Add Route Configuration:
MODIFY src/router/AppRouter.tsx:
  - ADD new route '/verse/:verseCardId'
  - IMPORT and configure VerseDetails component
  - ENSURE route parameter passing works correctly

Task 3 - Create Data Fetching Hook:
CREATE src/pages/VerseDetails/hooks/useVerseDetails.ts:
  - IMPLEMENT data fetching for verse and verse card
  - ADD loading and error state management
  - HANDLE cases where verse/card not found
  - INTEGRATE with existing database patterns

Task 4 - Build Information Display Components:
CREATE display components:
  - VerseInfoSection.tsx: Reference and text display
  - ScheduleInfoSection.tsx: Phase and scheduling details
  - StatsSection.tsx: Streaks and progress information
  - FOLLOW existing component patterns and styling

Task 5 - Implement Delete Functionality:
CREATE src/pages/VerseDetails/components/DeleteVerseButton.tsx:
  - IMPLEMENT confirmation dialog for delete action
  - USE existing dataService.archiveVerse method
  - ADD loading states and error handling
  - NAVIGATE back to Library after successful delete

Task 6 - Integrate Library Page Navigation:
MODIFY src/pages/Library/Library.tsx:
  - ADD click handlers to verse cards/items
  - IMPLEMENT navigation to verse details page
  - UPDATE cursor styling to indicate clickable items

Task 7 - Add Responsive Design and Polish:
ENHANCE VerseDetails components:
  - IMPLEMENT responsive design patterns
  - ADD proper loading states and transitions
  - ENSURE accessibility with proper ARIA attributes
  - TEST navigation and back functionality

Task 8 - Create Comprehensive Tests:
CREATE tests for verse details functionality:
  - UNIT: Component rendering and data display
  - INTEGRATION: Navigation from Library to details
  - USER ACTIONS: Delete functionality and confirmation
  - ERROR HANDLING: Missing verses and network failures
```

### Detailed Implementation

```typescript
// Task 1: Main VerseDetails Component
// CREATE src/pages/VerseDetails/VerseDetails.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVerseDetails } from './hooks/useVerseDetails';
import { VerseInfoSection } from './components/VerseInfoSection';
import { ScheduleInfoSection } from './components/ScheduleInfoSection';
import { StatsSection } from './components/StatsSection';
import { DeleteVerseButton } from './components/DeleteVerseButton';

export function VerseDetails() {
  const { verseCardId } = useParams<{ verseCardId: string }>();
  const navigate = useNavigate();
  const { verseData, loading, error, deleteVerse } = useVerseDetails(verseCardId!);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading verse details...</p>
        </div>
      </div>
    );
  }

  if (error || !verseData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Verse Not Found</h1>
          <p className="text-gray-600 mb-6">
            The verse you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back to Library"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-primary">Verse Details</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <VerseInfoSection verse={verseData.verse} />
        <ScheduleInfoSection verseCard={verseData.verseCard} />
        <StatsSection verseCard={verseData.verseCard} />
        
        {/* Delete Section */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">Remove Verse</h3>
          <p className="text-red-700 mb-4 text-sm">
            This will remove the verse from your collection. This action cannot be undone.
          </p>
          <DeleteVerseButton
            verseCardId={verseCardId!}
            verseReference={verseData.verse.reference}
            onDelete={deleteVerse}
          />
        </div>
      </div>
    </div>
  );
}

// Task 3: Data Fetching Hook
// CREATE src/pages/VerseDetails/hooks/useVerseDetails.ts
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { dataService } from '../../../services/dataService';
import { db } from '../../../services/localDb';

interface VerseDetailsData {
  verse: {
    id: string;
    reference: string;
    text: string;
    translation: string;
    is_verified: boolean;
  };
  verseCard: {
    id: string;
    current_phase: string;
    assigned_day_of_week: number | null;
    assigned_week_parity: number | null;
    assigned_day_of_month: number | null;
    current_streak: number;
    best_streak: number;
    phase_progress_count: number;
    last_reviewed_at: string | null;
    next_due_date: string;
    created_at: string;
    archived: boolean;
  };
}

export function useVerseDetails(verseCardId: string) {
  const [verseData, setVerseData] = useState<VerseDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCurrentUserId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadVerseDetails();
  }, [verseCardId]);

  const loadVerseDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const verseCard = await db.verse_cards.get(verseCardId);
      if (!verseCard || verseCard.archived) {
        setError('Verse not found');
        return;
      }

      const verse = await db.verses.get(verseCard.verse_id);
      if (!verse) {
        setError('Verse data not found');
        return;
      }

      setVerseData({
        verse: {
          id: verse.id!,
          reference: verse.reference,
          text: verse.text,
          translation: verse.translation,
          is_verified: verse.is_verified
        },
        verseCard: {
          id: verseCard.id!,
          current_phase: verseCard.current_phase,
          assigned_day_of_week: verseCard.assigned_day_of_week,
          assigned_week_parity: verseCard.assigned_week_parity,
          assigned_day_of_month: verseCard.assigned_day_of_month,
          current_streak: verseCard.current_streak,
          best_streak: verseCard.best_streak,
          phase_progress_count: verseCard.phase_progress_count,
          last_reviewed_at: verseCard.last_reviewed_at,
          next_due_date: verseCard.next_due_date,
          created_at: verseCard.created_at,
          archived: verseCard.archived
        }
      });
    } catch (err) {
      setError('Failed to load verse details');
      console.error('Error loading verse details:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteVerse = async () => {
    try {
      const userId = await getCurrentUserId();
      await dataService.archiveVerse(verseCardId, userId);
      navigate('/'); // Navigate back to Library
    } catch (err) {
      console.error('Failed to delete verse:', err);
      throw err;
    }
  };

  return {
    verseData,
    loading,
    error,
    deleteVerse
  };
}

// Task 6: Library Integration  
// MODIFY src/pages/Library/Library.tsx to add navigation
// Add to verse card rendering:
<div 
  className="cursor-pointer hover:bg-gray-50 transition-colors"
  onClick={() => navigate(`/verse/${verseCard.id}`)}
>
  {/* existing verse card content */}
</div>
```

### Integration Points
```yaml
ROUTING:
  - add: "New route /verse/:verseCardId in AppRouter"
  - integrate: "Navigation from Library page to verse details"
  - preserve: "Existing routing structure and patterns"

DATA_SERVICE:
  - use: "Existing archiveVerse method for delete functionality"
  - preserve: "Dual-write pattern for verse operations"
  - integrate: "Local database queries for verse data"

COMPONENTS:
  - build: "New components following existing design patterns"
  - use: "Existing Button component for actions"
  - maintain: "Responsive design and accessibility standards"

NAVIGATION:
  - enhance: "Library page with clickable verse navigation"
  - add: "Back navigation from details to Library"
  - preserve: "Existing navigation patterns and history"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                    # ESLint checks
npm run typecheck              # TypeScript compilation

# Expected: No errors. If errors exist, read error messages and fix before proceeding
```

### Level 2: Component Testing
```typescript
// CREATE src/pages/VerseDetails/VerseDetails.test.tsx
describe('VerseDetails', () => {
  const mockVerseData = {
    verse: {
      id: 'verse-1',
      reference: 'John 3:16',
      text: 'For God so loved the world...',
      translation: 'ESV',
      is_verified: true
    },
    verseCard: {
      id: 'card-1',
      current_phase: 'weekly',
      assigned_day_of_week: 1,
      assigned_week_parity: null,
      assigned_day_of_month: null,
      current_streak: 5,
      best_streak: 10,
      phase_progress_count: 2,
      last_reviewed_at: '2024-01-15T10:00:00Z',
      next_due_date: '2024-01-22',
      created_at: '2024-01-01T00:00:00Z',
      archived: false
    }
  };

  test('displays verse information correctly', async () => {
    mockDatabase(mockVerseData);
    
    render(<VerseDetails />, { 
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/verse/card-1']}>
          <Route path="/verse/:verseCardId">{children}</Route>
        </MemoryRouter>
      )
    });

    await waitFor(() => {
      expect(screen.getByText('John 3:16')).toBeInTheDocument();
      expect(screen.getByText(/for god so loved the world/i)).toBeInTheDocument();
    });
  });

  test('displays schedule information for weekly verse', async () => {
    mockDatabase(mockVerseData);
    
    render(<VerseDetails />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/weekly/i)).toBeInTheDocument();
      expect(screen.getByText(/sunday/i)).toBeInTheDocument(); // Day 1 = Sunday
    });
  });

  test('displays streak statistics', async () => {
    mockDatabase(mockVerseData);
    
    render(<VerseDetails />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Current streak
      expect(screen.getByText('10')).toBeInTheDocument(); // Best streak
    });
  });

  test('handles verse not found', async () => {
    mockDatabase(null);
    
    render(<VerseDetails />, { wrapper: RouterWrapper });

    await waitFor(() => {
      expect(screen.getByText(/verse not found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to library/i })).toBeInTheDocument();
    });
  });

  test('delete functionality works', async () => {
    mockDatabase(mockVerseData);
    const mockArchive = jest.spyOn(dataService, 'archiveVerse').mockResolvedValue({} as any);
    
    render(<VerseDetails />, { wrapper: RouterWrapper });

    await waitFor(() => screen.getByRole('button', { name: /delete/i }));
    
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    
    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    
    await waitFor(() => {
      expect(mockArchive).toHaveBeenCalledWith('card-1', expect.any(String));
    });
  });
});
```

```bash
# Run and iterate until passing:
npm test src/pages/VerseDetails/
# If tests fail: Read error messages, fix issues, re-run
```

### Level 3: Integration Testing
```bash
# Start development server
npm run dev

# Test navigation flow in browser:
# 1. Navigate to Library (/)
# 2. Click on a verse
# 3. Verify navigation to /verse/:verseCardId
# 4. Verify all verse information displays correctly
# 5. Test delete functionality
# 6. Verify navigation back to Library

# Expected behavior:
# - Smooth navigation from Library to verse details
# - All verse information displayed accurately
# - Delete button archives verse and returns to Library
# - Back button works correctly
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run typecheck`
- [ ] New route `/verse/:verseCardId` accessible
- [ ] Navigation from Library to details works
- [ ] All specified verse information displays
- [ ] Delete functionality archives verse
- [ ] Error handling for missing verses
- [ ] Responsive design works on all screen sizes
- [ ] Back navigation functions correctly
- [ ] Loading states show appropriately

---

## Anti-Patterns to Avoid
- ❌ Don't perform hard delete - always use soft delete (archive)
- ❌ Don't break Library page existing functionality
- ❌ Don't skip error handling for missing verses
- ❌ Don't ignore responsive design requirements
- ❌ Don't forget loading states during data fetching
- ❌ Don't skip confirmation for delete action
- ❌ Don't hardcode route parameters - use useParams properly

## Performance & UX Considerations
- ✅ Fast data loading with local database queries
- ✅ Smooth navigation transitions
- ✅ Clear loading states for better user feedback
- ✅ Error boundaries and graceful error handling
- ✅ Accessible design with proper ARIA attributes
- ✅ Delete confirmation to prevent accidental removal
- ✅ Responsive design for all device sizes

**Confidence Score: 9/10** - Very high confidence due to comprehensive analysis of existing patterns, clear integration points, detailed component specifications, and extensive validation gates that ensure quality implementation.