# Database Migration Strategy - Verses 2.0

## Current Approach: Single Master Migration

### Why This Approach
- **No Production Users**: Safe to drop and recreate database
- **Rapid Development**: No need to manage complex migration history
- **Single Source of Truth**: One file contains complete database schema
- **Simplified Deployment**: Always creates identical database structure

### How It Works
```bash
# All database changes go into this one file:
supabase/migrations/20250101000000_initial_schema.sql

# Deployment drops entire database and recreates from scratch
supabase db push --password "password"
```

### File Structure
```
supabase/
├── migrations/
│   └── 20250101000000_initial_schema.sql  # COMPLETE database schema
├── seed.sql                               # Optional seed data
└── config.toml                           # Project configuration
```

### Current Master Migration Contains
- All table definitions (verses, aliases, verse_cards, review_logs, user_profiles)
- All RLS policies and security rules
- All database functions (triggers, RPC functions, spaced repetition logic)
- All indexes and constraints
- All grants and permissions

### Development Workflow
1. **Make Changes**: Edit `supabase/migrations/20250101000000_initial_schema.sql`
2. **Deploy**: `supabase db push --password "password"`
3. **Result**: Database is dropped and recreated with new schema

### Benefits
- ✅ **Always Clean State**: No migration history conflicts
- ✅ **Fast Development**: No need to write incremental migrations  
- ✅ **No Rollback Issues**: Fresh database every time
- ✅ **Simple Testing**: Same exact schema in all environments
- ✅ **Easy Debugging**: All schema in one readable file

### Limitations
- ❌ **Data Loss**: Every deployment destroys all data
- ❌ **Not Production Ready**: Cannot be used with real users
- ❌ **No Migration History**: Can't track incremental changes

## Future: Production Migration Strategy

### When to Switch
- **Before Launch**: When you have real users who cannot lose data
- **User Data Exists**: When database contains valuable user-generated content
- **Multiple Environments**: When you need staging/production separation

### How the Switch Works
1. **Freeze Master Migration**: No more changes to `20250101000000_initial_schema.sql`
2. **Start Incremental Migrations**: Create new migration files for each change
3. **Preserve Data**: Use `ALTER TABLE` instead of `DROP TABLE`

### Production Migration Example
```bash
# Instead of editing master migration, create new ones:
supabase migration new add_verse_difficulty_column
supabase migration new add_streak_bonuses_table
supabase migration new update_rls_policies

# Each handles incremental changes without data loss
```

### Transition Plan
```sql
-- Future migration example (DO NOT USE YET)
-- supabase/migrations/20250201000000_add_difficulty_tracking.sql

-- Add new column without destroying existing data
ALTER TABLE verse_cards ADD COLUMN difficulty_rating INTEGER DEFAULT 1;

-- Add new table for feature expansion  
CREATE TABLE streak_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  streak_milestone INTEGER NOT NULL,
  bonus_points INTEGER NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing function
CREATE OR REPLACE FUNCTION calculate_streak_bonus(streak_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- New logic here
END;
$$ LANGUAGE plpgsql;
```

## Current Development Rules

### ✅ DO:
- Edit `supabase/migrations/20250101000000_initial_schema.sql` for all changes
- Add new tables, functions, policies to the master file
- Deploy with `supabase db push` (destroys and recreates)
- Test locally with `supabase db reset`

### ❌ DON'T:
- Create new migration files (not needed yet)
- Worry about data preservation (no real users)
- Use incremental migration patterns
- Try to preserve existing data during development

### Emergency Data Backup (If Needed)
```bash
# Before major changes, optionally backup test data
supabase db dump --password "password" > backup.sql

# After deployment, restore if needed
psql "postgresql://..." -f backup.sql
```

## Migration File Best Practices

### Organization in Master Migration
```sql
-- 1. Drop existing objects (for clean recreation)
DROP TABLE IF EXISTS review_logs CASCADE;
-- ... all drops

-- 2. Create tables in dependency order
CREATE TABLE verses (...);
CREATE TABLE aliases (...);
-- ... etc

-- 3. Create indexes
CREATE INDEX idx_verses_reference ON verses(reference);
-- ... all indexes

-- 4. Enable RLS
ALTER TABLE verses ENABLE ROW LEVEL SECURITY;
-- ... all RLS

-- 5. Create policies
CREATE POLICY "policy_name" ON table_name ...;
-- ... all policies

-- 6. Create functions
CREATE OR REPLACE FUNCTION func_name() ...;
-- ... all functions

-- 7. Create triggers
CREATE TRIGGER trigger_name ...;
-- ... all triggers

-- 8. Grant permissions
GRANT SELECT ON table_name TO authenticated;
-- ... all grants
```

### Comments and Documentation
```sql
-- CRITICAL: This is the master migration file
-- It contains the COMPLETE database schema
-- Changes here will DROP and RECREATE the entire database

-- ===== BIBLE MEMORY APP SCHEMA =====
-- Last updated: 2025-01-04
-- Version: 2.0 with secure edge functions
```

This strategy keeps development fast and simple until launch, then transitions to production-safe incremental migrations when needed.