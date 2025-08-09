-- Bible Memory App - Complete Database Schema
-- This migration creates the complete database schema in one file

-- Drop existing tables and functions if they exist (PRESERVE VERSES AND ALIASES TABLES)
DROP TABLE IF EXISTS review_logs CASCADE;
DROP TABLE IF EXISTS verse_cards CASCADE;
-- DROP TABLE IF EXISTS aliases CASCADE; -- COMMENTED OUT - Keep existing aliases to preserve reference mappings
DROP TABLE IF EXISTS user_profiles CASCADE;
-- DROP TABLE IF EXISTS verses CASCADE; -- COMMENTED OUT - Keep existing verses to avoid wasting ESV API calls
DROP VIEW IF EXISTS due_cards_view CASCADE;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_streak_counters() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_optimal_assignment() CASCADE;
DROP FUNCTION IF EXISTS calculate_next_assigned_date() CASCADE;
DROP FUNCTION IF EXISTS process_review_comprehensive() CASCADE;
DROP FUNCTION IF EXISTS create_review_log_for_verse_card() CASCADE;

-- Verses Table (preserve existing verses)
CREATE TABLE IF NOT EXISTS public.verses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference text NOT NULL,
    text text NOT NULL,
    translation text NOT NULL DEFAULT 'ESV',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(reference, translation)
);

-- Enable RLS
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;

-- Aliases Table (preserve existing aliases)
CREATE TABLE IF NOT EXISTS public.aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alias text UNIQUE NOT NULL,
    verse_id uuid NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aliases ENABLE ROW LEVEL SECURITY;

-- Verse Cards Table
CREATE TABLE public.verse_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verse_id uuid NOT NULL REFERENCES public.verses(id) ON DELETE CASCADE,
    current_phase text NOT NULL DEFAULT 'daily' 
        CHECK (current_phase IN ('daily', 'weekly', 'biweekly', 'monthly')),
    phase_progress_count integer NOT NULL DEFAULT 0,
    last_reviewed_at timestamp with time zone,
    next_due_date date NOT NULL DEFAULT CURRENT_DATE,
    assigned_day_of_week integer CHECK (assigned_day_of_week BETWEEN 1 AND 7),
    assigned_week_parity integer CHECK (assigned_week_parity IN (0, 1)),
    assigned_day_of_month integer CHECK (assigned_day_of_month BETWEEN 1 AND 28),
    archived boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    current_streak integer NOT NULL DEFAULT 0,
    best_streak integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.verse_cards ENABLE ROW LEVEL SECURITY;

-- Review Logs Table
CREATE TABLE public.review_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    preferred_translation text DEFAULT 'ESV',
    reference_display_mode text DEFAULT 'full' CHECK (reference_display_mode IN ('full', 'first', 'blank')),
    timezone text DEFAULT 'UTC',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_verses_reference ON verses(reference);
CREATE INDEX idx_verses_translation ON verses(translation);

CREATE INDEX idx_aliases_alias ON aliases(alias);
CREATE INDEX idx_aliases_verse_id ON aliases(verse_id);

CREATE INDEX idx_verse_cards_user_id ON verse_cards(user_id);
CREATE INDEX idx_verse_cards_verse_id ON verse_cards(verse_id);
CREATE INDEX idx_verse_cards_next_due_date ON verse_cards(next_due_date);
CREATE INDEX idx_verse_cards_current_phase ON verse_cards(current_phase);
CREATE INDEX idx_verse_cards_assignments ON verse_cards(user_id, current_phase, assigned_day_of_week, assigned_week_parity, assigned_day_of_month);

CREATE INDEX idx_review_logs_user_id ON review_logs(user_id);
CREATE INDEX idx_review_logs_verse_card_id ON review_logs(verse_card_id);
CREATE INDEX idx_review_logs_created_at ON review_logs(created_at);

