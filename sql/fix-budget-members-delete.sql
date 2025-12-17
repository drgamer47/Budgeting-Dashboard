-- ============================================
-- FIX: Ensure DELETE policy works correctly
-- ============================================

-- Ensure helper function exists
DROP FUNCTION IF EXISTS public.is_budget_owner(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_budget_owner(budget_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM budgets b WHERE b.id = budget_uuid AND b.owner_id = user_uuid
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_budget_owner(uuid, uuid) TO authenticated;

-- Remove old DELETE policy
DROP POLICY IF EXISTS "Budget owners can remove members" ON budget_members;

-- Create DELETE policy that allows owners to remove members
CREATE POLICY "Budget owners can remove members"
  ON budget_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_budget_owner(budget_id, auth.uid())
  );

-- Verify the policy was created
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'budget_members'
  AND cmd = 'DELETE';

