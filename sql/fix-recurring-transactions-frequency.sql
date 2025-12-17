-- Add frequency column to recurring_transactions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recurring_transactions'
      AND column_name = 'frequency'
  ) THEN
    -- Ensure enum exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'frequency_type'
    ) THEN
      CREATE TYPE public.frequency_type AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
    END IF;

    ALTER TABLE public.recurring_transactions
      ADD COLUMN frequency public.frequency_type NOT NULL DEFAULT 'monthly';
  END IF;
END $$;

-- Add next_date column if missing (for completeness)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recurring_transactions'
      AND column_name = 'next_date'
  ) THEN
    ALTER TABLE public.recurring_transactions
      ADD COLUMN next_date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Add type column if missing (uses transaction_type enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'recurring_transactions'
      AND column_name = 'type'
  ) THEN
    -- Ensure transaction_type enum exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'transaction_type'
    ) THEN
      CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
    END IF;

    ALTER TABLE public.recurring_transactions
      ADD COLUMN type public.transaction_type NOT NULL DEFAULT 'expense';
  END IF;
END $$;

