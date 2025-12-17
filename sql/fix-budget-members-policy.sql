-- Allow joining a budget via a valid invite (non-owners)
-- Keeps owner-only policy intact for other inserts.

-- Existing owner policy (keep as-is):
-- "Budget owners can add members" ON budget_members FOR INSERT WITH CHECK (budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid()))

-- New policy to allow self-join if a valid invite exists for that budget
DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND budget_id IN (
      SELECT budget_id
      FROM budget_invites
      WHERE used_at IS NULL
        AND expires_at > NOW()
    )
  );

