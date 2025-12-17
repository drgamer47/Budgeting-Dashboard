-- ============================================
-- FIX: Allow users to mark invites as used
-- This is needed for the useInvite function
-- ============================================

-- Check current UPDATE policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'budget_invites'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Remove existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Users can use valid invite codes" ON budget_invites;

-- Create a policy that allows any authenticated user to mark a valid invite as used
CREATE POLICY "Users can use valid invite codes"
  ON budget_invites
  FOR UPDATE
  TO authenticated
  USING (
    -- Can only update valid invites (not expired, not already used)
    invite_code IS NOT NULL
    AND expires_at > now()
    AND used_at IS NULL
  )
  WITH CHECK (
    -- After update, must still be a valid invite (or now marked as used)
    invite_code IS NOT NULL
    AND expires_at > now()
    -- Allow setting used_at and used_by
    AND (used_at IS NULL OR used_at IS NOT NULL)
  );

-- Also ensure grants are in place
GRANT SELECT, INSERT, UPDATE ON budget_invites TO authenticated;

