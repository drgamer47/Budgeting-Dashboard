-- Allow non-members to validate invites by code (still respecting expiry/unused)
-- This complements the existing owner/member policy.

DROP POLICY IF EXISTS "Anyone with valid invite code can view" ON budget_invites;
CREATE POLICY "Anyone with valid invite code can view"
  ON budget_invites FOR SELECT
  USING (
    invite_code IS NOT NULL
    AND used_at IS NULL
    AND expires_at > now()
  );

-- Ensure update policy allows marking as used when valid
DROP POLICY IF EXISTS "Users can use valid invite codes" ON budget_invites;
CREATE POLICY "Users can use valid invite codes"
  ON budget_invites FOR UPDATE
  USING (
    invite_code IS NOT NULL
    AND expires_at > NOW()
    AND used_at IS NULL
  )
  WITH CHECK (
    invite_code IS NOT NULL
    AND expires_at > NOW()
    AND used_at IS NULL
  );

