-- ============================================
-- DEBUG: Check why invite join is failing
-- Run this to see what's happening
-- ============================================

-- 1. Check if helper functions exist and work
SELECT 
  'is_budget_owner function exists' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_budget_owner'
  ) as result;

SELECT 
  'is_budget_member function exists' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_budget_member'
  ) as result;

SELECT 
  'has_valid_invite function exists' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'has_valid_invite'
  ) as result;

-- 2. Check current policies on budget_members
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
ORDER BY policyname;

-- 3. Test the has_valid_invite function manually (replace with actual budget_id)
-- SELECT public.has_valid_invite('efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid);

-- 4. Check if there are any valid invites for that budget
SELECT 
  bi.id,
  bi.budget_id,
  bi.invite_code,
  bi.used_at,
  bi.expires_at,
  bi.expires_at > now() as is_not_expired,
  bi.used_at IS NULL as is_not_used,
  (bi.used_at IS NULL AND bi.expires_at > now()) as is_valid
FROM budget_invites bi
WHERE bi.budget_id = 'efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid;


