-- ============================================
-- CLEAN FIX: Remove ALL INSERT policies and create ONE clean policy
-- Since direct insert worked, this should work with PostgREST
-- ============================================

-- Step 1: Remove ALL existing INSERT policies (clean slate)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'budget_members'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.budget_members',
      r.policyname
    );
  END LOOP;
END;
$$;

-- Step 2: Ensure grants are in place
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_members TO anon;

-- Step 3: Create ONE clean policy for owners to add members
CREATE POLICY "Budget owners can add members"
  ON budget_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.id = budget_members.budget_id
      AND b.owner_id = auth.uid()
    )
  );

-- Step 4: Create ONE clean policy for users to join via invite
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM budget_invites bi
      WHERE bi.budget_id = budget_members.budget_id
      AND bi.used_at IS NULL
      AND bi.expires_at > now()
    )
  );

-- Step 5: Verify policies were created correctly
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

