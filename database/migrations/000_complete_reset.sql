-- Bible Memory App - Complete Database Schema
-- This migration creates the complete database schema in one file

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables and functions if they exist
DROP TABLE IF EXISTS review_logs CASCADE;
DROP TABLE IF EXISTS verse_cards CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS verses CASCADE;
DROP VIEW IF EXISTS due_cards_view CASCADE;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_streak_counters() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Verses Table
CREATE TABLE public.verses (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    reference text NOT NULL,
    text text NOT NULL,
    translation text NOT NULL DEFAULT 'ESV',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(reference, translation)
);

-- Enable RLS
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;

-- Verse Cards Table
CREATE TABLE public.verse_cards (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verse_id uuid NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
    current_phase text NOT NULL DEFAULT 'daily' 
        CHECK (current_phase IN ('daily', 'weekly', 'biweekly', 'monthly')),
    phase_progress_count integer NOT NULL DEFAULT 0,
    last_reviewed_at timestamp with time zone,
    next_due_date date NOT NULL,
    archived boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_streak integer DEFAULT 0,
    best_streak integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.verse_cards ENABLE ROW LEVEL SECURITY;

-- Review Logs Table
CREATE TABLE public.review_logs (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verse_card_id uuid NOT NULL REFERENCES public.verse_cards(id) ON DELETE CASCADE,
    was_successful boolean NOT NULL,
    counted_toward_progress boolean NOT NULL,
    review_time_seconds integer,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles Table
CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    preferred_translation text DEFAULT 'ESV',
    reference_display_mode text DEFAULT 'full' CHECK (reference_display_mode IN ('full', 'first', 'blank')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- RLS Policies for Verses (public read, authenticated insert)
CREATE POLICY "Verses are viewable by everyone" ON public.verses
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert verses" ON public.verses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for Verse Cards
CREATE POLICY "Users can manage their own verse cards" ON public.verse_cards
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Review Logs
CREATE POLICY "Users can manage their own review logs" ON public.review_logs
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for User Profiles
CREATE POLICY "Users can manage their own profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = user_id);

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

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if a profile already exists to prevent duplicate entries
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = NEW.id) THEN
        INSERT INTO public.user_profiles (user_id, email, full_name)
        VALUES (
            NEW.id, 
            NEW.email, 
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update streak counters
CREATE OR REPLACE FUNCTION update_streak_counters()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update streaks for successful reviews that count toward progress
    IF NEW.was_successful AND NEW.counted_toward_progress THEN
        UPDATE verse_cards 
        SET 
            current_streak = current_streak + 1,
            best_streak = GREATEST(best_streak, current_streak + 1)
        WHERE id = NEW.verse_card_id;
    ELSIF NOT NEW.was_successful THEN
        -- Reset current streak on failure
        UPDATE verse_cards 
        SET current_streak = 0
        WHERE id = NEW.verse_card_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update streaks
CREATE TRIGGER update_streak_counters_trigger
    AFTER INSERT ON review_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_streak_counters();

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

-- Grant permissions
GRANT SELECT ON due_cards_view TO authenticated;
GRANT SELECT, INSERT ON verses TO authenticated;

-- Function to create a review log when a verse_card is inserted
CREATE OR REPLACE FUNCTION create_review_log_for_verse_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert a new review log entry for the newly created verse_card
  INSERT INTO review_logs (verse_card_id, user_id, created_at)
  VALUES (NEW.id, NEW.user_id, NOW());
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER verse_card_review_log_trigger
AFTER INSERT ON verse_cards
FOR EACH ROW
EXECUTE FUNCTION create_review_log_for_verse_card();
