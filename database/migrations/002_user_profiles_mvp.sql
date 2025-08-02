-- Bible Memory App - MVP User Profiles
-- This migration adds minimal user profiles for MVP functionality

-- Create user_profiles table for essential app-specific user data
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    preferred_translation TEXT DEFAULT 'ESV',
    reference_display_mode TEXT DEFAULT 'full' CHECK (reference_display_mode IN ('full', 'first', 'blank')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add streak tracking to verse_cards (for motivation)
ALTER TABLE verse_cards ADD COLUMN current_streak INTEGER DEFAULT 0;
ALTER TABLE verse_cards ADD COLUMN best_streak INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Add updated_at trigger
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

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