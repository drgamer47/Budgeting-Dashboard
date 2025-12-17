-- ============================================
-- Check if user is already a member of the budget
-- ============================================

SELECT 
  bm.*,
  b.name as budget_name,
  p.display_name as user_name
FROM budget_members bm
JOIN budgets b ON b.id = bm.budget_id
LEFT JOIN profiles p ON p.id = bm.user_id
WHERE bm.budget_id = 'efa3e71d-4d71-4a28-bb0a-ea570a895b90'::uuid
  AND bm.user_id = '0cb525b8-9544-49d2-9235-bffb0c85ec41'::uuid;

