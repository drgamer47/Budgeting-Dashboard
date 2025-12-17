-- ============================================
-- CHECK INVITE CODES: See all invites and their status
-- Run this in Supabase SQL Editor
-- ============================================

-- View all invites with their status
SELECT 
  bi.id,
  bi.budget_id,
  b.name as budget_name,
  bi.invite_code,
  bi.created_by,
  p.display_name as created_by_name,
  bi.created_at,
  bi.expires_at,
  bi.used_at,
  bi.used_by,
  -- Status checks
  CASE 
    WHEN bi.used_at IS NOT NULL THEN 'USED'
    WHEN bi.expires_at <= now() THEN 'EXPIRED'
    WHEN bi.expires_at > now() AND bi.used_at IS NULL THEN 'VALID'
    ELSE 'UNKNOWN'
  END as status,
  -- Detailed validity
  (bi.used_at IS NULL) as is_not_used,
  (bi.expires_at > now()) as is_not_expired,
  (bi.used_at IS NULL AND bi.expires_at > now()) as is_valid,
  -- Time until expiry
  CASE 
    WHEN bi.expires_at > now() THEN 
      EXTRACT(EPOCH FROM (bi.expires_at - now())) / 3600 || ' hours remaining'
    ELSE 'Expired'
  END as time_remaining
FROM budget_invites bi
LEFT JOIN budgets b ON b.id = bi.budget_id
LEFT JOIN profiles p ON p.id = bi.created_by
ORDER BY bi.created_at DESC;

-- Check invites for a specific budget (replace with your budget_id)
-- SELECT 
--   bi.invite_code,
--   bi.expires_at,
--   bi.used_at,
--   CASE 
--     WHEN bi.used_at IS NOT NULL THEN 'USED'
--     WHEN bi.expires_at <= now() THEN 'EXPIRED'
--     ELSE 'VALID'
--   END as status
-- FROM budget_invites bi
-- WHERE bi.budget_id = 'efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid
-- ORDER BY bi.created_at DESC;

-- Count valid invites per budget
SELECT 
  b.id as budget_id,
  b.name as budget_name,
  COUNT(*) FILTER (WHERE bi.used_at IS NULL AND bi.expires_at > now()) as valid_invites,
  COUNT(*) FILTER (WHERE bi.used_at IS NOT NULL) as used_invites,
  COUNT(*) FILTER (WHERE bi.expires_at <= now() AND bi.used_at IS NULL) as expired_invites,
  COUNT(*) as total_invites
FROM budgets b
LEFT JOIN budget_invites bi ON bi.budget_id = b.id
GROUP BY b.id, b.name
ORDER BY b.name;


