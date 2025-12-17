-- ============================================
-- VERIFY: Check if everything is already set up correctly
-- Run this to see what's already in place
-- ============================================

-- 1. Check if helper functions exist
SELECT 
  'Helper Functions' as check_type,
  COUNT(*) as count,
  string_agg(proname, ', ') as functions
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('is_budget_owner', 'is_budget_member', 'has_valid_invite');

-- 2. Check if RLS is enabled on all tables
SELECT 
  'RLS Status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'budgets', 'budget_members', 'budget_invites', 
                    'categories', 'transactions', 'savings_goals', 'financial_goals', 
                    'debts', 'recurring_transactions')
ORDER BY tablename;

-- 3. Check key policies exist
SELECT 
  'Policies' as check_type,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('budgets', 'budget_members', 'budget_invites')
  AND policyname IN (
    'Users can create budgets',
    'Users can view budgets they own or are members of',
    'Users can join budget with valid invite',
    'Budget owners can add members',
    'Budget owners can remove members',
    'Users can use valid invite codes'
  )
ORDER BY tablename, cmd;

-- 4. Check if grants are in place
SELECT 
  'Grants' as check_type,
  grantee,
  table_name,
  string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'authenticated'
  AND table_name IN ('budgets', 'budget_members', 'budget_invites')
GROUP BY grantee, table_name;

-- 5. Quick test: Can you see your own budgets?
-- (Run this as an authenticated user)
-- SELECT COUNT(*) as my_budgets FROM budgets WHERE owner_id = auth.uid();

