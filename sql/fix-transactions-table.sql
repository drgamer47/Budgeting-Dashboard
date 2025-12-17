-- Fix transactions table - ensure type column exists
-- Run this in Supabase SQL Editor

-- First, ensure the enum type exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense');
    RAISE NOTICE 'Created transaction_type enum';
  ELSE
    RAISE NOTICE 'transaction_type enum already exists';
  END IF;
END $$;

-- Check if type column exists and add it if needed
DO $$
BEGIN
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions' 
    AND column_name = 'type'
  ) THEN
    -- Add the type column if it doesn't exist
    -- First add as nullable, then set default for existing rows, then make NOT NULL
    ALTER TABLE public.transactions 
    ADD COLUMN type transaction_type;
    
    -- Set default value for existing rows (default to 'expense' if we can't determine)
    UPDATE public.transactions SET type = 'expense' WHERE type IS NULL;
    
    -- Now make it NOT NULL with default
    ALTER TABLE public.transactions 
    ALTER COLUMN type SET DEFAULT 'expense',
    ALTER COLUMN type SET NOT NULL;
    
    RAISE NOTICE 'Added type column to transactions table';
  ELSE
    RAISE NOTICE 'Type column already exists';
  END IF;
END $$;

-- Verify the table structure
SELECT 
  column_name,
  data_type,
  udt_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
ORDER BY ordinal_position;

