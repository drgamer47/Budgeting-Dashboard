-- Refresh budgets RLS policies to allow authenticated users to create their own budgets
-- and to ensure owner-based updates/deletes work without recursion issues.

-- INSERT: any authenticated user can create a budget they own
DROP POLICY IF EXISTS "Users can create budgets" ON budgets;
CREATE POLICY "Users can create budgets"
  ON budgets FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
  );

-- SELECT: users can view budgets they own or are members of
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

-- UPDATE: only owners
DROP POLICY IF EXISTS "Users can update budgets they own" ON budgets;
CREATE POLICY "Users can update budgets they own"
  ON budgets FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- DELETE: only owners
DROP POLICY IF EXISTS "Users can delete budgets they own" ON budgets;
CREATE POLICY "Users can delete budgets they own"
  ON budgets FOR DELETE
  USING (owner_id = auth.uid());

