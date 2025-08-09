# Verses 2.0 - Claude Project Bootstrap Guide

## Quick Start
**IMPTANT** When joining a new conversation about this project, read these files first in entirety and confirm to me that you have read each of them:
1. **THIS FILE** - Complete project context
2. `TASK.md` - Current active tasks and priorities  
3. `SUPABASE_CLI_README.md` - Supabase deployment knowledge
4. `README.md` - User-facing project documentation

## Project Overview

**Verses 2.0** is a secure Bible memory application built with React/TypeScript and Supabase. It implements spaced repetition learning with a local-first architecture and secure edge function-based API integration.

### Key Architecture Decisions
- **Local-First with Cloud Sync**: Dexie.js for offline capability, Supabase for sync
- **Security-First Design**: ESV API calls and database writes secured via edge functions
- **Spaced Repetition**: Progressive learning phases (daily → weekly → biweekly → monthly)
- **Dual-Write Pattern**: All operations work locally first, sync to cloud gracefully

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Dexie.js** for local IndexedDB operations

### Backend
- **Supabase** for authentication, database, and edge functions
- **PostgreSQL** with Row Level Security (RLS)
- **Deno** edge functions for secure API operations
- **ESV Bible API** for verse text retrieval

### Development Tools
- **Jest** for testing
- **ESLint** and **Prettier** for code quality
- **Supabase CLI** for deployment and local development

## Project Structure

```
verses/
├── src/
│   ├── components/           # Reusable UI components
│   ├── pages/               # Route-based page components
│   │   ├── AddVerse/        # Verse addition flow
│   │   ├── Review/          # Spaced repetition review
│   │   └── Library/         # User's verse collection
│   ├── services/            # Business logic layer
│   │   ├── dataService.ts   # Dual-write operations
│   │   ├── localDb.ts       # Dexie database schema
│   │   └── supabase.ts      # Supabase client and helpers
│   ├── utils/               # Pure utility functions
│   └── types/               # TypeScript type definitions
├── supabase/
│   ├── config.toml          # Supabase local configuration
│   ├── migrations/          # Single master migration file
│   │   └── 20250101000000_initial_schema.sql # Complete database schema
│   ├── seed.sql             # Database seed data
│   └── functions/           # Edge functions (Deno/TypeScript)
│       ├── esv-bible-api/   # ESV API proxy with token security
│       └── verse-operations/ # Secure verse CRUD with ESV verification
├── tests/                   # Jest test files
└── docs/                    # Technical documentation
```

## Security Architecture

### Authentication & Authorization
- **Row Level Security (RLS)** on all database tables
- **JWT-based authentication** via Supabase Auth
- **Service role keys** for edge function database operations

### Data Security
- **ESV API Token Protected**: Never exposed client-side, secured in edge functions
- **Database Write Protection**: Client cannot directly create verses/aliases
- **ESV Content Verification**: All verses must match ESV API exactly
- **Immutable Audit Records**: Review logs and verses cannot be updated

### Edge Function Security Model
```
Client → dataService.ts 
    ↓ (JWT token in Authorization header only)
verse-operations (edge function)
    ↓
├── JWT token validation & user extraction
├── Direct ESV API calls (consolidated for performance)
├── Secure database functions (rpc_create_verse, rpc_create_alias)
└── RLS policy enforcement
```

**Key Security Features:**
- **JWT-Only Authentication**: User ID extracted from verified JWT token, never trusted from client
- **ESV API Protection**: API key secured server-side, never exposed to client
- **Consolidated Edge Function**: Single secure endpoint reduces attack surface
- **Service Role Operations**: Database writes use service_role with RLS enforcement

## Database Schema

### Core Tables
- **verses**: Canonical ESV Bible verses (immutable)
- **aliases**: Alternative reference formats (e.g., "jn 1:1" → "John 1:1")
- **verse_cards**: User's learning cards with spaced repetition state
- **review_logs**: Immutable audit trail of all review attempts
- **user_profiles**: User preferences and settings

### Key Relationships
- `verse_cards.verse_id` → `verses.id` (many-to-one)
- `aliases.verse_id` → `verses.id` (many-to-one)  
- `review_logs.verse_card_id` → `verse_cards.id` (many-to-one)

