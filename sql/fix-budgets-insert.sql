-- ============================================
-- FIX: Ensure budgets INSERT policy works for creating shared budgets
-- ============================================

-- Check current INSERT policy
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'budgets'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Remove existing INSERT policy
DROP POLICY IF EXISTS "Users can create budgets" ON budgets;

-- Create INSERT policy that allows authenticated users to create budgets they own
CREATE POLICY "Users can create budgets"
  ON budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
  );

-- Also ensure SELECT policy allows users to see budgets they just created
-- (Important for INSERT ... SELECT pattern used by PostgREST)
-- This should already be handled by the is_budget_owner check, but let's verify
DROP POLICY IF EXISTS "Users can view budgets they own or are members of" ON budgets;
CREATE POLICY "Users can view budgets they own or are members of"
  ON budgets
  FOR SELECT
  TO authenticated
  USING (
    -- User owns the budget (no recursion - direct check)
    owner_id = auth.uid()
    OR
    -- User is a member (uses helper to avoid recursion)
    public.is_budget_member(id, auth.uid())
  );

-- Verify grants are in place
GRANT SELECT, INSERT, UPDATE, DELETE ON budgets TO authenticated;

-- Grant execute on helper functions (if not already done)
GRANT EXECUTE ON FUNCTION public.is_budget_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_budget_member(uuid, uuid) TO authenticated;

