-- Verify trigger and function setup
-- Run this in Supabase SQL Editor

-- 1. Check if function exists and see its definition
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'handle_new_user';

-- 2. Check function permissions
SELECT 
  p.proname as function_name,
  r.rolname as role_name,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' 
  AND p.proname = 'handle_new_user'
  AND r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role');

-- 3. Check trigger details
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 4. Test the function manually (this will help identify the issue)
-- First, let's see if we can call it (this won't actually create a user, just test syntax)
DO $$
BEGIN
  RAISE NOTICE 'Function handle_new_user exists and is callable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
END $$;

