-- ============================================
-- Check current DELETE policy on budget_members
-- ============================================

SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'budget_members'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- Also check if the helper function exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'is_budget_owner'
  AND pronamespace = 'public'::regnamespace;

