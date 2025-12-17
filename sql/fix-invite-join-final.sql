-- ============================================
-- FINAL FIX: Make has_valid_invite more robust
-- This ensures the function works even if there are RLS issues
-- ============================================

-- Recreate the has_valid_invite function with better error handling
-- and ensure it truly bypasses RLS
DROP FUNCTION IF EXISTS public.has_valid_invite(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.has_valid_invite(budget_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  invite_count INTEGER;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS completely
  -- Count valid invites directly from the table
  SELECT COUNT(*) INTO invite_count
  FROM budget_invites
  WHERE budget_id = budget_uuid
    AND used_at IS NULL
    AND expires_at > now();
  
  -- Return true if at least one valid invite exists
  RETURN invite_count > 0;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but return false (fail closed)
    RAISE WARNING 'Error in has_valid_invite for budget %: %', budget_uuid, SQLERRM;
    RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_valid_invite(uuid) TO authenticated;

-- Now update the policy to use the function
DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_valid_invite(budget_id) = TRUE
  );

-- Also add a comment to help debug
COMMENT ON FUNCTION public.has_valid_invite(uuid) IS 
  'Checks if there is at least one valid (unused, unexpired) invite for a budget. Returns TRUE if valid invite exists, FALSE otherwise.';


