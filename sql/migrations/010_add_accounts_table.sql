-- Migration: Add Accounts Table and Update Transactions
-- Description: Adds accounts table for tracking bank accounts, credit cards, etc., and adds account_id to transactions
-- Date: 2025-12-25

-- Create account_type enum
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit_card', 'investment');

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  credit_limit DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_credit_limit CHECK (credit_limit IS NULL OR credit_limit >= 0),
  CONSTRAINT valid_credit_limit CHECK (
    (type = 'credit_card' AND credit_limit IS NOT NULL) OR
    (type != 'credit_card' AND credit_limit IS NULL)
  )
);

-- Add indexes
CREATE INDEX idx_accounts_budget_id ON accounts(budget_id);
CREATE INDEX idx_accounts_type ON accounts(type);

-- Add account_id column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

-- Update trigger for accounts
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at_trigger
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_accounts_updated_at();

-- RLS Policies for accounts table
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view accounts in budgets they own or are members of
CREATE POLICY accounts_select_policy ON accounts
  FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM budgets WHERE owner_id = auth.uid()
      UNION
      SELECT budget_id FROM budget_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert accounts in budgets they own or are members of
CREATE POLICY accounts_insert_policy ON accounts
  FOR INSERT
  WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets WHERE owner_id = auth.uid()
      UNION
      SELECT budget_id FROM budget_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update accounts in budgets they own or are members of
CREATE POLICY accounts_update_policy ON accounts
  FOR UPDATE
  USING (
    budget_id IN (
      SELECT id FROM budgets WHERE owner_id = auth.uid()
      UNION
      SELECT budget_id FROM budget_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets WHERE owner_id = auth.uid()
      UNION
      SELECT budget_id FROM budget_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete accounts in budgets they own or are members of
CREATE POLICY accounts_delete_policy ON accounts
  FOR DELETE
  USING (
    budget_id IN (
      SELECT id FROM budgets WHERE owner_id = auth.uid()
      UNION
      SELECT budget_id FROM budget_members WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;

-- Add comments
COMMENT ON TABLE accounts IS 'Tracks bank accounts, credit cards, and investment accounts for budgets';
COMMENT ON COLUMN accounts.type IS 'Account type: checking, savings, credit_card, or investment';
COMMENT ON COLUMN accounts.current_balance IS 'Current balance of the account. For credit cards, this is the amount owed.';
COMMENT ON COLUMN accounts.credit_limit IS 'Credit limit for credit card accounts only';
