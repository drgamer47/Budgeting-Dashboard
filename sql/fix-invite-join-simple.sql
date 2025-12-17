-- ============================================
-- SIMPLER FIX: More permissive policy for testing
-- This allows users to join if they're adding themselves
-- Run this AFTER running fix-invite-join-complete.sql
-- ============================================

-- TEMPORARY: Very permissive policy to test if the issue is with has_valid_invite
-- Remove this after testing and use the proper policy below
DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    -- Allow if user is adding themselves
    -- (We'll add invite validation back once this works)
    user_id = auth.uid()
  );

-- If the above works, then the issue is with has_valid_invite function
-- Replace with this more robust version:

/*
DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Either there's a valid invite
      public.has_valid_invite(budget_id)
      -- OR the user is already a member (prevents duplicates)
      OR EXISTS (
        SELECT 1 FROM budget_members bm
        WHERE bm.budget_id = budget_members.budget_id
        AND bm.user_id = auth.uid()
      )
    )
  );
*/


