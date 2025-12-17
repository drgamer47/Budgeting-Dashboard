-- Fix budget_members RLS recursion and allow invite-based joins

-- Helper: is owner
DROP FUNCTION IF EXISTS public.is_budget_owner(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_budget_owner(budget_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM budgets b WHERE b.id = budget_uuid AND b.owner_id = user_uuid
  );
$$;

-- Helper: is member (includes owner)
DROP FUNCTION IF EXISTS public.is_budget_member(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_budget_member(budget_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT public.is_budget_owner(budget_uuid, user_uuid)
  OR EXISTS (
    SELECT 1 FROM budget_members bm WHERE bm.budget_id = budget_uuid AND bm.user_id = user_uuid
  );
$$;

-- Helper: has valid invite (unused, unexpired) for that budget
-- This function bypasses RLS (SECURITY DEFINER) to check for valid invites
DROP FUNCTION IF EXISTS public.has_valid_invite(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.has_valid_invite(budget_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Bypass RLS to check if any valid invite exists for this budget
  RETURN EXISTS (
    SELECT 1 FROM budget_invites bi
    WHERE bi.budget_id = budget_uuid
      AND bi.used_at IS NULL
      AND bi.expires_at > now()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, return false (fail closed)
    RETURN FALSE;
END;
$$;

-- Policies for budget_members (non-recursive)
DROP POLICY IF EXISTS "Users can view members of accessible budgets" ON budget_members;
CREATE POLICY "Users can view members of accessible budgets"
  ON budget_members FOR SELECT
  USING (public.is_budget_member(budget_id, auth.uid()));

DROP POLICY IF EXISTS "Budget owners can add members" ON budget_members;
CREATE POLICY "Budget owners can add members"
  ON budget_members FOR INSERT
  WITH CHECK (
    public.is_budget_owner(budget_id, auth.uid())
  );

-- Policy: Users can join if they're inserting themselves AND there's a valid invite
DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    -- Must be inserting themselves
    user_id = auth.uid()
    -- AND there must be at least one valid invite for this budget
    AND public.has_valid_invite(budget_id)
  );

DROP POLICY IF EXISTS "Budget owners can update member roles" ON budget_members;
CREATE POLICY "Budget owners can update member roles"
  ON budget_members FOR UPDATE
  USING (public.is_budget_owner(budget_id, auth.uid()))
  WITH CHECK (public.is_budget_owner(budget_id, auth.uid()));

DROP POLICY IF EXISTS "Budget owners can remove members" ON budget_members;
CREATE POLICY "Budget owners can remove members"
  ON budget_members FOR DELETE
  USING (public.is_budget_owner(budget_id, auth.uid()));

