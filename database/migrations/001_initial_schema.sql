-- Bible Memory App - Initial Database Schema
-- This migration creates the core tables for the Bible memory application
-- with Row Level Security (RLS) enabled for user data isolation

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create verses table (shared cache for all Bible verses from ESV API)
CREATE TABLE verses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference TEXT NOT NULL UNIQUE, -- e.g., "John 3:16"
    text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT 'ESV',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create verse_cards table for spaced repetition tracking
CREATE TABLE verse_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verse_id UUID NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
    current_phase TEXT NOT NULL DEFAULT 'daily' CHECK (current_phase IN ('daily', 'weekly', 'biweekly', 'monthly')),
    phase_progress_count INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    next_due_date DATE NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create review_logs table for tracking review history
CREATE TABLE review_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verse_card_id UUID NOT NULL REFERENCES verse_cards(id) ON DELETE CASCADE,
    was_successful BOOLEAN NOT NULL,
    counted_toward_progress BOOLEAN NOT NULL,
    review_time_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_verses_reference ON verses(reference);
CREATE INDEX idx_verses_translation ON verses(translation);

CREATE INDEX idx_verse_cards_user_id ON verse_cards(user_id);
CREATE INDEX idx_verse_cards_verse_id ON verse_cards(verse_id);
CREATE INDEX idx_verse_cards_next_due_date ON verse_cards(next_due_date);
CREATE INDEX idx_verse_cards_current_phase ON verse_cards(current_phase);

CREATE INDEX idx_review_logs_user_id ON review_logs(user_id);
CREATE INDEX idx_review_logs_verse_card_id ON review_logs(verse_card_id);
CREATE INDEX idx_review_logs_created_at ON review_logs(created_at);

-- Enable Row Level Security (RLS)
-- Note: verses table is a shared cache, no RLS needed
ALTER TABLE verse_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions for verses table (shared cache)
-- All authenticated users can read and insert verses (for caching ESV API responses)
GRANT SELECT, INSERT ON verses TO authenticated;

-- Create RLS policies for verse_cards table
CREATE POLICY "Users can view their own verse cards" ON verse_cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verse cards" ON verse_cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own verse cards" ON verse_cards
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own verse cards" ON verse_cards
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for review_logs table
CREATE POLICY "Users can view their own review logs" ON review_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review logs" ON review_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_verses_updated_at 
    BEFORE UPDATE ON verses
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verse_cards_updated_at 
    BEFORE UPDATE ON verse_cards
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create helpful views for common queries
CREATE VIEW due_cards_view AS
SELECT 
    vc.*,
    v.reference,
    v.text,
    v.translation
FROM verse_cards vc
JOIN verses v ON vc.verse_id = v.id
WHERE vc.archived = FALSE 
AND vc.next_due_date <= CURRENT_DATE;

-- Grant permissions on the view
GRANT SELECT ON due_cards_view TO authenticated;

-- Note: RLS policies are not needed on views since they inherit 
-- security from the underlying tables (verse_cards and verses)