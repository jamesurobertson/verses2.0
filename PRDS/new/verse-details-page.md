# PRD: Individual Verse Details Page

## Problem Statement
Users need a dedicated page to view and manage individual verse details, accessible from the Library page. This should provide comprehensive verse management capabilities.

## Requirements
### Display Fields
- Verse reference and text
- Current phase (daily/weekly/biweekly/monthly)
- Assigned day of week/month
- Week parity (for biweekly verses)
- Current streak
- Best streak
- Current phase progress count
- **Do not show**: archived status (internal use only)

### Functionality
- Delete verse (archive internally, don't actually delete)
- Navigation from Library page verse click
- Responsive design consistent with app

## Technical Approach
- Create new route `/verse/:verseCardId`
- New component `pages/VerseDetails/VerseDetails.tsx`
- Update Library.tsx to handle verse click navigation
- Use existing dataService patterns for verse archiving
- Fetch verse details via existing RPC functions

## Acceptance Criteria
- Clicking verse in Library navigates to details page
- All specified fields display correctly
- Delete button archives verse (soft delete)
- Page follows existing UI patterns and responsiveness

## Priority
High

## Related Files
- `src/pages/Library/Library.tsx`
- `src/pages/VerseDetails/` (new directory)
- `src/router/AppRouter.tsx`
- `src/services/dataService.ts`