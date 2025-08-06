# PRD: Fix Rereviewing Cards Functionality

## Problem Statement
The rereviewing feature is currently broken with the error "Failed to mark card correct: Error: Failed to record review: Review already recorded for today". Users should be able to review a verse multiple times per day, but only the first review counts toward progression.

## Requirements
- First review of the day: `count_toward_progress = true`
- Subsequent reviews same day: `count_toward_progress = false`
- All reviews should be recorded in review_logs
- No duplicate prevention for same-day reviews

## Technical Approach
- Modify review recording logic in `dataService.ts`
- Update database constraints to allow multiple reviews per day
- Add `count_toward_progress` field logic
- Update edge function to handle multiple daily reviews

## Acceptance Criteria
- Users can review the same verse multiple times per day
- Only first successful review affects phase/streak progression
- All review attempts are logged with correct `count_toward_progress` flag

## Priority
High

## Related Files
- `src/services/dataService.ts`
- `src/pages/Review/hooks/useReview.ts`
- `supabase/functions/verse-operations/index.ts`
- `supabase/migrations/20250101000000_initial_schema.sql`