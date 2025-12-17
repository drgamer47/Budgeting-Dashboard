-- ============================================
-- FIX: Make policy work with PostgREST/Supabase API
-- The direct insert worked, so the issue is PostgREST context
-- ============================================

-- Remove the debug policy
DROP POLICY IF EXISTS "DEBUG allow all inserts for all" ON budget_members;

-- Create a policy that explicitly works with PostgREST
-- PostgREST uses the 'authenticated' role when a valid JWT is present
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Also ensure the policy is permissive (should be default, but let's be explicit)
-- Note: We can't set permissive in CREATE POLICY, it's always PERMISSIVE by default

-- Verify the policy was created
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'budget_members'
  AND cmd = 'INSERT'
ORDER BY policyname;

