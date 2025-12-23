-- ============================================
-- Add order column to categories table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'categories'
      AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.categories
      ADD COLUMN display_order INTEGER DEFAULT 0;
    
    -- Set initial order based on created_at for existing categories
    -- This ensures existing categories have a valid order
    -- Use COALESCE to handle NULL display_order values
    WITH ordered_categories AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY budget_id ORDER BY COALESCE(display_order, 0), created_at, name) as new_order
      FROM public.categories
    )
    UPDATE public.categories c
    SET display_order = oc.new_order
    FROM ordered_categories oc
    WHERE c.id = oc.id
      AND (c.display_order IS NULL OR c.display_order = 0);
    
    -- Create index for better performance when ordering
    CREATE INDEX IF NOT EXISTS idx_categories_order ON public.categories(budget_id, display_order);
  END IF;
END $$;

