-- Fix for user creation trigger
-- Run this in Supabase SQL Editor

-- First, ensure the function has proper permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT ALL ON public.budgets TO postgres, service_role;

-- Drop and recreate the function with better error handling
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
  
  -- Ensure username is unique (check up to 100 times to avoid infinite loop)
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) 
    INTO username_exists;
    EXIT WHEN NOT username_exists OR counter >= 100;
    counter := counter + 1;
    final_username := base_username || counter::TEXT;
  END LOOP;
  
  -- Insert profile
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
      -- Profile already exists, that's okay
      NULL;
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to insert profile for user %: %', NEW.id, SQLERRM;
  END;
  
  -- Create default personal budget
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
    -- Don't fail user creation if trigger fails
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

