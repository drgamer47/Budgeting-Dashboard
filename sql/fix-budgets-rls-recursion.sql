-- ============================================
-- FIX: Infinite recursion in budgets RLS policy
-- The budgets SELECT policy checks budget_members,
-- and budget_members SELECT policy checks budgets = circular dependency
-- ============================================

-- Use the helper function we created earlier (or create it if missing)
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

DROP FUNCTION IF EXISTS public.is_budget_member(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_budget_member(budget_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_budget_owner(budget_uuid, user_uuid)
  OR EXISTS (
    SELECT 1 FROM budget_members bm WHERE bm.budget_id = budget_uuid AND bm.user_id = user_uuid
  );
$$;

-- Fix budgets SELECT policy to use helper function (avoids recursion)
DROP POLICY IF EXISTS "Users can view budgets they own or are members of" ON budgets;
CREATE POLICY "Users can view budgets they own or are members of"
  ON budgets
  FOR SELECT
  TO authenticated
  USING (
    public.is_budget_owner(id, auth.uid())
    OR public.is_budget_member(id, auth.uid())
  );

-- Also fix budget_members SELECT policy to use helper (if not already done)
DROP POLICY IF EXISTS "Users can view members of accessible budgets" ON budget_members;
CREATE POLICY "Users can view members of accessible budgets"
  ON budget_members
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own membership rows (important for INSERT ... SELECT)
    user_id = auth.uid()
    OR
    -- User can see members of budgets they own or are members of
    public.is_budget_member(budget_id, auth.uid())
  );

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_budget_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_budget_member(uuid, uuid) TO authenticated;
