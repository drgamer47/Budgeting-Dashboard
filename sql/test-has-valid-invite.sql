-- ============================================
-- TEST: Check if has_valid_invite function works
-- Run this to see if the function can find valid invites
-- ============================================

-- Test the function with your budget_id
SELECT 
  'efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid as budget_id,
  public.has_valid_invite('efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid) as function_result,
  'Should be TRUE if function works' as expected;

-- Also check manually what the function should see
SELECT 
  COUNT(*) as valid_invites_found,
  'This is what has_valid_invite should return TRUE for' as note
FROM budget_invites bi
WHERE bi.budget_id = 'efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid
  AND bi.used_at IS NULL
  AND bi.expires_at > now();


