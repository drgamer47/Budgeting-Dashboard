# SQL Scripts Directory

This directory contains all SQL scripts for the Budget Dashboard application.

## 📁 File Organization

### Core Schema
- `database-schema.sql` - Main database schema with tables, types, and initial RLS setup

### Table Fixes
- `fix-budgets-table.sql` - Budgets table fixes
- `fix-transactions-table.sql` - Transactions table fixes
- `fix-recurring-transactions-frequency.sql` - Recurring transactions frequency fixes

### RLS (Row Level Security) Fixes
- `fix-budget-members-rls-recursion.sql` - Fix infinite recursion in budget_members RLS
- `fix-budgets-rls-recursion.sql` - Fix infinite recursion in budgets RLS
- `fix-rls-recursion.sql` - General RLS recursion fixes
- `fix-budgets-policy.sql` - Budgets RLS policy fixes
- `fix-budget-members-policy.sql` - Budget members RLS policy fixes
- `fix-budget-invites-policy.sql` - Budget invites RLS policy fixes
- `fix-budget-members-delete.sql` - Budget members DELETE policy fixes
- `fix-budgets-insert.sql` - Budgets INSERT policy fixes
- `fix-budget-invites-update.sql` - Budget invites UPDATE policy fixes

### PostgREST Fixes
- `fix-postgrest-rls.sql` - PostgREST RLS fixes
- `fix-postgrest-rls-clean.sql` - Clean PostgREST RLS fixes
- `fix-postgrest-select-issue.sql` - PostgREST SELECT policy fixes
- `test-postgrest-insert.sql` - Test PostgREST INSERT

### Invite Code Fixes
- `fix-invite-join-test.sql` - Test invite join functionality
- `fix-invite-join-simple.sql` - Simple invite join fix
- `fix-invite-join-complete.sql` - Complete invite join fix
- `fix-invite-join-final.sql` - Final invite join fix
- `fix-budget-members-role.sql` - Budget members role fixes

### Triggers
- `fix-trigger.sql` - Trigger fixes
- `complete-trigger-fix.sql` - Complete trigger fix
- `verify-trigger.sql` - Verify trigger functionality

### Diagnostic & Testing
- `verify-current-setup.sql` - Verify current database setup
- `verify-user-signup.sql` - Verify user signup process
- `check-invites.sql` - Check invite codes
- `check-if-member.sql` - Check if user is a member
- `check-delete-policy.sql` - Check DELETE policies
- `debug-invite-issue.sql` - Debug invite issues
- `diagnose-rls-issue.sql` - Diagnose RLS issues
- `test-has-valid-invite.sql` - Test valid invite function

## 📝 Usage

These scripts are meant to be run in the Supabase SQL Editor or via psql.

### Running Scripts

1. **Via Supabase Dashboard:**
   - Go to SQL Editor
   - Copy and paste the script content
   - Click "Run"

2. **Via psql:**
   ```bash
   psql -h your-db-host -U postgres -d postgres -f sql/script-name.sql
   ```

## ⚠️ Important Notes

- Always backup your database before running fix scripts
- Run scripts in order if they have dependencies
- Some scripts may need to be run multiple times if they fix recursive issues
- Test scripts in a development environment first

## 🔄 Script Execution Order

For a fresh setup:
1. `database-schema.sql` - Initial schema
2. Any table fixes if needed
3. RLS fixes in order of dependencies
4. Trigger fixes
5. Verification scripts to confirm setup

For troubleshooting:
1. Run diagnostic scripts first
2. Identify the issue
3. Run appropriate fix script
4. Verify with check scripts

