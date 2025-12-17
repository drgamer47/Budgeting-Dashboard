-- ============================================
-- COMPREHENSIVE DIAGNOSTIC: Why is RLS still blocking?
-- ============================================

-- 1. Check if RLS is enabled on budget_members
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'budget_members';

-- 2. List ALL policies on budget_members (including any we might have missed)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'budget_members'
ORDER BY cmd, policyname;

-- 3. Check table constraints (UNIQUE constraint might be causing issues)
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.budget_members'::regclass;

-- 4. Check if there are any triggers that might interfere
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'budget_members'
  AND event_object_schema = 'public';

-- 5. Verify grants are in place
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'budget_members'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY grantee, privilege_type;


