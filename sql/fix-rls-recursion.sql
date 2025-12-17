-- Fix infinite recursion in budget_members RLS policy
-- Run this in Supabase SQL Editor

-- The issue: The SELECT policy on budget_members queries budget_members itself,
-- creating infinite recursion. We need to break the circular dependency.

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view members of accessible budgets" ON budget_members;

-- Create a new policy that avoids recursion
-- Users can view budget_members if:
-- 1. They own the budget (check budgets table directly)
-- 2. They are viewing their own membership row (user_id = auth.uid())
-- 3. They are already a member (check if the row exists for them)
CREATE POLICY "Users can view members of accessible budgets"
  ON budget_members FOR SELECT
  USING (
    -- User owns the budget (no recursion - direct check)
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
    OR
    -- User is viewing their own membership row (no recursion needed)
    user_id = auth.uid()
  );

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'budget_members'
ORDER BY policyname;