### Security Functions
- **rpc_verse_lookup**: Optimized verse + user card lookup
- **rpc_create_verse**: Secure verse creation (service_role only)
- **rpc_create_alias**: Secure alias creation (service_role only)

## Spaced Repetition Algorithm

### Learning Phases
1. **Daily Phase**: 14 successful reviews → advance to weekly
2. **Weekly Phase**: 4 successful reviews → advance to biweekly  
3. **Biweekly Phase**: 4 successful reviews → advance to monthly
4. **Monthly Phase**: Maintenance phase (no further advancement)

### Scheduling Logic
- **Daily**: Due every day
- **Weekly**: Assigned to optimal weekday based on user's current load
- **Biweekly**: Assigned to weekday + week parity (even/odd weeks)
- **Monthly**: Assigned to specific day of month (1-28)

### Review Processing
- Only first successful review per day counts toward progression
- Failed reviews reset current streak but don't affect phase progression
- Database triggers handle all progression logic automatically

## Critical Code Patterns

### Dual-Write Pattern
```typescript
// Local operation first
await db.transaction('rw', [tables], async (tx) => {
  // All local changes in transaction
});

// Remote sync outside transaction (graceful degradation)
try {
  await syncToRemote(data);
} catch (error) {
  // Log error but don't fail - local succeeded
}
```

### Edge Function Security
```typescript
// Always verify with ESV API
const esvResponse = await callESVFunction(reference);
const isValid = await verifyVerseWithESV(reference, text);

// Use service_role client for database operations
const { data, error } = await supabase.rpc('rpc_create_verse', {
  p_reference: canonicalRef,
  p_text: verseText,
  p_translation: 'ESV'
});
```

### Error Handling Strategy
- **Validation Errors**: Immediate user feedback
- **Network Errors**: Graceful degradation with local-first approach
- **Security Errors**: Logged and blocked, clear error messages
- **Race Conditions**: Database constraints prevent duplicates

## Environment Configuration

### Development (.env)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_TITLE=Bible Memory App
VITE_APP_VERSION=1.0.0
```

### Production Secrets (Supabase Dashboard)
```bash
ESV_API_KEY=your-esv-api-key
ESV_API_BASE_URL=https://api.esv.org/v3
```

## Development Workflows

### Database Schema Changes
**IMPORTANT**: This project uses a single master migration file approach since there are no production users yet.

1. **Update Master Migration**: Modify `supabase/migrations/20250101000000_initial_schema.sql`
   - Add all new tables, functions, policies, etc. to this single file
   - This file contains the complete database schema from scratch
2. **Deploy (Drops & Recreates DB)**: `supabase db push --password "password"`
   - This will drop the existing database and recreate it entirely
   - Safe to do since no production users exist yet
3. **Update Types**: `supabase gen types typescript --linked > src/types/database.ts`
4. **Deploy Functions**: `supabase functions deploy function-name`

### Adding New Features
1. **Update Master Migration**: Edit `supabase/migrations/20250101000000_initial_schema.sql`
2. **Test Locally**: `supabase db reset` (if local environment works)  
3. **Deploy Remote**: `supabase db push --password "password"`
4. **Update Types**: `supabase gen types typescript --linked > src/types/database.ts`
5. **Deploy Functions**: `supabase functions deploy function-name`

### Migration Strategy
- **Pre-Launch**: Single master migration file, drop/recreate database
- **Post-Launch**: Will need to switch to incremental migrations to preserve user data

### Testing Strategy
- **Unit Tests**: Jest for utilities and business logic
- **Integration Tests**: Database operations with test fixtures
- **Manual Testing**: Real device testing for offline scenarios

### Deployment Process
```bash
# 1. Deploy edge functions
supabase functions deploy verse-operations --project-ref your-ref
# Note: esv-bible-api function is deprecated - ESV API calls are now direct in verse-operations

# 2. Link and deploy database changes
supabase link --project-ref your-ref --password "password"
supabase db push --password "password"

# 3. Set environment variables in Supabase Dashboard:
#    - ESV_API_KEY: Your ESV API token
#    - ESV_API_BASE_URL: https://api.esv.org/v3

