-- ============================================
-- VERIFY USER SIGNUP - Database Verification
-- Run this in Supabase SQL Editor after signing up a new user
-- ============================================

-- Replace 'test@testmail.com' with the email you used to sign up
\set test_email 'test@testmail.com'

-- 1. Check if user exists in auth.users
SELECT 
  'auth.users' as table_name,
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmed'
    ELSE '⚠️ Email not confirmed'
  END as confirmation_status
FROM auth.users 
WHERE email = :'test_email';

-- 2. Check if profile was auto-created
SELECT 
  'profiles' as table_name,
  id,
  username,
  display_name,
  currency_symbol,
  date_format,
  theme_preference,
  created_at,
  updated_at,
  CASE 
    WHEN id IN (SELECT id FROM auth.users WHERE email = :'test_email') 
    THEN '✅ Profile exists and matches user ID'
    ELSE '❌ Profile ID mismatch'
  END as verification_status
FROM public.profiles 
WHERE id IN (
  SELECT id FROM auth.users WHERE email = :'test_email'
);

-- 3. Check if personal budget was auto-created
SELECT 
  'budgets' as table_name,
  id,
  name,
  type,
  owner_id,
  created_at,
  CASE 
    WHEN owner_id IN (SELECT id FROM auth.users WHERE email = :'test_email')
      AND type = 'personal'
    THEN '✅ Personal budget auto-created'
    ELSE '⚠️ Budget not found or incorrect type'
  END as verification_status
FROM public.budgets 
WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = :'test_email'
)
AND type = 'personal';

-- 4. Summary check - All together
SELECT 
  (SELECT COUNT(*) FROM auth.users WHERE email = :'test_email') as user_exists,
  (SELECT COUNT(*) FROM public.profiles p 
   JOIN auth.users u ON p.id = u.id 
   WHERE u.email = :'test_email') as profile_exists,
  (SELECT COUNT(*) FROM public.budgets b
   JOIN auth.users u ON b.owner_id = u.id
   WHERE u.email = :'test_email' AND b.type = 'personal') as budget_exists,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE email = :'test_email') > 0
      AND (SELECT COUNT(*) FROM public.profiles p 
           JOIN auth.users u ON p.id = u.id 
           WHERE u.email = :'test_email') > 0
      AND (SELECT COUNT(*) FROM public.budgets b
           JOIN auth.users u ON b.owner_id = u.id
           WHERE u.email = :'test_email' AND b.type = 'personal') > 0
    THEN '✅ All checks passed - User, profile, and budget created successfully'
    ELSE '❌ Some checks failed - Review individual queries above'
  END as overall_status;

