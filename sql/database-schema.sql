-- ============================================
-- Budget Dashboard Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- Stores user profile information
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  currency_symbol TEXT DEFAULT '$',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  theme_preference TEXT DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BUDGETS TABLE
-- Stores personal and shared budgets
-- ============================================
-- Drop type if exists (for idempotency)
DROP TYPE IF EXISTS budget_type CASCADE;
CREATE TYPE budget_type AS ENUM ('personal', 'shared');

CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type budget_type NOT NULL DEFAULT 'personal',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BUDGET MEMBERS TABLE
-- Manages shared budget memberships
-- ============================================
-- Ensure member_role enum exists (safe for existing DBs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'member_role'
  ) THEN
    CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS budget_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(budget_id, user_id)
);

-- If budget_members already existed without the role column, add it (safe/idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'budget_members'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.budget_members
      ADD COLUMN role public.member_role NOT NULL DEFAULT 'member';
  END IF;
END $$;

-- ============================================
-- BUDGET INVITES TABLE
-- Stores invitation codes for shared budgets
-- ============================================
CREATE TABLE IF NOT EXISTS budget_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CATEGORIES TABLE
-- Budget-specific categories
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#94a3b8',
  monthly_budget DECIMAL(10, 2) DEFAULT 0,
  -- Category applies to income or expense transactions
  tx_type TEXT NOT NULL DEFAULT 'expense' CHECK (tx_type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(budget_id, name)
);

-- ============================================
-- TRANSACTIONS TABLE
-- All financial transactions
-- ============================================
-- Drop type if exists (for idempotency)
DROP TYPE IF EXISTS transaction_type CASCADE;
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  type transaction_type NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  merchant TEXT,
  notes TEXT,
  plaid_id TEXT,
  account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SAVINGS GOALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target DECIMAL(10, 2) NOT NULL,
  current DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- FINANCIAL GOALS TABLE
-- ============================================
-- Drop type if exists (for idempotency)
DROP TYPE IF EXISTS financial_goal_type CASCADE;
CREATE TYPE financial_goal_type AS ENUM ('savings', 'debt_payoff', 'investment', 'purchase', 'other');

CREATE TABLE IF NOT EXISTS financial_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type financial_goal_type NOT NULL DEFAULT 'savings',
  target DECIMAL(10, 2) NOT NULL,
  current DECIMAL(10, 2) DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DEBTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS debts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  current_balance DECIMAL(10, 2) NOT NULL,
  original_balance DECIMAL(10, 2),
  interest_rate DECIMAL(5, 2) DEFAULT 0,
  min_payment DECIMAL(10, 2) DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RECURRING TRANSACTIONS TABLE
-- ============================================
-- Drop type if exists (for idempotency)
DROP TYPE IF EXISTS frequency_type CASCADE;
CREATE TYPE frequency_type AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  type transaction_type NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  frequency frequency_type NOT NULL DEFAULT 'monthly',
  next_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_budgets_owner ON budgets(owner_id);
CREATE INDEX IF NOT EXISTS idx_budget_members_budget ON budget_members(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_members_user ON budget_members(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_budget ON transactions(budget_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_budget ON categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_invites_code ON budget_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_budget_invites_budget ON budget_invites(budget_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- BUDGETS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view budgets they own or are members of" ON budgets;
CREATE POLICY "Users can view budgets they own or are members of"
  ON budgets FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create budgets" ON budgets;
CREATE POLICY "Users can create budgets"
  ON budgets FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update budgets they own" ON budgets;
CREATE POLICY "Users can update budgets they own"
  ON budgets FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete budgets they own" ON budgets;
CREATE POLICY "Users can delete budgets they own"
  ON budgets FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================
-- BUDGET MEMBERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view members of accessible budgets" ON budget_members;
CREATE POLICY "Users can view members of accessible budgets"
  ON budget_members FOR SELECT
  USING (
    -- User owns the budget (no recursion - direct check)
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
    OR
    -- User is viewing their own membership row (no recursion needed)
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Budget owners can add members" ON budget_members;
CREATE POLICY "Budget owners can add members"
  ON budget_members FOR INSERT
  WITH CHECK (
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Budget owners can update member roles" ON budget_members;
CREATE POLICY "Budget owners can update member roles"
  ON budget_members FOR UPDATE
  USING (
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Budget owners can remove members" ON budget_members;
CREATE POLICY "Budget owners can remove members"
  ON budget_members FOR DELETE
  USING (
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
  );

-- Allow members to leave shared budgets by deleting their own membership row.
-- (Avoid recursion by not querying budget_members from inside this policy.)
DROP POLICY IF EXISTS "Users can leave budgets" ON budget_members;
CREATE POLICY "Users can leave budgets"
  ON budget_members FOR DELETE
  USING (
    user_id = auth.uid() AND
    -- Prevent owners from "leaving" (owners should delete the budget instead)
    budget_id IN (SELECT id FROM budgets WHERE owner_id <> auth.uid())
  );

-- ============================================
-- BUDGET INVITES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view invites for accessible budgets" ON budget_invites;
CREATE POLICY "Users can view invites for accessible budgets"
  ON budget_invites FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Budget owners can create invites" ON budget_invites;
CREATE POLICY "Budget owners can create invites"
  ON budget_invites FOR INSERT
  WITH CHECK (
    budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid()) AND
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can use valid invite codes" ON budget_invites;
CREATE POLICY "Users can use valid invite codes"
  ON budget_invites FOR UPDATE
  USING (
    invite_code IS NOT NULL AND
    expires_at > NOW() AND
    used_at IS NULL
  );

-- ============================================
-- CATEGORIES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view categories in accessible budgets" ON categories;
CREATE POLICY "Users can view categories in accessible budgets"
  ON categories FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage categories in accessible budgets" ON categories;
CREATE POLICY "Users can manage categories in accessible budgets"
  ON categories FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view transactions in accessible budgets" ON transactions;
CREATE POLICY "Users can view transactions in accessible budgets"
  ON transactions FOR SELECT
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create transactions in accessible budgets" ON transactions;
CREATE POLICY "Users can create transactions in accessible budgets"
  ON transactions FOR INSERT
  WITH CHECK (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    ) AND
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own transactions or in budgets they own" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in accessible budgets" ON transactions;
CREATE POLICY "Users can update transactions in accessible budgets"
  ON transactions FOR UPDATE
  USING (
    user_id = auth.uid()
    OR budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
    OR budget_id IN (
      SELECT budget_id FROM budget_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can delete their own transactions or in budgets they own" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in accessible budgets" ON transactions;
CREATE POLICY "Users can delete transactions in accessible budgets"
  ON transactions FOR DELETE
  USING (
    user_id = auth.uid()
    OR budget_id IN (SELECT id FROM budgets WHERE owner_id = auth.uid())
    OR budget_id IN (
      SELECT budget_id FROM budget_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- SAVINGS GOALS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can manage savings goals in accessible budgets" ON savings_goals;
CREATE POLICY "Users can manage savings goals in accessible budgets"
  ON savings_goals FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- FINANCIAL GOALS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can manage financial goals in accessible budgets" ON financial_goals;
CREATE POLICY "Users can manage financial goals in accessible budgets"
  ON financial_goals FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- DEBTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can manage debts in accessible budgets" ON debts;
CREATE POLICY "Users can manage debts in accessible budgets"
  ON debts FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- RECURRING TRANSACTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can manage recurring transactions in accessible budgets" ON recurring_transactions;
CREATE POLICY "Users can manage recurring transactions in accessible budgets"
  ON recurring_transactions FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM budgets 
      WHERE owner_id = auth.uid() OR 
      id IN (SELECT budget_id FROM budget_members WHERE user_id = auth.uid())
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  username_exists BOOLEAN;
  counter INTEGER := 0;
BEGIN
  -- Generate unique username
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;
  
  -- Check if username exists and append number if needed
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
    EXIT WHEN NOT username_exists;
    counter := counter + 1;
    final_username := base_username || counter::TEXT;
  END LOOP;
  
  -- Insert profile (ignore if already exists)
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create default personal budget (only if it doesn't exist)
  INSERT INTO public.budgets (name, type, owner_id)
  SELECT 'Personal Budget', 'personal', NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.budgets WHERE owner_id = NEW.id AND type = 'personal'
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_savings_goals_updated_at ON savings_goals;
CREATE TRIGGER update_savings_goals_updated_at BEFORE UPDATE ON savings_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_goals_updated_at ON financial_goals;
CREATE TRIGGER update_financial_goals_updated_at BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_transactions_updated_at ON recurring_transactions;
CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

