-- ============================================
-- TEST FIX: Temporarily allow self-inserts to test
-- This will help us determine if the issue is with has_valid_invite or something else
-- ============================================

-- First, let's make a very simple policy that just allows users to add themselves
-- This will help us test if the basic insert mechanism works

DROP POLICY IF EXISTS "Users can join budget with valid invite" ON budget_members;

-- TEMPORARY TEST POLICY: Allow any authenticated user to add themselves
-- This is NOT secure for production, but will help us debug
CREATE POLICY "Users can join budget with valid invite"
  ON budget_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- After testing:
-- 1. If this works, the issue is with the has_valid_invite function
-- 2. If this still fails, there's a different RLS issue


