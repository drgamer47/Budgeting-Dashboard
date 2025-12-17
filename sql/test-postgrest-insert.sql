-- ============================================
-- TEST: Remove invite check to see if basic insert works via PostgREST
-- ============================================

-- Remove all INSERT policies
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

-- Create the SIMPLEST possible policy - just allow users to add themselves
-- NO invite check, NO owner check - just the bare minimum
CREATE POLICY "TEST simple self-insert"
  ON budget_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Verify
SELECT 
  policyname,
  roles,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'budget_members'
  AND cmd = 'INSERT';

