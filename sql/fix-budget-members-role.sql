-- Ensure member_role enum exists
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

-- Add role column to budget_members if missing, default 'member'
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

