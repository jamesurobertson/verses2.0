-- Diagnostic queries to understand the exact issue
-- Run these one by one in Supabase SQL Editor

-- 1. Check if user_profiles table exists and its structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND table_schema = 'public';

-- 2. Check if the trigger function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'handle_new_user';

-- 3. Check if the trigger exists
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 4. Check RLS policies on user_profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 5. Try to manually test the trigger function
-- (This will help us see the exact error)
SELECT public.handle_new_user();