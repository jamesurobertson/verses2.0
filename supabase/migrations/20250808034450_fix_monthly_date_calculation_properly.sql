-- Fix monthly date calculation using MAKE_DATE for precise control
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
    -- Find next occurrence of assigned day of month using MAKE_DATE for precision
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