-- COMPLETE FIX for user creation trigger
-- Run this entire script in Supabase SQL Editor
-- This will fix all permission and function issues

-- Step 1: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT ALL ON public.budgets TO postgres, service_role;

-- Step 2: Drop and recreate the function with proper error handling
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  username_exists BOOLEAN;
  counter INTEGER := 0;
BEGIN
  -- Generate unique username from email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    split_part(NEW.email, '@', 1)
  );
  final_username := base_username;
  
  -- Ensure username is unique (max 100 iterations)
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) 
    INTO username_exists;
    EXIT WHEN NOT username_exists OR counter >= 100;
    counter := counter + 1;
    final_username := base_username || counter::TEXT;
  END LOOP;
  
  -- Insert profile with error handling
  BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
      NEW.id,
      final_username,
      COALESCE(
        NEW.raw_user_meta_data->>'display_name', 
        split_part(NEW.email, '@', 1)
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Profile already exists, skip
      NULL;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to insert profile for user %: %', NEW.id, SQLERRM;
  END;
  
  -- Create default personal budget with error handling
  BEGIN
    INSERT INTO public.budgets (name, type, owner_id)
    VALUES ('Personal Budget', 'personal', NEW.id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create budget for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail user creation - just log the warning
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 3: Grant execute permission to all necessary roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 4: Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Verify everything is set up correctly
SELECT 
  'Trigger Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_auth_user_created'
    ) THEN '✅ Trigger exists'
    ELSE '❌ Trigger missing'
  END as status;

SELECT 
  'Function Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
    ) THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status;

