-- Fix budgets table - ensure type column exists
-- Run this in Supabase SQL Editor

-- First, ensure the enum type exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_type') THEN
    CREATE TYPE budget_type AS ENUM ('personal', 'shared');
    RAISE NOTICE 'Created budget_type enum';
  ELSE
    RAISE NOTICE 'budget_type enum already exists';
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
    AND table_name = 'budgets' 
    AND column_name = 'type'
  ) THEN
    -- Add the type column if it doesn't exist
    -- First add as nullable, then set default for existing rows, then make NOT NULL
    ALTER TABLE public.budgets 
    ADD COLUMN type budget_type;
    
    -- Set default value for existing rows
    UPDATE public.budgets SET type = 'personal' WHERE type IS NULL;
    
    -- Now make it NOT NULL with default
    ALTER TABLE public.budgets 
    ALTER COLUMN type SET DEFAULT 'personal',
    ALTER COLUMN type SET NOT NULL;
    
    RAISE NOTICE 'Added type column to budgets table';
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
  AND table_name = 'budgets'
ORDER BY ordinal_position;

-- Refresh Supabase schema cache (this happens automatically, but we can verify)
-- The schema cache should refresh within a few seconds

