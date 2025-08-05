# PRD: Remove Required Login Architecture (Major Change)

## Problem Statement
App currently requires login upfront, creating friction. Users should be able to use the app immediately with local storage, with optional account creation for cross-device sync.

## Requirements
### User Experience
- No login required on app start
- Full functionality available offline/locally
- **Non-pushy** account creation option in Settings
- Seamless sync when account is created later
- Local data preserved during account creation

### Technical Challenges
1. **Supabase Integration**: Research if anonymous/temporary accounts are possible
2. **AuthProvider Refactor**: Make authentication optional throughout app
3. **Data Migration**: Sync local data to cloud when account created
4. **RLS Policies**: Handle unauthenticated vs authenticated states

## Technical Approach
### Phase 1: Research
- Investigate Supabase anonymous user capabilities
- Analyze current AuthProvider and useAuth usage
- Design local-to-cloud data migration strategy

### Phase 2: Architecture Changes
- Refactor AuthProvider to support optional authentication
- Update all components using useAuth hooks
- Modify dataService.ts for authenticated/unauthenticated modes
- Update RLS policies if needed

### Phase 3: Account Creation Flow
- Add account creation option in Settings
- Implement local data migration to cloud
- Ensure seamless transition without data loss

## Acceptance Criteria
- App launches without requiring login
- Full functionality works locally
- Account creation is optional and non-intrusive
- Local data syncs when account created
- No data loss during authentication transition

## Priority
High

## Impact
Major architecture change affecting entire application

## Related Files
- `src/contexts/AuthContext.tsx`
- `src/pages/Auth/Auth.tsx`
- `src/router/AppRouter.tsx`
- `src/services/dataService.ts`
- `src/services/supabase.ts`
- `supabase/migrations/20250101000000_initial_schema.sql` (RLS policies)