-- ============================================
-- COMPLETE FIX: Budget Invite Join System
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Ensure member_role enum and role column exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'member_role'
  ) THEN
    CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_members'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.budget_members
      ADD COLUMN role public.member_role NOT NULL DEFAULT 'member';
  END IF;
END $$;

-- Step 2: Create helper functions (SECURITY DEFINER to bypass RLS)
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

-- Helper: Check if there's a valid invite for a budget
DROP FUNCTION IF EXISTS public.has_valid_invite(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.has_valid_invite(budget_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS, so this can read budget_invites directly
  RETURN EXISTS (
    SELECT 1 FROM budget_invites bi
    WHERE bi.budget_id = budget_uuid
      AND bi.used_at IS NULL
      AND bi.expires_at > now()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Fail closed if there's any error
    RETURN FALSE;
END;
$$;

-- Step 3: Fix budget_invites policies (allow reading valid invites)
DROP POLICY IF EXISTS "Anyone with valid invite code can view" ON budget_invites;
CREATE POLICY "Anyone with valid invite code can view"
  ON budget_invites FOR SELECT
  USING (
    invite_code IS NOT NULL
    AND used_at IS NULL
    AND expires_at > now()
  );

DROP POLICY IF EXISTS "Users can use valid invite codes" ON budget_invites;
CREATE POLICY "Users can use valid invite codes"
  ON budget_invites FOR UPDATE
  USING (
    invite_code IS NOT NULL
    AND expires_at > now()
    AND used_at IS NULL
  )
  WITH CHECK (
    invite_code IS NOT NULL
    AND expires_at > now()
    AND used_at IS NULL
  );

-- Allow budget owners to create invites
DROP POLICY IF EXISTS "Budget owners can create invites" ON budget_invites;
CREATE POLICY "Budget owners can create invites"
  ON budget_invites FOR INSERT
  WITH CHECK (
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
  );

-- Allow budget owners to view their invites
DROP POLICY IF EXISTS "Budget owners can view their invites" ON budget_invites;
CREATE POLICY "Budget owners can view their invites"
  ON budget_invites FOR SELECT
  USING (
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
  );

-- Step 4: Fix budget_members policies (non-recursive)
DROP POLICY IF EXISTS "Users can view members of accessible budgets" ON budget_members;
CREATE POLICY "Users can view members of accessible budgets"
  ON budget_members FOR SELECT
  USING (public.is_budget_member(budget_id, auth.uid()));

-- Policy: Owners can manually add members
DROP POLICY IF EXISTS "Budget owners can add members" ON budget_members;
CREATE POLICY "Budget owners can add members"
  ON budget_members FOR INSERT
  WITH CHECK (
    public.is_budget_owner(budget_id, auth.uid())
  );

-- Policy: Users can join via valid invite (KEY POLICY FOR YOUR USE CASE)
DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    -- Must be inserting themselves
    user_id = auth.uid()
    -- AND there must be at least one valid invite for this budget
    AND public.has_valid_invite(budget_id)
  );

-- Policy: Owners can update member roles
DROP POLICY IF EXISTS "Budget owners can update member roles" ON budget_members;
CREATE POLICY "Budget owners can update member roles"
  ON budget_members FOR UPDATE
  USING (public.is_budget_owner(budget_id, auth.uid()))
  WITH CHECK (public.is_budget_owner(budget_id, auth.uid()));

-- Policy: Owners can remove members
DROP POLICY IF EXISTS "Budget owners can remove members" ON budget_members;
CREATE POLICY "Budget owners can remove members"
  ON budget_members FOR DELETE
  USING (public.is_budget_owner(budget_id, auth.uid()));

-- Step 5: Ensure budgets policies are correct
DROP POLICY IF EXISTS "Users can create budgets" ON budgets;
CREATE POLICY "Users can create budgets"
  ON budgets FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can view budgets they own or are members of" ON budgets;
CREATE POLICY "Users can view budgets they own or are members of"
  ON budgets FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM budget_members bm
      WHERE bm.budget_id = budgets.id AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update budgets they own" ON budgets;
CREATE POLICY "Users can update budgets they own"
  ON budgets FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete budgets they own" ON budgets;
CREATE POLICY "Users can delete budgets they own"
  ON budgets FOR DELETE
  USING (owner_id = auth.uid());


