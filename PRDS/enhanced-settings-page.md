# PRD: Enhanced Settings Page

## Problem Statement
The Settings page needs to allow users to update all user_profiles data fields and properly sync changes using the dual-write pattern.

## Requirements
### Editable Fields
- Email address
- Display name
- Display mode (theme preferences)
- Translation preference
- **Excluded**: user_id, id, created_at (system fields)

### Functionality
- Form validation for all fields
- Real-time UI updates on save
- Dual-write pattern: local first, then remote sync
- Error handling for sync failures
- Success feedback for updates

## Technical Approach
- Extend existing Settings component
- Create user profile update functions in dataService.ts
- Add RPC function for secure profile updates if needed
- Use existing form patterns and validation
- Implement proper error boundaries and loading states

## Acceptance Criteria
- All specified fields are editable
- Changes save locally immediately
- Remote sync occurs in background
- UI reflects current values accurately
- Form validation prevents invalid data
- Success/error feedback provided to user

## Priority
High

## Related Files
- `src/pages/Settings/Settings.tsx`
- `src/services/dataService.ts`
- `src/services/localDb.ts`
- `supabase/functions/verse-operations/index.ts` (if new RPC needed)