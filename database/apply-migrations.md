# Database Migration Instructions

## Setting up Supabase Database

### Option 1: Using Supabase Dashboard (Recommended for Development)

1. **Create a new Supabase project:**
   - Go to [supabase.com](https://supabase.com)
   - Click "Start your project" and sign in/up
   - Click "New Project"
   - Choose your organization
   - Enter project name: `bible-memory-app`
   - Enter database password (save this securely)
   - Choose region closest to you
   - Click "Create new project"

2. **Apply the migrations in order:**
   - Wait for project setup to complete (2-3 minutes)
   - Go to the "SQL Editor" tab in your Supabase dashboard
   
   **First, run the initial schema:**
   - Copy the contents of `database/migrations/001_initial_schema.sql` (the corrected version)
   - Paste into the SQL editor
   - Click "Run" to execute the migration
   
   **Then, run the MVP user profiles:**
   - Copy the contents of `database/migrations/002_user_profiles_mvp.sql`
   - Paste into the SQL editor
   - Click "Run" to execute the migration

3. **Update your environment variables:**
   - Go to "Settings" → "API" in your Supabase dashboard
   - Copy your project URL and anon key
   - Update your `.env` file:
     ```
     VITE_SUPABASE_URL=your_project_url_here
     VITE_SUPABASE_ANON_KEY=your_anon_key_here
     ```

### Option 2: Using Supabase CLI (Advanced)

If you prefer using the CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Verifying the Setup

After applying the migrations, verify that the following tables exist:

**MVP Tables:**
1. **user_profiles** - User preferences and reference display settings
2. **verses** - Shared cache of Bible verses from ESV API (no user association)
3. **verse_cards** - User's personal memory cards tracking spaced repetition progress
4. **review_logs** - Records review history and performance

**Views:**
5. **due_cards_view** - Convenient view for querying due cards

## Database Schema Overview

```
verses (shared cache)
├── id (UUID, PK)
├── reference (TEXT, UNIQUE) - e.g., "John 3:16"
├── text (TEXT) - The verse content
├── translation (TEXT) - Default: "ESV"
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

verse_cards
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users)
├── verse_id (UUID, FK → verses)
├── current_phase (TEXT) - 'daily'|'weekly'|'biweekly'|'monthly'
├── phase_progress_count (INTEGER)
├── last_reviewed_at (TIMESTAMPTZ)
├── next_due_date (DATE)
├── archived (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

review_logs
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users)
├── verse_card_id (UUID, FK → verse_cards)
├── was_successful (BOOLEAN)
├── counted_toward_progress (BOOLEAN)
├── review_time_seconds (INTEGER)
└── created_at (TIMESTAMPTZ)
```

## Security Features

- **Row Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Automatic `updated_at` triggers
- Proper foreign key constraints
- Optimized indexes for common queries

## Next Steps

After setting up the database:

1. Test the connection by running: `npm test -- --testPathPatterns=supabase.test.ts`
2. The tests should pass, confirming your Supabase setup is working
3. You can now proceed with implementing the authentication hook and other features