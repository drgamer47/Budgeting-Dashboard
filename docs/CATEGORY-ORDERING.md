# Category Ordering Feature

## Overview

The category ordering feature allows users to customize the display order of categories in their budget. Categories can be reordered using up/down buttons in the settings page.

## Database Changes

### Migration Required

Before using this feature, you need to run the migration script to add the `display_order` column to the categories table:

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Run the script: `sql/add-category-order.sql`

This will:
- Add a `display_order` column to the `categories` table
- Set initial order values for existing categories based on creation date
- Create an index for better query performance

### Schema Update

The `categories` table now includes:
- `display_order INTEGER DEFAULT 0` - Controls the display order of categories

## Features

### 1. Automatic Ordering
- New categories are automatically added at the end of the list
- Categories are sorted by `display_order` (ascending), then by name as a fallback
- The order is preserved across page reloads

### 2. Manual Reordering
- **Up Button (▲)**: Moves a category up in the list
- **Down Button (▼)**: Moves a category down in the list
- Buttons are disabled for the first/last category respectively
- Changes are saved immediately to the database

### 3. UI Integration
- Order controls appear in the categories list in Settings
- Categories in dropdown menus (filters, transaction forms) also respect the custom order
- The order is consistent across all views

## Usage

1. Navigate to **Settings** → **Categories**
2. Use the ▲ and ▼ buttons next to each category to reorder
3. The order is saved automatically
4. Categories will appear in this order throughout the application

## Technical Details

### Service Methods

- `categoryService.getCategories()` - Returns categories sorted by `display_order`
- `categoryService.moveCategoryUp(categoryId)` - Moves a category up
- `categoryService.moveCategoryDown(categoryId)` - Moves a category down
- `categoryService.createCategory()` - Automatically assigns order to new categories

### Backward Compatibility

- Works with both Supabase and localStorage modes
- For localStorage, falls back to name sorting if order is not available
- Existing categories without order are assigned order based on creation date

## Notes

- Ordering is per-budget (each budget has its own category order)
- The order is independent of category names
- Reordering does not affect existing transactions or category data