# 4. Test verse operations endpoint
```

## Common Issues & Solutions

### Local Development Problems
- **Docker Conflicts**: `supabase stop --no-backup && docker system prune -f`
- **Analytics Issues**: Set `enabled = false` in config.toml [analytics] section
- **Port Conflicts**: Check `lsof -i :54321` and kill conflicting processes

### Migration Issues
- **History Conflicts**: Use `supabase migration repair --status applied timestamp`
- **Schema Differences**: Always test locally before production deployment
- **Function Deployment**: Add to migration file + run directly for immediate effect

### Security Debugging
- **RLS Policy Testing**: Use `--debug` flag and check auth context
- **Edge Function Errors**: Check Supabase Dashboard function logs
- **API Token Issues**: Verify environment variables are set correctly

## Performance Considerations

### Local Database Optimization
- **Compound Indexes**: `[user_id+verse_id]`, `[reference+translation]`
- **Transaction Boundaries**: Keep transactions small and atomic
- **Batch Operations**: Use `bulkAdd()` for multiple records

### Remote Database Optimization
- **RPC Functions**: Single call instead of multiple queries
- **Caching Strategy**: 5-minute cache for lookup operations
- **Selective Sync**: Only sync changed records based on timestamps

### Edge Function Performance
- **Consolidated Architecture**: Single `verse-operations` function reduces cold start overhead
- **Direct ESV API**: Eliminates intermediate edge function calls for better performance
- **Function Warm-up**: Functions may cold start, handle timeouts gracefully
- **Payload Size**: Keep request/response payloads minimal
- **ESV API Limits**: Respect rate limiting and cache responses
- **Optimistic UI**: Client shows immediate success, loads verse text progressively

## Testing Instructions

### Unit Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Generate coverage report
```

### Integration Testing
```bash
# Test database operations
npm run test -- --testPathPattern=services

# Test UI components  
npm run test -- --testPathPattern=components
```

### Manual Testing Scenarios
1. **Offline Mode**: Disable network, verify local operations work
2. **Sync Recovery**: Come back online, verify data syncs correctly
3. **Duplicate Prevention**: Try adding same verse multiple times
4. **Invalid References**: Test with fake Bible references
5. **Edge Cases**: Empty inputs, special characters, long text

## Debugging Tools

### Database Inspection
```bash
# Local database
supabase status
psql postgresql://postgres:postgres@localhost:54322/postgres

# Remote database  
psql "postgresql://postgres.project:password@host:port/postgres"
```

### Edge Function Debugging
- **Supabase Dashboard**: Function logs and performance metrics
- **Local Testing**: `supabase functions serve` for development
- **CORS Issues**: Check headers in function responses

### Client-Side Debugging
- **Network Tab**: Verify API calls and responses
- **IndexedDB**: Chrome DevTools → Application → Storage
- **Console Logs**: Check for error patterns and performance warnings

## Code Quality Standards

### TypeScript
- **Strict Mode**: All strict TypeScript checks enabled
- **Interface Definitions**: Match database schema exactly
- **Generic Types**: Use for reusable patterns

### Error Handling
- **Custom Error Classes**: `DuplicateVerseError`, `NetworkError`, `ValidationError`
- **Graceful Degradation**: Local operations continue despite remote failures
- **User-Friendly Messages**: Clear, actionable error messages

### Security Guidelines
- **Input Validation**: Validate all user inputs
- **Output Sanitization**: Sanitize data from external APIs
- **Token Management**: Never log or expose API tokens
- **RLS Testing**: Verify all database operations respect user boundaries

## Key Files to Monitor

### Critical Business Logic
- `src/services/dataService.ts` - Core dual-write operations
- `src/services/localDb.ts` - Database schema and transactions
- `supabase/functions/verse-operations/index.ts` - Secure verse operations

### Configuration Files
- `supabase/config.toml` - Local development configuration
- `supabase/migrations/20250101000000_initial_schema.sql` - Master database schema (single source of truth)
- `.env` - Environment variables (never commit with real values)

### Security-Critical Files
- `supabase/functions/verse-operations/index.ts` - JWT validation & ESV API integration
- Database migration RLS policies
- Edge function CORS configurations
- Note: `esv-bible-api` function deprecated - ESV logic consolidated into verse-operations

This guide provides the complete context needed to effectively work on the Verses 2.0 project. Always refer to `TASK.md` for current priorities and active work items.