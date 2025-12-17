-- ============================================
-- FIX: The issue might be the SELECT policy blocking the return
-- PostgREST does INSERT then SELECT when ?select=* is used
-- ============================================

-- First, let's see what SELECT policies exist
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'budget_members'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- The SELECT policy might be blocking because the user isn't a member yet
-- (chicken-and-egg: can't SELECT because not a member, but can't INSERT because SELECT fails)

-- Let's create a SELECT policy that allows users to see rows they just inserted
-- OR rows where they're the user_id
DROP POLICY IF EXISTS "Users can view members of accessible budgets" ON budget_members;

CREATE POLICY "Users can view members of accessible budgets"
  ON budget_members
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own membership rows
    user_id = auth.uid()
    OR
    -- User can see members of budgets they own
    EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.id = budget_members.budget_id
      AND b.owner_id = auth.uid()
    )
    OR
    -- User can see members of budgets they're a member of
    EXISTS (
      SELECT 1 FROM budget_members bm2
      WHERE bm2.budget_id = budget_members.budget_id
      AND bm2.user_id = auth.uid()
    )
  );

-- Now test the INSERT again with the simple policy
-- (Make sure test-postgrest-insert.sql was run first)