-- Allow multiple reviews per card per day - removed unique constraint
-- The process_review_comprehensive() trigger handles count_toward_progress logic
-- CREATE UNIQUE INDEX idx_one_review_per_card_per_day 
--     ON review_logs(verse_card_id, user_id, date(created_at AT TIME ZONE 'UTC'));

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_timezone ON user_profiles(timezone);

-- RLS Policies for Verses (public read, server-side insert only)
CREATE POLICY "Verses are viewable by everyone" ON public.verses
    FOR SELECT USING (true);

-- No INSERT policy - verses can only be created via edge functions with SECURITY DEFINER

-- RLS Policies for Aliases (public read, server-side insert only)
CREATE POLICY "Aliases are viewable by everyone" ON public.aliases
    FOR SELECT USING (true);

-- No INSERT/UPDATE policies - aliases can only be created via edge functions with SECURITY DEFINER

-- RLS Policies for Verse Cards
CREATE POLICY "Users can manage their own verse cards" ON public.verse_cards
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for Review Logs (immutable audit records)
CREATE POLICY "Users can view their own review logs" ON public.review_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own review logs" ON public.review_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review logs" ON public.review_logs
    FOR DELETE USING (auth.uid() = user_id);

-- No UPDATE policy - review logs are immutable audit records

-- RLS Policies for User Profiles
CREATE POLICY "Users can manage their own profile" ON public.user_profiles
    FOR ALL USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE FUNCTION update_updated_at_column()
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
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if a profile already exists to prevent duplicate entries
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = NEW.id) THEN
        INSERT INTO public.user_profiles (id, user_id, email, full_name, timezone)
        VALUES (
            gen_random_uuid(), -- Generate UUID for profile ID
            NEW.id, 
            NEW.email, 
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
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

-- Create function to find optimal assignment for phase distribution
CREATE OR REPLACE FUNCTION get_optimal_assignment(
  user_id_param UUID,
  target_phase TEXT
) RETURNS TABLE(
  day_of_week INTEGER,
  week_parity INTEGER, 
  day_of_month INTEGER
) AS $$
BEGIN
  -- Validate inputs
  IF user_id_param IS NULL THEN
    RAISE EXCEPTION 'user_id_param cannot be NULL';
  END IF;
  
  IF target_phase NOT IN ('weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid target_phase: %. Must be weekly, biweekly, or monthly', target_phase;
  END IF;
  IF target_phase = 'weekly' THEN
    -- Find weekday with fewest weekly cards for this user
    RETURN QUERY
    SELECT days.day_num, NULL::INTEGER, NULL::INTEGER
    FROM generate_series(1,7) AS days(day_num)
    LEFT JOIN verse_cards vc ON (
      vc.user_id = user_id_param 
      AND vc.current_phase = 'weekly'
      AND vc.assigned_day_of_week = days.day_num
    )
    GROUP BY days.day_num
    ORDER BY COUNT(vc.id), RANDOM()
    LIMIT 1;
    
  ELSIF target_phase = 'biweekly' THEN
    -- Find weekday+parity combo with fewest biweekly cards
    RETURN QUERY
    SELECT days.day_num, weeks.parity, NULL::INTEGER
    FROM generate_series(1,7) AS days(day_num)
    CROSS JOIN generate_series(0,1) AS weeks(parity)
    LEFT JOIN verse_cards vc ON (
      vc.user_id = user_id_param 
      AND vc.current_phase = 'biweekly'
      AND vc.assigned_day_of_week = days.day_num
      AND vc.assigned_week_parity = weeks.parity
    )
    GROUP BY days.day_num, weeks.parity
    ORDER BY COUNT(vc.id), RANDOM()
    LIMIT 1;
    
  ELSIF target_phase = 'monthly' THEN
    -- Find day 1-28 with fewest monthly cards
    RETURN QUERY
    SELECT NULL::INTEGER, NULL::INTEGER, days.day_num
    FROM generate_series(1,28) AS days(day_num)
    LEFT JOIN verse_cards vc ON (
      vc.user_id = user_id_param 
      AND vc.current_phase = 'monthly'
      AND vc.assigned_day_of_month = days.day_num
    )
    GROUP BY days.day_num
    ORDER BY COUNT(vc.id), RANDOM()
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate next assigned date
CREATE OR REPLACE FUNCTION calculate_next_assigned_date(
  phase_name TEXT,
  day_of_week_param INTEGER,
  week_parity_param INTEGER,
  day_of_month_param INTEGER,
  user_timezone TEXT
) RETURNS DATE AS $$
DECLARE
  user_today DATE;
  next_date DATE;
  current_dow INTEGER;
  days_ahead INTEGER;
BEGIN
  -- Validate inputs
  IF phase_name IS NULL OR phase_name NOT IN ('daily', 'weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'Invalid phase_name: %. Must be daily, weekly, biweekly, or monthly', phase_name;
  END IF;
  
  IF user_timezone IS NULL THEN
    user_timezone := 'UTC';
  END IF;
  
  -- Calculate user_today with error handling
  BEGIN
    user_today := (NOW() AT TIME ZONE user_timezone)::DATE;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid timezone: %', user_timezone;
  END;
  IF phase_name = 'daily' THEN
    RETURN (user_today + INTERVAL '1 day')::DATE;
    
  ELSIF phase_name = 'weekly' THEN
    -- Find next occurrence of assigned weekday
    -- Convert PostgreSQL DOW (0=Sun, 1=Mon, ..., 6=Sat) to our schema (1=Sun, 2=Mon, ..., 7=Sat)
    current_dow := EXTRACT(DOW FROM user_today) + 1;
    days_ahead := (day_of_week_param - current_dow + 7) % 7;
    IF days_ahead = 0 THEN days_ahead := 7; END IF; -- If today, schedule for next week
    RETURN (user_today + days_ahead * INTERVAL '1 day')::DATE;
    
  ELSIF phase_name = 'biweekly' THEN
    -- Find next occurrence of assigned weekday + week parity using epoch-based calculation
    next_date := (user_today + INTERVAL '1 day')::DATE;
    LOOP
      -- Convert PostgreSQL DOW (0=Sun, 1=Mon, ..., 6=Sat) to our schema (1=Sun, 2=Mon, ..., 7=Sat)
      IF (EXTRACT(DOW FROM next_date) + 1) = day_of_week_param 
         AND ((EXTRACT(EPOCH FROM next_date)::INTEGER / 86400) / 7) % 2 = week_parity_param THEN
        EXIT;
      END IF;
      next_date := next_date + 1;
      -- Safety check to prevent infinite loop
      IF next_date > user_today + INTERVAL '14 days' THEN
        EXIT;
      END IF;
    END LOOP;
    RETURN next_date;
    
  ELSIF phase_name = 'monthly' THEN
    -- Find next occurrence of assigned day of month
    -- Build the date for this month first
    BEGIN
      next_date := MAKE_DATE(
        EXTRACT(YEAR FROM user_today)::INTEGER,
        EXTRACT(MONTH FROM user_today)::INTEGER,
        day_of_month_param
      );
    EXCEPTION WHEN OTHERS THEN
      -- If day doesn't exist in current month (e.g., Feb 30), use last day of month
      next_date := DATE_TRUNC('month', user_today) + INTERVAL '1 month' - INTERVAL '1 day';
    END;
    
    -- If that date has passed, go to next month
    IF next_date <= user_today THEN
      BEGIN
        next_date := MAKE_DATE(
          EXTRACT(YEAR FROM user_today + INTERVAL '1 month')::INTEGER,
          EXTRACT(MONTH FROM user_today + INTERVAL '1 month')::INTEGER,
          day_of_month_param
        );
      EXCEPTION WHEN OTHERS THEN
        -- If day doesn't exist in next month, use last day of that month
        next_date := DATE_TRUNC('month', user_today + INTERVAL '2 months') - INTERVAL '1 day';
      END;
    END IF;
    RETURN next_date;
  END IF;
  
  RETURN (user_today + INTERVAL '1 day')::DATE; -- fallback
END;
$$ LANGUAGE plpgsql;

-- Create function to process reviews comprehensively with spaced repetition
CREATE FUNCTION process_review_comprehensive()
RETURNS TRIGGER AS $$
DECLARE
    is_first_review_today BOOLEAN;
    current_card RECORD;
    user_timezone TEXT;
    user_today DATE;
    new_progress INTEGER;
    new_phase TEXT;
    phase_requirement INTEGER;
    next_due DATE;
    new_current_streak INTEGER;
    new_best_streak INTEGER;
    assignment_record RECORD;
    assigned_dow INTEGER;
    assigned_parity INTEGER;
    assigned_dom INTEGER;
BEGIN
    -- Validate that required data exists
    IF NEW.verse_card_id IS NULL OR NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'verse_card_id and user_id cannot be NULL';
    END IF;
    -- Get user timezone and current card state with error handling
    SELECT vc.* INTO current_card
    FROM verse_cards vc
    WHERE vc.id = NEW.verse_card_id;
    
    SELECT up.timezone INTO user_timezone
    FROM user_profiles up
    WHERE up.user_id = NEW.user_id;
    
    -- Ensure we found the card and user profile
    IF current_card IS NULL THEN
        RAISE EXCEPTION 'Verse card not found or user profile missing for card_id: %', NEW.verse_card_id;
    END IF;
    
    -- Default timezone if not set
    IF user_timezone IS NULL THEN
        user_timezone := 'UTC';
    END IF;
    
    -- Calculate user's today
    user_today := (NOW() AT TIME ZONE user_timezone)::DATE;
    
    -- Check if this is first review today for this card (using UTC for consistency with unique constraint)
    is_first_review_today := NOT EXISTS (
        SELECT 1 FROM review_logs rl
        WHERE rl.verse_card_id = NEW.verse_card_id 
        AND rl.user_id = NEW.user_id 
        AND date(rl.created_at AT TIME ZONE 'UTC') = date(NOW() AT TIME ZONE 'UTC')
        AND rl.id != NEW.id
    );
    
    -- Update the review log with whether it counts toward progress
    -- Only successful first reviews of the day count toward progress
    UPDATE review_logs 
    SET counted_toward_progress = (NEW.was_successful AND is_first_review_today)
    WHERE id = NEW.id;
    
    -- Calculate streak updates
    IF NEW.was_successful AND is_first_review_today THEN
        new_current_streak := current_card.current_streak + 1;
        new_best_streak := GREATEST(current_card.best_streak, new_current_streak);
    ELSIF NOT NEW.was_successful THEN
        -- Reset current streak on failure
        new_current_streak := 0;
        new_best_streak := current_card.best_streak;
    ELSE
        -- Neither successful first review nor failure - keep streaks unchanged
        new_current_streak := current_card.current_streak;
        new_best_streak := current_card.best_streak;
    END IF;
    
    -- Calculate spaced repetition updates only if this review counts toward progress
    IF NEW.was_successful AND is_first_review_today THEN
        -- Determine phase requirements
        CASE current_card.current_phase
            WHEN 'daily' THEN phase_requirement := 14;
            WHEN 'weekly' THEN phase_requirement := 4;
            WHEN 'biweekly' THEN phase_requirement := 4;
            WHEN 'monthly' THEN phase_requirement := NULL; -- No advancement from monthly
        END CASE;
        
        new_progress := current_card.phase_progress_count + 1;
        
        -- Check if we should advance to next phase
        IF phase_requirement IS NOT NULL AND new_progress >= phase_requirement THEN
            -- Advance to next phase and reset progress
            CASE current_card.current_phase
                WHEN 'daily' THEN new_phase := 'weekly';
                WHEN 'weekly' THEN new_phase := 'biweekly';
                WHEN 'biweekly' THEN new_phase := 'monthly';
            END CASE;
            new_progress := 0;
            
            -- Get optimal assignment for new phase
            SELECT * INTO assignment_record
            FROM get_optimal_assignment(NEW.user_id, new_phase)
            LIMIT 1;
            
            assigned_dow := assignment_record.day_of_week;
            assigned_parity := assignment_record.week_parity;
            assigned_dom := assignment_record.day_of_month;
            
            -- Calculate next due date based on assignment
            next_due := calculate_next_assigned_date(new_phase, assigned_dow, assigned_parity, assigned_dom, user_timezone);
        ELSE
            -- Stay in current phase - keep existing assignments
            new_phase := current_card.current_phase;
            assigned_dow := current_card.assigned_day_of_week;
            assigned_parity := current_card.assigned_week_parity;
            assigned_dom := current_card.assigned_day_of_month;
            
            -- Calculate next due date based on current phase and assignments
            next_due := calculate_next_assigned_date(new_phase, assigned_dow, assigned_parity, assigned_dom, user_timezone);
        END IF;
    ELSE
        -- Review doesn't count toward progress - keep current values and recalculate due date
        new_progress := current_card.phase_progress_count;
        new_phase := current_card.current_phase;
        assigned_dow := current_card.assigned_day_of_week;
        assigned_parity := current_card.assigned_week_parity;
        assigned_dom := current_card.assigned_day_of_month;
        
        -- Calculate next due date based on current phase
        next_due := calculate_next_assigned_date(new_phase, assigned_dow, assigned_parity, assigned_dom, user_timezone);
    END IF;
    
    -- Update verse_card with all calculated values
    UPDATE verse_cards SET
        last_reviewed_at = NOW(),
        next_due_date = next_due,
        current_phase = new_phase,
        phase_progress_count = new_progress,
        assigned_day_of_week = assigned_dow,
        assigned_week_parity = assigned_parity,
        assigned_day_of_month = assigned_dom,
        current_streak = new_current_streak,
        best_streak = new_best_streak,
        updated_at = NOW()
    WHERE id = NEW.verse_card_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process reviews comprehensively
CREATE TRIGGER process_review_comprehensive_trigger
    AFTER INSERT ON review_logs
    FOR EACH ROW
    EXECUTE FUNCTION process_review_comprehensive();

-- Grant permissions
GRANT SELECT ON verses TO authenticated; -- Read-only from client
GRANT SELECT ON aliases TO authenticated; -- Read-only from client
-- Grant permissions for verse_cards table
GRANT SELECT, INSERT, UPDATE, DELETE ON verse_cards TO authenticated;
GRANT SELECT, INSERT, DELETE ON review_logs TO authenticated; -- No UPDATE - review logs are immutable
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;

-- Function to initialize next_due_date when verse_card is inserted
CREATE OR REPLACE FUNCTION initialize_verse_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_timezone TEXT;
    initial_due_date DATE;
BEGIN
  -- Validate input
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;
  
  -- Get user timezone with error handling
  SELECT timezone INTO user_timezone FROM user_profiles WHERE user_id = NEW.user_id;
  
  IF user_timezone IS NULL THEN
    user_timezone := 'UTC';
  END IF;
  
  -- Calculate initial due date (tomorrow in user's timezone)
  BEGIN
    initial_due_date := ((NOW() AT TIME ZONE user_timezone) + INTERVAL '1 day')::DATE;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback to UTC if timezone is invalid
    initial_due_date := ((NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day')::DATE;
  END;
  
  -- Update the verse card with proper initial due date
  UPDATE verse_cards 
  SET next_due_date = initial_due_date
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER verse_card_initialization_trigger
AFTER INSERT ON verse_cards
FOR EACH ROW
EXECUTE FUNCTION initialize_verse_card();

-- Add comment for documentation
COMMENT ON TABLE public.aliases IS 'Normalized reference formats that point to verses (e.g. "jn 1:1", "john 1:1") for fast lookup';

-- Optimized verse lookup function to reduce API calls
CREATE OR REPLACE FUNCTION rpc_verse_lookup(
  p_reference TEXT,
  p_normalized TEXT,
  p_user_id UUID DEFAULT NULL,
  p_translation TEXT DEFAULT 'ESV'
) RETURNS JSON AS $$
DECLARE
  result JSON;
  found_via_alias BOOLEAN := false;
BEGIN
  -- Validate inputs
  IF p_reference IS NULL OR p_normalized IS NULL THEN
    RETURN '{"verse": null, "found_via_alias": false, "user_card": null, "error": "Invalid parameters"}'::json;
  END IF;

  -- Single query to get verse and user card data using JSON aggregation
  WITH verse_lookup AS (
    -- Direct verse lookup
    SELECT 
      v.id, v.reference, v.text, v.translation, v.created_at, v.updated_at,
      vc.id as card_id, vc.user_id as card_user_id, vc.verse_id as card_verse_id,
      vc.current_phase, vc.phase_progress_count, vc.last_reviewed_at,
      vc.next_due_date, vc.assigned_day_of_week, vc.assigned_week_parity,
      vc.assigned_day_of_month, vc.archived, vc.current_streak, vc.best_streak,
      vc.created_at as card_created_at, vc.updated_at as card_updated_at,
      false as via_alias
    FROM verses v
    LEFT JOIN verse_cards vc ON (vc.verse_id = v.id AND vc.user_id = p_user_id)
    WHERE v.reference = p_reference AND v.translation = p_translation
    
    UNION ALL
    
    -- Alias lookup
    SELECT 
      v.id, v.reference, v.text, v.translation, v.created_at, v.updated_at,
      vc.id as card_id, vc.user_id as card_user_id, vc.verse_id as card_verse_id,
      vc.current_phase, vc.phase_progress_count, vc.last_reviewed_at,
      vc.next_due_date, vc.assigned_day_of_week, vc.assigned_week_parity,
      vc.assigned_day_of_month, vc.archived, vc.current_streak, vc.best_streak,
      vc.created_at as card_created_at, vc.updated_at as card_updated_at,
      true as via_alias
    FROM aliases a
    JOIN verses v ON v.id = a.verse_id
    LEFT JOIN verse_cards vc ON (vc.verse_id = v.id AND vc.user_id = p_user_id)
    WHERE a.alias = p_normalized AND v.translation = p_translation
    AND NOT EXISTS (
      SELECT 1 FROM verses v2 
      WHERE v2.reference = p_reference AND v2.translation = p_translation
    )
  )
  SELECT json_build_object(
    'verse', CASE 
      WHEN vl.id IS NOT NULL THEN json_build_object(
        'id', vl.id,
        'reference', vl.reference,
        'text', vl.text,
        'translation', vl.translation,
        'created_at', vl.created_at,
        'updated_at', vl.updated_at
      )
      ELSE NULL
    END,
    'found_via_alias', COALESCE(vl.via_alias, false),
    'user_card', CASE 
      WHEN vl.card_id IS NOT NULL THEN json_build_object(
        'id', vl.card_id,
        'user_id', vl.card_user_id,
        'verse_id', vl.card_verse_id,
        'current_phase', vl.current_phase,
        'phase_progress_count', vl.phase_progress_count,
        'last_reviewed_at', vl.last_reviewed_at,
        'next_due_date', vl.next_due_date,
        'assigned_day_of_week', vl.assigned_day_of_week,
        'assigned_week_parity', vl.assigned_week_parity,
        'assigned_day_of_month', vl.assigned_day_of_month,
        'archived', vl.archived,
        'current_streak', vl.current_streak,
        'best_streak', vl.best_streak,
        'created_at', vl.card_created_at,
        'updated_at', vl.card_updated_at
      )
      ELSE NULL
    END,
    'error', NULL
  ) INTO result
  FROM verse_lookup vl
  LIMIT 1;

  -- Return empty result if nothing found
  IF result IS NULL THEN
    result := '{"verse": null, "found_via_alias": false, "user_card": null, "error": null}'::json;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_verse_lookup TO authenticated;

-- Secure function to create verses (only callable from edge functions)
CREATE OR REPLACE FUNCTION rpc_create_verse(
  p_reference TEXT,
  p_text TEXT,
  p_translation TEXT DEFAULT 'ESV'
) RETURNS JSON AS $$
DECLARE
  verse_id UUID;
  result JSON;
BEGIN
  -- Validate inputs
  IF p_reference IS NULL OR p_text IS NULL OR p_reference = '' OR p_text = '' THEN
    RETURN json_build_object('error', 'Reference and text are required');
  END IF;
  
  -- Check if verse already exists
  SELECT id INTO verse_id 
  FROM verses 
  WHERE reference = p_reference AND translation = p_translation;
  
  IF verse_id IS NOT NULL THEN
    -- Return existing verse
    SELECT json_build_object(
      'id', id,
      'reference', reference,
      'text', text,
      'translation', translation,
      'created_at', created_at,
      'updated_at', updated_at,
      'existed', true
    ) INTO result
    FROM verses
    WHERE id = verse_id;
    
    RETURN result;
  END IF;
  
  -- Create new verse
  INSERT INTO verses (reference, text, translation)
  VALUES (p_reference, p_text, p_translation)
  RETURNING id, reference, text, translation, created_at, updated_at INTO verse_id, p_reference, p_text, p_translation;
  
  -- Return new verse
  SELECT json_build_object(
    'id', id,
    'reference', reference,
    'text', text,
    'translation', translation,
    'created_at', created_at,
    'updated_at', updated_at,
    'existed', false
  ) INTO result
  FROM verses
  WHERE id = verse_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure function to create aliases (only callable from edge functions)
CREATE OR REPLACE FUNCTION rpc_create_alias(
  p_alias TEXT,
  p_verse_id UUID
) RETURNS JSON AS $$
DECLARE
  alias_id UUID;
  result JSON;
BEGIN
  -- Validate inputs
  IF p_alias IS NULL OR p_verse_id IS NULL OR p_alias = '' THEN
    RETURN json_build_object('error', 'Alias and verse_id are required');
  END IF;
  
  -- Check if alias already exists
  SELECT id INTO alias_id 
  FROM aliases 
  WHERE alias = p_alias;
  
  IF alias_id IS NOT NULL THEN
    -- Return existing alias
    SELECT json_build_object(
      'id', id,
      'alias', alias,
      'verse_id', verse_id,
      'created_at', created_at,
      'existed', true
    ) INTO result
    FROM aliases
    WHERE id = alias_id;
    
    RETURN result;
  END IF;
  
  -- Verify verse exists
  IF NOT EXISTS (SELECT 1 FROM verses WHERE id = p_verse_id) THEN
    RETURN json_build_object('error', 'Verse not found');
  END IF;
  
  -- Create new alias
  INSERT INTO aliases (alias, verse_id)
  VALUES (p_alias, p_verse_id)
  RETURNING id INTO alias_id;
  
  -- Return new alias
  SELECT json_build_object(
    'id', id,
    'alias', alias,
    'verse_id', verse_id,
    'created_at', created_at,
    'existed', false
  ) INTO result
  FROM aliases
  WHERE id = alias_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service_role only (edge functions)
GRANT EXECUTE ON FUNCTION rpc_create_verse TO service_role;
GRANT EXECUTE ON FUNCTION rpc_create_alias TO service_role;

-- Grant execute permission for rpc_verse_lookup to authenticated users (they can call this)
GRANT EXECUTE ON FUNCTION rpc_verse_lookup TO authenticated;
