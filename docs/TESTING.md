# Complete Feature Testing Guide - Deep Dive

## Table of Contents
1. [Setup & Pre-checks](#1-setup--pre-checks)
2. [Authentication & User Management](#2-authentication--user-management)
3. [Budget Management](#3-budget-management)
4. [Shared Budget Collaboration](#4-shared-budget-collaboration)
5. [Transactions](#5-transactions)
6. [Bank Integration (Plaid)](#6-bank-integration-plaid)
7. [Categories](#7-categories)
8. [Goals & Planning](#8-goals--planning)
9. [Recurring Transactions & Bills](#9-recurring-transactions--bills)
10. [Analytics & Visualization](#10-analytics--visualization)
11. [Data Import/Export](#11-data-importexport)
12. [Real-time Features](#12-real-time-features)
13. [UI/UX Features](#13-uiux-features)
14. [Settings & Preferences](#14-settings--preferences)
15. [Security & Permissions](#15-security--permissions)
16. [Error Handling & Edge Cases](#16-error-handling--edge-cases)

---

## 1) Setup & Pre-checks - *15 minutes*

### 1.1 Environment Setup
- **Supabase Configuration**: 
  - Verify `.env.local` or `supabase-config.js` has valid Supabase URL and anon key
  - Test connection by opening dashboard - should load without auth errors
  - Check browser console for any Supabase initialization errors

- **Plaid Configuration** (Optional for bank testing):
  - Verify `PLAID_CLIENT_ID` and `PLAID_SECRET` in environment
  - Server should be running on port 3000
  - Test endpoint: `http://localhost:3000/api/create_link_token` (POST request, not GET)
  - Use a tool like Postman, curl, or browser DevTools to test POST requests

### 1.2 Database Setup
Run these SQL files in Supabase SQL Editor (order matters for dependencies):
1. `database-schema.sql` - Base schema (tables, types, indexes)
2. `fix-budgets-table.sql` - Budget table fixes
3. `fix-transactions-table.sql` - Transaction table fixes
4. `fix-budgets-rls-recursion.sql` - Fix RLS recursion issues
5. `fix-budget-members-rls-recursion.sql` - Fix member RLS
6. `fix-budget-invites-policy.sql` - Invite policies
7. `fix-budget-members-role.sql` - Member role enum
8. `complete-trigger-fix.sql` - Trigger fixes
9. `verify-trigger.sql` - Verify triggers work
10. `fix-recurring-transactions-frequency.sql` - Recurring transaction fixes

**Verification**: 
- Check `pg_policies` table for all policies created
- Verify RLS is enabled on all tables
- Test basic SELECT/INSERT as authenticated user

### 1.3 Browser Setup
- **Fresh Session**: Clear cache, localStorage, cookies
- **DevTools**: Open console and network tabs
- **Multiple Browsers**: Prepare Chrome/Firefox/Edge for cross-browser testing
- **Mobile Testing**: Use browser dev tools mobile emulation or actual device

### 1.4 Test Users
Create two test accounts:
- **User A**: Owner account (will create shared budgets)
  - Recommended email: `test@testmail.com`
- **User B**: Member account (will join shared budgets)
  - Recommended email: `test2@testmail.com`
- Both should have different email addresses
- **Note:** Supabase blocks `@example.com` emails - use `@testmail.com` for test accounts
- To enable auto-signin for test emails, disable "Confirm email" in Supabase Dashboard → Authentication → Settings
- Note their user IDs for database verification

## 2) Authentication & User Management - *30 minutes*

### 2.1 Email/Password Sign Up

**Test Steps:**
- [x] Navigate to `auth.html`
- [x] Enter valid email (e.g., `test@testmail.com` or `test2@testmail.com` for debugging)
- [x] Enter password (min 6 characters)
- [x] Click "Sign Up"

**Expected Results:**
- Form submits without errors
- **For test emails (`test@testmail.com`, `test2@testmail.com`):**
  - Auto-signs in after signup (no email verification needed)
  - Redirects to `DashBoard.html` automatically
  - Session persists during redirect
- **For regular emails:**
  - Shows success message
  - Requires email verification (if enabled in Supabase)
  - Switches to sign-in tab after 3 seconds
- No console errors
- Toast notification shows success

**Note:** Supabase blocks `@example.com` emails. Use `@testmail.com` for test accounts. To enable auto-signin for test emails, disable "Confirm email" in Supabase Dashboard → Authentication → Settings.

**Verify in Database (Easy Method - Using Supabase Dashboard):**

1. **Check User Created:**
   - Go to **Supabase Dashboard** → **Authentication** → **Users**
   - You should see your new user listed with the email you used
   - Click on the user to see their details (UUID, email, created date)

2. **Check Profile Created:**
   - Go to **Supabase Dashboard** → **Table Editor** → **profiles**
   - Look for a row where the `id` matches the UUID from step 1
   - Verify the row shows:
     - `username` (auto-generated from email, e.g., "test")
     - `display_name` (from signup form or email)
     - `created_at` timestamp

3. **Check Personal Budget Created:**
   - Go to **Table Editor** → **budgets**
   - Look for a row where:
     - `owner_id` matches the user UUID from step 1
     - `type` = 'personal'
     - `name` = 'Personal Budget' (or default name)


**Edge Cases:**
- Invalid email format → Should show error, no redirect
- `@example.com` email → Shows helpful error suggesting `@testmail.com` instead
- Password too short → Should show validation error
- Email already exists → Should show "Email already registered" error
- Network error → Should show error toast, stay on auth page
- Email confirmation required (if not disabled) → Test emails will show error, regular emails require verification

### 2.2 Email/Password Sign In

**Test Steps:**
- [x] Navigate to `auth.html` (or if already logged in, sign out first)
- [x] Enter existing user email
- [x] Enter correct password
- [x] Click "Sign In"

**Expected Results:**
- Redirects to dashboard
- User session active (but does NOT persist after refresh - see Session Management)
- Profile menu shows user info
- Inactivity timer starts (5 minutes)
- No console errors

**Edge Cases:**
- Wrong password → Error message, no redirect
- Non-existent email → Error message, no redirect
- Empty fields → Validation error
- After sign in, navigate directly to `DashBoard.html` → Should load (session active during same page session)

### 2.3 Password Reset

**Note:** Test emails (`test@testmail.com`, `test2@testmail.com`) won't receive password reset emails. Use a real email address for testing.

**Test Steps:**
- [x] Sign up with a real email address (not a test email)
- [x] On auth page, click "Forgot Password" (if available)
- [x] Enter the real email address
- [x] Submit
- [x] Check your email inbox for the reset link
- [x] Click the reset link (should redirect to `/reset-password`)
- [x] Enter new password
- [x] Confirm new password
- [x] Submit
- [x] Verify redirect to sign-in page
- [x] Sign in with new password

**Expected Results:**
- Confirmation message shown after submitting reset request
- Email sent with reset link (check inbox)
- Reset link redirects to `/reset-password` page
- Password can be changed successfully
- Redirects to sign-in page after password reset
- Can sign in with new password
- Cannot sign in with old password

**Note:** Verify email functionality is configured in Supabase for production use

### 2.4 Session Management

**Test Steps:**
- [x] Sign in successfully
- [x] Refresh page (F5)
- [x] Close browser, reopen, navigate to dashboard
- [x] Check browser localStorage/sessionStorage for auth tokens

**Expected Results:**
- **Session does NOT persist after refresh** - user must log in again
- **Session does NOT persist after browser close/reopen** - user must log in again
- Session persists during redirect (from signup/signin to dashboard)
- Session cleared on page refresh (using sessionStorage flag)
- After refresh → Redirects to auth page (login required)
- After browser close/reopen → Redirects to auth page (login required)
- SessionStorage used to detect refreshes vs redirects

**Edge Cases:**
- Expired token → Should redirect to auth page
- Invalid token → Should redirect to auth page
- No token → Should redirect to auth page
- Refresh during active session → Redirects to login

### 2.5 Logout

**Test Steps:**
- [x] While logged in, click profile menu
- [x] Click "Sign Out" / "Logout"
- [x] Verify redirect

**Expected Results:**
- Redirects to `auth.html`
- Session cleared (no auth token in storage)
- Cannot access dashboard (redirects back to auth)
- Console shows logout success

**Verify:**
- Check Supabase client - should show no authenticated user
- Try navigating to dashboard directly → Should redirect to auth

### 2.6 Inactivity Timer (Auto-Logout)

**Test Steps:**
- [x] Sign in successfully
- [x] Wait 5 minutes without any activity (no mouse movement, clicks, keyboard, scrolling)
- [x] Verify auto-logout

**Expected Results:**
- After 5 minutes of inactivity, user is automatically logged out
- Toast notification shows: "Session expired due to inactivity. Please log in again."
- Redirects to `auth.html`
- Session cleared
- Timer resets on any user activity:
  - Mouse movements
  - Mouse clicks
  - Keyboard input
  - Scrolling
  - Touch events (mobile)

**Verify:**
- Timer starts when user logs in
- Timer resets on any activity
- Timer clears on logout
- No activity for 5 minutes triggers logout

**Edge Cases:**
- Activity just before timeout → Timer resets, no logout
- Multiple rapid activities → Timer resets each time
- Logout manually → Timer cleared

### 2.7 Auto-Redirect if Already Logged In

**Test Steps:**
- [x] Sign in successfully (during same page session)
- [x] Navigate to `auth.html` directly

**Expected Results:**
- **Note:** Auto-redirect removed - users can access auth page even if logged in
- If session is active, user can manually navigate to dashboard
- If session expired (after refresh), user must log in again

### 2.8 Profile Menu

**Test Steps:**
- [x] Click profile circle/button in header
- [x] Verify menu opens
- [x] Check for budget selector in dropdown
- [x] Click outside menu or close button
- [x] Verify menu closes

**Expected Results:**
- Menu dropdown appears
- Shows user initials/avatar in circle
- Shows display name or email
- Shows user email
- **Budget selector dropdown appears at top of menu** (after profile header)
- **"+ Budget" button appears below budget selector** (if user has budgets)
- Menu items visible (Manage Budgets, Join Budget, Connect Bank, etc.)
- Click outside closes menu
- Menu closes on item click (if applicable)
- Budget selector does NOT close menu when changed (user can switch budgets without closing menu)

**Verify Display:**
- Initials match first letter of display_name or email
- Name matches `profiles.display_name` or email
- Email matches `auth.users.email`

### 2.9 User Profiles

**Test Steps:**
- [x] Check `profiles` table in Supabase
- [x] Verify profile fields

**Expected Results:**
- Profile created automatically on signup (via trigger)
- `username` is unique
- `display_name` defaults to email username
- `currency_symbol` defaults to '$'
- `date_format` defaults to 'YYYY-MM-DD'
- `theme_preference` defaults to 'dark'
- `created_at` and `updated_at` timestamps set

**Edge Cases:**
- Duplicate username → Should append number (e.g., `user1`, `user2`)
- Profile already exists → Trigger should handle gracefully (ON CONFLICT DO NOTHING)

## 3) Budget Management - *45 minutes*

### 3.1 Personal Budget Auto-Creation

**Test Steps:**
- [x] Sign up new user (or use fresh account)
- [x] After redirect to dashboard, check budget selector

**Expected Results:**
- Budget selector shows "Personal Budget" (or similar default name)
- Budget is selected by default
- Data loads (empty initially)
- Budget appears in selector dropdown
- No console errors

**Verify in Database:**
- Check `budgets` table:
  - `type` = 'personal'
  - `owner_id` = current user's ID
  - `name` = 'Personal Budget' (or default)
  - `created_at` timestamp set
- Check trigger `on_auth_user_created` executed

**Edge Cases:**
- User already has personal budget → Should not create duplicate
- Trigger fails → Should not break user creation (error logged but user created)

### 3.2 Create Personal Budget

**Test Steps:**
- [x] Click "+ Budget" or "Create Budget" button
- [x] Enter budget name (e.g., "Vacation Fund")
- [x] Select "Personal" type
- [x] Click "Create"

**Expected Results:**
- Modal closes
- New budget appears in selector
- Budget is automatically selected
- Data loads (empty)
- Toast shows success message
- Budget persists after refresh

**Verify in Database:**
- New row in `budgets` table
- `type` = 'personal'
- `owner_id` = current user ID
- `name` matches input

**Edge Cases:**
- Empty name → Should show validation error
- Very long name → Should truncate or show error
- Network error → Should show error toast, budget not created

### 3.3 Create Shared Budget

**Test Steps:**
- [x] Click "+ Budget" or "Create Budget"
- [x] Enter budget name (e.g., "Household Budget")
- [x] Select "Shared" type
- [x] Click "Create"

**Expected Results:**
- Modal closes
- Budget appears in selector (may show "shared" badge/icon)
- Budget selected automatically
- Budget settings available (invite generation, member management)
- Toast shows success

**Verify in Database:**
- New row in `budgets` table
- `type` = 'shared'
- `owner_id` = current user ID
- Owner automatically added to `budget_members` with role 'owner'

**Edge Cases:**
- Same as personal budget creation
- Verify owner can immediately access budget settings

### 3.4 Budget Selector Dropdown

**Test Steps:**
- [x] Click profile menu to open dropdown
- [x] Locate budget selector at top of dropdown (after profile header)
- [x] With multiple budgets, click budget selector dropdown
- [x] Verify list of budgets
- [x] Select different budget
- [x] Verify data changes
- [x] Verify menu stays open (doesn't close on budget change)

**Expected Results:**
- Budget selector located in profile dropdown menu (not in header)
- Dropdown shows all accessible budgets:
  - Personal budgets (owned) - shown with 👤 icon
  - Shared budgets (owned or member of) - shown with 👥 icon
- Budget names displayed correctly
- Current budget highlighted/selected
- Selecting budget switches context
- Data reloads for selected budget
- Profile menu remains open when changing budget (doesn't close)
- "+ Budget" button appears below selector (if user has budgets)

**Verify:**
- Only shows budgets user owns or is member of (RLS enforced)
- Budgets sorted logically (by name or created_at)
- Selected budget persists after refresh (if session persists - note: sessions don't persist after refresh)
- Budget selector visible when budgets are loaded

### 3.5 Switch Between Budgets

**Test Steps:**
- [x] Create/select Budget A, add some transactions
- [x] Switch to Budget B
- [x] Switch back to Budget A
- [x] Refresh page

**Expected Results:**
- Data changes immediately on switch
- Transactions/categories/goals show correct budget's data
- Charts update to reflect current budget
- KPIs update
- No data leakage between budgets
- Last selected budget persists after refresh

**Verify:**
- Console logs show correct budget ID in `loadDataFromSupabase`
- Network requests filter by `budget_id`
- Realtime subscriptions switch to new budget
- Old budget's realtime unsubscribes

**Edge Cases:**
- Rapid switching → Should handle gracefully, no race conditions
- Switch while data loading → Should cancel old request or queue properly
- Switch to budget user no longer has access to → Should show error, revert selection

### 3.6 Delete Budget

**Test Steps:**
- [x] As budget owner, open budget settings
- [x] Click "Delete Budget" (in danger zone)
- [x] Confirm deletion
- [x] Verify budget removed

**Expected Results:**
- Confirmation dialog appears
- After confirmation, budget deleted
- Budget removed from selector
- All related data deleted (cascade):
  - Transactions
  - Categories
  - Goals
  - Debts
  - Recurring transactions
  - Budget members
  - Budget invites
- User switched to another budget (or personal budget)
- Toast shows success

**Verify in Database:**
- Budget row deleted from `budgets`
- All related rows deleted (verify cascade deletes work)
- No orphaned data

**Edge Cases:**
- Non-owner tries to delete → Should not see delete button or get permission error
- Cancel deletion → Budget should remain
- Delete last budget → Should create new personal budget or handle gracefully
- Delete while others viewing → Should handle realtime updates

### 3.7 Budget Settings Modal

**Test Steps:**
- [x] Select shared budget
- [x] Open budget settings (gear icon or menu)
- [x] Verify modal opens
- [x] Check available options

**Expected Results:**
- Modal opens with budget name in title
- Shows budget members list
- Shows invite code section (for shared budgets)
- Shows danger zone (delete budget) for owners
- Modal closes on X button or outside click

**Verify:**
- Only owners see delete option
- Members see read-only view or limited options
- Modal responsive on mobile

## 4) Shared Budget Collaboration - *1 hour*

### 4.1 Generate Invite Code

**Test Steps:**
- [x] As budget owner, open budget settings
- [x] Click "Generate Invite Code" or similar button
- [x] Verify code generated

**Expected Results:**
- Invite code displayed (8 characters, uppercase)
- Code is unique
- Expiration date shown (default 7 days)
- Code can be copied
- Toast shows success

**Verify in Database:**
- New row in `budget_invites` table
- `budget_id` matches current budget
- `created_by` = current user ID
- `invite_code` is unique
- `expires_at` = 7 days from now (or configured default)
- `used_at` = NULL
- `used_by` = NULL

**Edge Cases:**
- Generate multiple invites → All should be valid
- Code collision → Should regenerate (very unlikely with 8 chars)
- Generate for personal budget → Should not be available or show error

### 4.2 Join Budget with Invite Code

**Test Steps:**
- [x] As User B (different account), open "Join Budget" modal
- [x] Enter valid invite code from User A's shared budget
- [x] Click "Join" or "Submit"
- [x] Verify membership

**Expected Results:**
- Modal closes
- Budget appears in User B's budget selector
- User B can switch to shared budget
- User B can see transactions/categories
- Toast shows "Successfully joined budget!"
- Budget data loads

**Verify in Database:**
- New row in `budget_members`:
  - `budget_id` matches invited budget
  - `user_id` = User B's ID
  - `role` = 'member' (default)
  - `joined_at` timestamp set
- Invite marked as used:
  - `used_at` timestamp set
  - `used_by` = User B's ID

**Edge Cases:**
- Invalid code → Error message, no join
- Expired code → Error message "Invalid or expired invite code"
- Already used code → Error message, cannot reuse
- Already a member → Should show "Already a member" message (409 conflict handled)
- Code for different budget → Should join correct budget
- User tries to join own budget → Should handle gracefully

### 4.3 View Budget Members

**Test Steps:**
- [x] As budget owner or member, open budget settings
- [x] View members list

**Expected Results:**
- List shows all members:
  - Owner (with "owner" badge/role)
  - Members (with "member" or "admin" role)
- Shows user display names or usernames
- Shows join dates
- Shows current user indicator ("You")
- List updates in real-time when members added/removed

**Verify:**
- Only shows members user has permission to see (RLS)
- Data matches `budget_members` table
- Profile data (display_name, avatar) loads correctly

### 4.4 Add Member (Manual)

**Test Steps:**
- [x] As budget owner, open budget settings
- [x] In **Invite Code** section, click **Generate New Code**
- [x] Copy the invite code (or click **Copy Link** if present)
- [x] As User B, click **Join Budget** and enter the invite code

**Expected Results:**
- Invite code is generated and displayed (or updated)
- User B successfully joins the shared budget
- Members list updates (or updates after refresh) showing User B
- User B can now access the budget in their budget selector
- Toast shows success (if implemented)

**Note:** There is currently **no direct “Add Member” by email** UI in the dashboard; membership is **invite-code based**.

### 4.5 Remove Member

**Test Steps:**
- [x] As budget owner, in budget settings
- [x] Find member in list
- [x] Click "Remove" button next to member
- [x] Confirm removal

**Expected Results:**
- Confirmation dialog appears
- After confirmation, member removed
- Member disappears from list
- Member can no longer access budget
- Budget removed from member's selector
- Removed member sees a toast/message like "You were removed from <budget name>" (even if they are currently viewing another budget)
- If the removed member was currently viewing that budget, their page auto-switches away from it (booted from the budget)
- Toast shows "Member removed"

**Verify in Database:**
- Row deleted from `budget_members`
- Member's access revoked (RLS prevents access)

**Edge Cases:**
- Remove owner → Should not be allowed (button hidden or error)
- Remove self (leave budget) → Member can click **Leave Budget** in budget settings. Should remove their membership row and boot them out of the budget.
- Remove while member viewing → Should handle realtime update
- Non-owner tries to remove → Button hidden or permission error

### 4.6 Update Member Role

**Test Steps:**
- [x] As budget owner, in budget settings
- [x] Find member
- [x] Change role dropdown (member → admin, or admin → member)
- [x] Click **Save**

**Expected Results:**
- Role updated in list
- Changes persist after refresh
- Toast shows success

**Verify in Database:**
- `budget_members.role` updated
- RLS policies respect new role

**Edge Cases:**
- Change owner role → Should not be allowed
- Role UI not visible → Run `sql/fix-budget-members-role.sql` then `sql/fix-budget-members-update-role-policy.sql`
- Change own role → May be restricted
- Invalid role → Should show validation error

### 4.7 Member Permissions

**Test Steps:**
- [x] As member (not owner), verify permissions:
   - Can view transactions
   - Can add transactions
   - Can edit own transactions
   - Can delete own transactions (or all, depending on policy)
   - Cannot delete budget
   - Cannot remove members
   - Cannot change member roles

**Expected Results:**
- Members have appropriate read/write access
- Owners have full control
- RLS policies enforce permissions correctly

**Verify:**
- Test each action as member vs owner
- Check RLS policies in database
- Verify UI shows/hides buttons based on role

## 5) Transactions - *1.5 hours*

### 5.1 Add Transaction (Manual Entry)

**Test Steps:**
- [x] Click "+ Add Transaction" button
- [x] Fill in transaction form:
   - Date (select or enter)
   - Description
   - Type (Income/Expense)
   - Category (select from dropdown)
   - Amount
   - Merchant (optional)
   - Notes (optional)
- [x] Click "Save"

**Expected Results:**
- Drawer/modal closes
- Transaction appears in transactions table
- Transaction appears in correct month view
- KPIs update (Income/Expenses/Net)
- Charts update
- Toast shows success
- Transaction persists after refresh

**Verify in Database:**
- New row in `transactions` table:
  - `budget_id` = current budget ID
  - `user_id` = current user ID (for attribution)
  - `date` matches selected date
  - `description` matches input
  - `type` = 'income' or 'expense'
  - `category_id` matches selected category
  - `amount` matches input
  - `merchant` matches input (if provided)
  - `notes` matches input (if provided)
  - `created_at` and `updated_at` timestamps set

**Edge Cases:**
- Empty description → Should show validation error
- Negative amount → Should handle (may convert based on type)
- Future date → Should allow (for planned transactions)
- Very old date → Should allow (historical data)
- Invalid category → Should show error or default to "Other"
- Amount with decimals → Should handle correctly (2 decimal places)
- Very large amount → Should handle (database DECIMAL(10,2) limit)

### 5.2 Edit Transaction

**Test Steps:**
- [x] Click on transaction in table (edit mode) OR
- [x] Select transaction, click "Edit" button
- [x] Modify fields
- [x] Save changes

**Expected Results:**
- Changes saved
- Transaction updates in table
- KPIs recalculate
- Charts update
- Toast shows success
- Changes persist after refresh

**Verify:**
- `updated_at` timestamp changes
- All fields update correctly
- User attribution preserved (if editing others' transactions allowed)

**Edge Cases:**
- Edit to different month → Transaction moves to correct month view
- Edit category → Transaction moves to new category in charts
- Edit amount to 0 → Should allow or show validation
- Edit while transaction deleted by another user → Should handle error gracefully

### 5.3 Delete Transaction (Single)

**Test Steps:**
- [x] Enter delete mode (click "Delete" button or long-press on mobile)
- [x] Click transaction to select OR click delete icon on transaction
- [x] Confirm deletion in the **modal popup** (click **Delete**)

**Expected Results:**
- Transaction removed from table
- KPIs recalculate
- Charts update
- Toast shows success
- Deletion persists after refresh

**Verify in Database:**
- Row deleted from `transactions` table
- No orphaned references

**Edge Cases:**
- Delete transaction in different month → Should update correctly
- Delete while editing → Should handle gracefully
- Delete transaction with category → Category should remain (cascade SET NULL)

### 5.4 Bulk Delete Transactions

**Test Steps:**
- [x] Enter delete mode
- [x] Select multiple transactions (checkboxes)
- [x] Click "Delete Selected"
- [x] Confirm deletion

**Expected Results:**
- All selected transactions deleted
- Selection mode exits
- KPIs recalculate
- Charts update
- Toast shows count of deleted transactions
- Deletions persist

**Edge Cases:**
- Select all → Should delete all visible transactions
- Select none → Button disabled or shows error
- Delete while transactions being added → Should handle race condition

### 5.5 Search Transactions

**Test Steps:**
- [x] Enter text in search box
- [x] Verify results filter immediately (table/cards, KPIs, and charts update based on filtered transactions)
- [x] Clear search

**Expected Results:**
- Results filter by description/merchant matching search term
- Table updates immediately (no page reload)
- Search is case-insensitive
- Partial matches work
- Clear search restores all transactions

**Edge Cases:**
- Empty search → Shows all transactions
- Special characters → Should handle (escape properly)
- Very long search term → Should handle
- Search while typing → Should debounce (if implemented)

### 5.6 Filter Transactions

**Test Steps:**
- [ ] Filter by Type:
   - Select "Income" → Only income transactions shown
   - Select "Expense" → Only expense transactions shown
   - Select "All" → All transactions shown
- [ ] Filter by Category:
   - Select category → Only that category's transactions shown
   - Select "All" → All transactions shown
- [ ] Filter by Month/Year:
   - Select month/year → Only that month's transactions shown
   - Click "All Months" → All transactions shown

**Expected Results:**
- Filters apply immediately
- Table updates
- KPIs reflect filtered data
- Charts reflect filtered data
- Multiple filters can be combined
- Clear filters restores all data

**Edge Cases:**
- No results match filter → Shows "No transactions" message
- Filter by category with no transactions → Shows empty state
- Filter by future month → Shows empty or planned transactions

### 5.7 Sort Transactions

**Test Steps:**
- [ ] Click column header to sort
- [ ] Click again to reverse sort
- [ ] Try different columns: Date, Description, Type, Category, Amount

**Expected Results:**
- First click: Sort ascending (↑ indicator)
- Second click: Sort descending (↓ indicator)
- Table reorders immediately
- Sort persists while filtering/searching
- Sort indicator shows current sort column and direction

**Edge Cases:**
- Sort by amount → Numbers sort correctly (not alphabetically)
- Sort by date → Chronological order
- Sort with filters applied → Should maintain sort
- Sort empty table → No errors

### 5.8 Transaction Attribution (Shared Budgets)

**Test Steps:**
- [ ] In shared budget, add transaction as User A
- [ ] View transaction as User B
- [ ] Verify attribution shown

**Expected Results:**
- Transaction shows user badge/avatar/name
- Shows who added the transaction
- Attribution visible in table/cards
- Real-time updates show attribution

**Verify:**
- `user_id` field populated correctly
- Profile data (display_name, avatar) loads
- Attribution updates if user profile changes

### 5.9 Month/Year Navigation

**Test Steps:**
- [ ] Select different month from dropdown
- [ ] Select different year
- [ ] Click "All Months" button
- [ ] Verify data changes

**Expected Results:**
- Transactions filter to selected month
- KPIs show selected month data
- Charts show selected month data
- "All Months" shows all transactions
- Selection persists after refresh

**Edge Cases:**
- Select month with no transactions → Shows empty state
- Switch between months rapidly → Should handle gracefully
- "All Months" with filters → Should combine correctly

### 5.10 Mobile Transaction Cards

**Test Steps:**
- [ ] View on mobile device or mobile emulation
- [ ] Verify transactions show as cards instead of table
- [ ] Test card interactions

**Expected Results:**
- Cards layout responsive
- Cards show all transaction info
- Cards clickable for edit/delete
- Long-press works for selection
- No horizontal scroll issues
- Cards readable on small screens

## 6) Categories - *30 minutes*

### 6.1 Create Category

**Test Steps:**
- [ ] Open categories settings/modal
- [ ] Click "Add Category" or "+"
- [ ] Enter:
   - Name (required)
   - Color (select or picker)
   - Monthly Budget (optional)
- [ ] Save

**Expected Results:**
- Category created
- Appears in category list
- Available in transaction category dropdown
- Appears in category chart
- Toast shows success

**Verify in Database:**
- New row in `categories` table:
  - `budget_id` = current budget ID
  - `name` matches input
  - `color` matches selected color
  - `monthly_budget` matches input (or 0 if not set)
  - `created_at` timestamp set
  - Unique constraint: `(budget_id, name)` enforced

**Edge Cases:**
- Duplicate name in same budget → Should show error
- Empty name → Validation error
- Very long name → Should truncate or error
- Invalid color → Should default to gray
- Negative monthly budget → Should allow or show error

### 6.2 Edit Category

**Test Steps:**
- [ ] Click on category in list
- [ ] Modify name/color/monthly budget
- [ ] Save

**Expected Results:**
- Changes saved
- Category updates in list
- Category dropdown updates
- Charts update
- Existing transactions keep category (category_id unchanged)
- Toast shows success

**Edge Cases:**
- Change name to duplicate → Should show error
- Change color → Charts update immediately
- Change monthly budget → Budget alerts recalculate

### 6.3 Delete Category

**Test Steps:**
- [ ] Select category
- [ ] Click delete
- [ ] Confirm deletion

**Expected Results:**
- Category removed from list
- Removed from category dropdown
- Transactions with this category → `category_id` set to NULL (cascade SET NULL)
- Charts update
- Toast shows success

**Verify:**
- Transactions still exist but uncategorized
- No orphaned category references

**Edge Cases:**
- Delete category with many transactions → Should handle cascade
- Delete last category → Should allow or prevent
- Delete default category → Should handle gracefully

### 6.4 Category Budget Alerts

**Test Steps:**
- [ ] Set monthly budget for category
- [ ] Add expenses in that category
- [ ] Approach/exceed budget

**Expected Results:**
- Alert shown when approaching threshold (e.g., 80%)
- Alert shown when over budget (100%+)
- Toast notifications appear
- Visual indicator in UI (if implemented)

**Verify:**
- Alert threshold configurable in settings
- Alerts calculate correctly (current month expenses vs budget)
- Alerts reset each month

## 7) Goals & Planning - *45 minutes*

### 7.1 Savings Goals

**Create:**
1. Go to Goals tab
2. Click "Add Goal"
3. Enter name, target amount, current amount
4. Save

**Expected Results:**
- Goal appears in list
- Progress bar shows (current/target)
- "Total Savings" KPI updates
- Goal persists after refresh

**Verify in Database:**
- New row in `savings_goals`:
  - `budget_id` = current budget
  - `name`, `target`, `current` match input
  - `created_at` and `updated_at` set

**Edit:**
- Modify name, target, or current amount
- Changes save and update display
- KPI recalculates

**Add Money:**
- Click "Add" or "+" on goal
- Enter amount to add
- Current amount increases
- Progress bar updates
- KPI updates

**Delete:**
- Remove goal
- KPI updates
- Goal removed from list

### 7.2 Financial Goals

**Create:**
1. Click "Add Financial Goal"
2. Enter:
   - Name
   - Type (savings, debt_payoff, investment, purchase, other)
   - Target amount
   - Current amount
   - Target date (optional)
3. Save

**Expected Results:**
- Goal appears in list
- Type badge/icon shown
- Progress displayed
- Target date countdown (if set)
- Goal persists

**Verify:**
- All goal types work
- Target date validation (future dates)
- Progress calculation correct

**Edit/Delete:**
- Similar to savings goals
- All fields editable
- Deletion removes goal

### 7.3 Debt Tracking

**Create:**
1. Click "Add Debt"
2. Enter:
   - Name (e.g., "Credit Card")
   - Current balance
   - Original balance (optional)
   - Interest rate (optional)
   - Minimum payment (optional)
   - Target payoff date (optional)
3. Save

**Expected Results:**
- Debt appears in list
- Shows balance, interest, payment info
- Progress toward payoff (if original balance set)
- Debt persists

**Verify in Database:**
- New row in `debts` table
- All fields save correctly
- Calculations work (interest, payoff timeline)

**Edit:**
- Update balance (payments made)
- Modify interest rate
- Change minimum payment
- All changes save

**Delete:**
- Remove debt
- Debt removed from list

## 8) Recurring Transactions & Bills - *30 minutes*

### 8.1 Create Recurring Transaction

**Test Steps:**
- [ ] Go to Bills & Recurring tab
- [ ] Click "Add Recurring Transaction"
- [ ] Enter:
   - Description
   - Amount
   - Type (income/expense)
   - Category
   - Frequency (weekly, biweekly, monthly, quarterly, yearly)
   - Next date
- [ ] Save

**Expected Results:**
- Recurring transaction appears in list
- Shows next occurrence date
- Shows frequency
- Appears in bill reminders if upcoming
- Persists after refresh

**Verify in Database:**
- New row in `recurring_transactions`:
  - All fields match input
  - `frequency` is valid enum value
  - `next_date` is future date

**Edge Cases:**
- Past next_date → Should allow or show warning
- Invalid frequency → Validation error
- Missing required fields → Validation error

### 8.2 Edit Recurring Transaction

**Test Steps:**
- [ ] Click on recurring transaction
- [ ] Modify any field
- [ ] Save

**Expected Results:**
- Changes save
- Next date updates if frequency changed
- List updates
- Bill reminders update

### 8.3 Delete Recurring Transaction

**Test Steps:**
- [ ] Select recurring transaction
- [ ] Delete
- [ ] Confirm

**Expected Results:**
- Removed from list
- Removed from bill reminders
- Persists after refresh

### 8.4 Bill Reminders

**Test Steps:**
- [ ] Create recurring expense with next date within 7 days
- [ ] View Bills & Recurring tab
- [ ] Check "Upcoming Bills" section

**Expected Results:**
- Bills within 7 days shown
- Shows days until due
- Urgent bills (≤3 days) highlighted
- Sorted by due date
- Empty state if no upcoming bills

**Verify:**
- Only shows expenses (not income)
- Calculates days correctly
- Updates as dates pass

## 9) Data Import/Export & Migration - *45 minutes*

### 9.1 CSV Import

**Test Steps:**
- [ ] Prepare CSV file with columns: Date, Description, Type, Category, Amount
- [ ] Click "Import CSV" in profile menu
- [ ] Select CSV file
- [ ] Verify import

**Expected Results:**
- Transactions imported
- Categories matched or created
- Amounts parsed correctly
- Dates parsed correctly
- Toast shows count of imported transactions
- Transactions appear in table
- No duplicate UUID errors

**Verify:**
- All rows imported
- Categories created if not exist
- Amount signs correct (negative = expense)
- Date formats handled (various formats)

**Edge Cases:**
- Invalid CSV format → Error message
- Missing columns → Error or default handling
- Duplicate transactions → Should skip or handle
- Very large CSV → Should handle (batch processing)

### 9.2 JSON Export

**Test Steps:**
- [ ] Click "Export JSON" in profile menu
- [ ] File downloads
- [ ] Open file, verify contents

**Expected Results:**
- JSON file downloads
- Contains all data:
  - Transactions
  - Categories
  - Goals (savings & financial)
  - Debts
  - Recurring transactions
  - Settings
- JSON is valid and parseable
- File named with timestamp

**Verify:**
- All data types included
- Data structure matches app format
- Can be imported back

### 9.3 JSON Import

**Test Steps:**
- [ ] Export JSON first (for test data)
- [ ] Clear some data
- [ ] Click "Import JSON"
- [ ] Select exported file
- [ ] Verify data restored

**Expected Results:**
- Data imported
- All entities restored
- Relationships preserved
- Toast shows success
- Data appears in UI

**Edge Cases:**
- Invalid JSON → Error message
- Missing fields → Should handle gracefully
- Old format JSON → Should migrate or error

### 9.4 Undo Import

**Test Steps:**
- [ ] Import CSV or JSON
- [ ] Click "Undo Import"
- [ ] Verify changes reverted

**Expected Results:**
- Imported data removed
- Previous state restored
- Toast confirms undo

**Note:** May not be implemented for all import types

### 9.5 Data Migration (localStorage → Supabase)

**Test Steps:**
- [ ] Have existing localStorage data
- [ ] Sign in to Supabase account
- [ ] Verify migration prompt appears
- [ ] Click "Migrate"
- [ ] Verify data in Supabase

**Expected Results:**
- Prompt appears on first Supabase login
- Migration runs
- All data migrated:
  - Transactions
  - Categories
  - Goals
  - Debts
  - Recurring
- Data assigned to current budget
- Prompt doesn't show again
- Toast shows success

**Verify in Database:**
- All data in Supabase tables
- Budget relationships correct
- No data loss

**Edge Cases:**
- No localStorage data → No prompt
- Migration fails → Error shown, data preserved in localStorage
- Partial migration → Should handle or rollback
CSV Import:
- Import sample CSV; confirm rows inserted, categories matched/created; no UUID errors; amounts/signs correct.

JSON Export/Import:
- Export; clear data; import; data restored (transactions/categories/goals/debts/recurring).

Migration:
- With localStorage data present, confirm prompt; migrate to Supabase; verify data in current budget; prompt no longer shown.

## 10) Bank Integration (Plaid) - *30 minutes*

### 10.1 Connect Bank Account

**Prerequisites:**
- Plaid keys configured in environment
- Server running on port 3000
- Plaid Link script loaded

**Test Steps:**
- [ ] Click "Connect Bank" in profile menu
- [ ] Plaid Link modal opens
- [ ] Search for test institution (e.g., "First Platypus Bank")
- [ ] Select test institution
- [ ] Enter test credentials:
   - Username: `user_good`
   - Password: `pass_good`
- [ ] Complete connection flow

**Expected Results:**
- Plaid Link opens
- Can search and select institutions
- Connection succeeds
- Access token stored
- Institution name shown
- Toast shows "Connected to [Bank Name]"
- Transactions import automatically starts

**Verify:**
- `bankConnections` array updated in data
- Access token stored (securely)
- Institution info saved
- Account info saved

**Edge Cases:**
- Connection cancelled → Toast shows "Connection cancelled"
- Invalid credentials → Error shown
- Network error → Error toast, connection not saved
- Real bank in sandbox → Should use test institutions only

### 10.2 Import Bank Transactions

**Test Steps:**
- [ ] After connecting bank, transactions import automatically
- [ ] OR click "Import Transactions" button (if available)
- [ ] Wait for import to complete

**Expected Results:**
- Transactions fetched from Plaid
- Transactions added to current budget
- Transactions appear in table
- Transactions have:
  - Correct date
  - Description from bank
  - Amount (positive for credits, negative for debits)
  - Type determined (income/expense)
  - Category assigned (default or matched)
  - `plaid_id` stored (for duplicate prevention)
- Toast shows count of imported transactions
- KPIs update
- Charts update

**Verify in Database:**
- Transactions have `plaid_id` field populated
- `account_id` stored
- `user_id` = current user
- `budget_id` = current budget
- Duplicates prevented (same `plaid_id` not imported twice)

**Edge Cases:**
- "Product not ready" error → Retry with exponential backoff (up to 3 retries)
- No transactions in date range → Toast shows "No transactions found"
- Duplicate transactions → Skipped (not re-imported)
- Very large transaction list → Should handle (batch processing)
- Import while offline → Error shown, can retry later

### 10.3 Bank Transaction Attribution

**Test Steps:**
- [ ] Import transactions from bank
- [ ] View transactions in shared budget
- [ ] Verify bank transactions show attribution

**Expected Results:**
- Bank transactions show bank icon/badge
- Shows which account they came from
- Shows import date/time
- Different from manual transactions visually

### 10.4 Re-import Bank Transactions

**Test Steps:**
- [ ] After initial import, click "Import Transactions" again
- [ ] Verify only new transactions imported

**Expected Results:**
- Only new transactions added
- Duplicates skipped (based on `plaid_id`)
- Toast shows count of new transactions
- Existing transactions unchanged

## 11) Real-time Features - *1 hour*

### 11.1 Real-time Transaction Updates

**Setup:**
- User A and User B both viewing same shared budget
- Two browser windows/tabs

**Test Steps:**
- [ ] User A adds transaction
- [ ] Observe User B's browser

**Expected Results:**
- Transaction appears in User B's table within seconds
- Toast notification shows: "[User Name] added a transaction"
- KPIs update
- Charts update
- No page refresh needed

**Verify:**
- Realtime subscription active (check console logs)
- Update happens via Supabase Realtime, not polling
- Attribution shows correct user

### 11.2 Real-time Transaction Edits

**Test Steps:**
- [ ] User A edits transaction
- [ ] Observe User B's browser

**Expected Results:**
- Transaction updates in User B's view
- Toast: "Transaction updated"
- Changes visible immediately

### 11.3 Real-time Transaction Deletes

**Test Steps:**
- [ ] User A deletes transaction
- [ ] Observe User B's browser

**Expected Results:**
- Transaction removed from User B's view
- Toast: "Transaction deleted"
- KPIs update

### 11.4 Real-time Category Updates

**Test Steps:**
- [ ] User A creates/edits/deletes category
- [ ] Observe User B's browser

**Expected Results:**
- Category list updates
- Category dropdown updates
- Charts update
- Toast: "Categories updated"

### 11.5 Real-time Goal Updates

**Test Steps:**
- [ ] User A creates/edits/deletes goal
- [ ] Observe User B's browser

**Expected Results:**
- Goals list updates
- KPIs update
- Toast: "Goals updated"

### 11.6 Real-time Member Updates

**Test Steps:**
- [ ] User A (owner) adds/removes member
- [ ] Observe User B's browser

**Expected Results:**
- Member list updates
- If User B removed, access revoked
- If new member added, they can access immediately
- Toast notifications for member changes

### 11.7 Realtime Subscription Management

**Test Steps:**
- [ ] Switch budgets
- [ ] Verify old subscription unsubscribes
- [ ] Verify new subscription subscribes
- [ ] Check console logs

**Expected Results:**
- Old budget's realtime unsubscribed
- New budget's realtime subscribed
- No cross-budget updates
- Console shows subscription changes
- No memory leaks (old subscriptions cleaned up)

**Edge Cases:**
- Switch rapidly between budgets → Should handle gracefully
- Switch to personal budget → Realtime may not be active (personal budgets may not need realtime)
- Network disconnection → Should reconnect automatically

## 12) Analytics & Visualization - *45 minutes*

### 12.1 KPI Cards

**Test Steps:**
- [ ] View Overview tab
- [ ] Check KPI cards: Income, Expenses, Net, Total Savings
- [ ] Add/remove transactions
- [ ] Verify KPIs update

**Expected Results:**
- Income: Sum of all income transactions (filtered by month if month selected)
- Expenses: Sum of all expense transactions (filtered)
- Net: Income - Expenses
- Total Savings: Sum of all savings goals' current amounts
- KPIs update immediately on data changes
- KPIs respect month filter
- KPIs respect "All Months" toggle
- Formatting: Currency symbol, commas, 2 decimals

**Verify:**
- Calculations correct
- Only shows current budget's data
- Updates in real-time (shared budgets)

### 12.2 Sankey Diagram (Income Flow)

**Test Steps:**
- [ ] View Overview tab
- [ ] Check Sankey diagram
- [ ] Add transactions with different categories
- [ ] Verify diagram updates

**Expected Results:**
- Shows flow: Income → Categories → Descriptions
- Widths proportional to amounts
- Percentages shown
- Interactive (hover shows details)
- Updates on data changes
- Only shows current budget's data

**Verify:**
- Totals match transaction totals
- Categories grouped correctly
- No cross-budget data leakage

### 12.3 Category Spending Chart (Doughnut/Pie)

**Test Steps:**
- [ ] View Overview tab
- [ ] Check category chart
- [ ] Add expenses in different categories
- [ ] Verify chart updates

**Expected Results:**
- Chart shows expense breakdown by category
- Each category has different color
- Percentages shown
- Legend shows category names
- Interactive (hover/click shows details)
- Updates on data changes
- Respects month filter

**Verify:**
- Only shows expenses (not income)
- Colors match category colors
- Totals correct

### 12.4 Monthly Spending Chart (Bar/Line)

**Test Steps:**
- [ ] View Overview tab
- [ ] Check monthly chart
- [ ] Add transactions across multiple months
- [ ] Verify chart updates

**Expected Results:**
- Shows spending over time (by month)
- Bars or lines show amounts
- X-axis: Months
- Y-axis: Amounts
- Interactive (hover shows details)
- Updates on data changes

**Verify:**
- Only shows current budget
- Months ordered correctly
- Amounts accurate

### 12.5 Calendar Heatmap (Net Income)

**Test Steps:**
- [ ] View Overview tab
- [ ] Check calendar heatmap
- [ ] Add transactions on different dates
- [ ] Verify heatmap updates

**Expected Results:**
- Calendar grid shows days
- Colors indicate net income:
  - Green: Positive net
  - Red: Negative net
  - Intensity based on amount
- Hover shows tooltip: date, net, income, expenses
- Updates on data changes
- Shows current year or selected range

**Verify:**
- Calculations correct (income - expenses per day)
- Colors match amounts
- Tooltips accurate

### 12.6 Spending Reports

**Test Steps:**
- [ ] Go to Reports & Insights tab
- [ ] View "Reports & Analytics" section

**Expected Results:**
- Monthly Comparison:
  - Current month: Income, Expenses, Net
  - Last month: Income, Expenses, Net
  - Percentage changes shown
- Category Breakdown:
  - Top spending categories
  - Amounts per category
  - Percentages
- All data accurate
- Updates on data changes

**Verify:**
- Only shows current budget
- Calculations correct
- Dates correct (current vs last month)

### 12.7 Spending Insights

**Test Steps:**
- [ ] Go to Reports & Insights tab
- [ ] View "Spending Insights" section

**Expected Results:**
- Spending trends analysis
- Category analysis
- Budget vs actual comparisons
- Insights text/visualizations
- Updates on data changes

**Verify:**
- Insights accurate
- Only current budget data
- No errors in calculations

## 13) UI/UX Features - *30 minutes*

### 13.1 Theme Toggle (Dark/Light)

**Test Steps:**
- [ ] Click theme toggle button (if available)
- [ ] Verify theme changes
- [ ] Refresh page
- [ ] Verify theme persists

**Expected Results:**
- Theme switches between dark/light
- All UI elements update colors
- Theme preference saved
- Persists after refresh
- Matches user's `theme_preference` in profile

### 13.2 Responsive Design

**Desktop:**
- All elements visible
- Tables show full columns
- Charts fit properly
- No horizontal scroll
- Layout uses available space

**Mobile (< 768px):**
- Transaction cards instead of table
- Stacked layout
- Touch-friendly buttons
- Charts resize
- Navigation accessible
- No text overflow

**Tablet:**
- Hybrid layout
- Some columns may hide
- Charts adjust size

### 13.3 Tab Navigation

**Test Steps:**
- [ ] Click different tabs: Overview, Transactions, Goals, Bills, Reports
- [ ] Verify content changes
- [ ] Verify active tab highlighted

**Expected Results:**
- Tabs switch smoothly
- Content loads for each tab
- Active tab visually distinct
- URL may update (if implemented)
- Tab state persists (if implemented)

### 13.4 Drawer/Modal System

**Test Steps:**
- [ ] Open drawer (add transaction)
- [ ] Close drawer (X button, outside click, ESC key)
- [ ] Open modal (settings, etc.)
- [ ] Close modal

**Expected Results:**
- Drawer slides in/out smoothly
- Modal fades in/out
- Close on X button works
- Close on outside click works
- ESC key closes (if implemented)
- Focus management (focus trap in modal)
- Backdrop/overlay visible

### 13.5 Toast Notifications

**Test Steps:**
- [ ] Perform various actions (create, edit, delete)
- [ ] Observe toast notifications

**Expected Results:**
- Toasts appear for:
  - Success actions
  - Errors
  - Real-time updates
  - Info messages
- Toasts auto-dismiss after few seconds
- Toasts stack properly (multiple toasts)
- Toasts don't block UI
- Clear, concise messages

### 13.6 Loading States

**Test Steps:**
- [ ] Perform slow operations (import, data load)
- [ ] Observe loading indicators

**Expected Results:**
- Loading spinner/indicator shown
- Button states disabled during loading
- User feedback that action is processing
- No double-submissions possible

### 13.7 Error Handling UI

**Test Steps:**
- [ ] Trigger errors (network offline, invalid input, etc.)
- [ ] Observe error messages

**Expected Results:**
- Errors shown in toast or inline
- Error messages clear and actionable
- App doesn't crash
- User can recover from errors
- Console logs errors for debugging

### 13.8 Haptic Feedback (Mobile)

**Test Steps:**
- [ ] On mobile device, perform actions
- [ ] Feel for haptic feedback

**Expected Results:**
- Vibration on button presses (if implemented)
- Vibration on long-press
- Enhances mobile UX

## 14) Settings & Preferences - *15 minutes*

### 14.1 Currency Symbol

**Test Steps:**
- [ ] Open settings
- [ ] Change currency symbol
- [ ] Verify changes apply

**Expected Results:**
- Currency symbol updates throughout app
- KPIs show new symbol
- Transactions show new symbol
- Charts show new symbol
- Setting persists after refresh

**Verify:**
- Saved to `profiles.currency_symbol`
- Default is '$'

### 14.2 Date Format

**Test Steps:**
- [ ] Open settings
- [ ] Change date format
- [ ] Verify dates display in new format

**Expected Results:**
- Dates throughout app use new format
- Transaction dates
- Goal dates
- All date displays
- Setting persists

**Verify:**
- Saved to `profiles.date_format`
- Default is 'YYYY-MM-DD'

### 14.3 Theme Preference

**Test Steps:**
- [ ] Open settings
- [ ] Change theme
- [ ] Verify theme applies

**Expected Results:**
- Theme changes immediately
- Preference saved
- Persists after refresh

**Verify:**
- Saved to `profiles.theme_preference`
- Default is 'dark'

### 14.4 Budget Alert Threshold

**Test Steps:**
- [ ] Open settings
- [ ] Set budget alert threshold (e.g., 80%)
- [ ] Add expenses to approach budget
- [ ] Verify alerts trigger

**Expected Results:**
- Alerts trigger at set threshold
- Toast notifications appear
- Threshold persists

## 15) Security & Permissions - *45 minutes*

### 15.1 Row Level Security (RLS)

**Test User A (Owner):**
- Can view own budgets
- Can create budgets
- Can edit/delete own budgets
- Can view own transactions
- Can create/edit/delete own transactions
- Can manage shared budget members
- Can generate invites

**Test User B (Member):**
- Can view shared budgets they're member of
- Cannot view other users' personal budgets
- Can view transactions in shared budgets
- Can create transactions in shared budgets
- Cannot delete shared budget
- Cannot remove members
- Cannot change member roles

**Test User C (Non-member):**
- Cannot view shared budgets they're not member of
- Cannot access shared budget data
- Cannot join without valid invite

**Verify:**
- Test each permission scenario
- Check RLS policies in database
- Verify UI shows/hides based on permissions

### 15.2 Invite Code Security

**Test Steps:**
- [ ] Generate invite code
- [ ] Verify code expires after set time
- [ ] Verify code can only be used once
- [ ] Verify invalid codes rejected

**Expected Results:**
- Codes expire after expiration date
- Used codes cannot be reused
- Invalid codes show error
- Codes are unique
- Codes are random (not predictable)

### 15.3 Data Isolation

**Test Steps:**
- [ ] User A creates data in Budget A
- [ ] User B creates data in Budget B
- [ ] Verify no data leakage

**Expected Results:**
- User A cannot see User B's data
- Budgets isolated
- Transactions isolated
- Categories isolated
- All data scoped to budget

## 16) Error Handling & Edge Cases - *30 minutes*

### 16.1 Network Errors

**Test Steps:**
- [ ] Disconnect network
- [ ] Try to create transaction
- [ ] Reconnect network
- [ ] Verify recovery

**Expected Results:**
- Error toast shown
- App doesn't crash
- Can retry after reconnection
- Data not lost (if queued)

### 16.2 Invalid Input

**Test Steps:**
- [ ] Try to submit forms with invalid data:
   - Empty required fields
   - Invalid email format
   - Negative amounts where not allowed
   - Future dates where not allowed
- [ ] Verify validation

**Expected Results:**
- Validation errors shown
- Forms don't submit
- Clear error messages
- Fields highlighted

### 16.3 Missing Data

**Test Steps:**
- [ ] Delete category that transactions use
- [ ] Verify transactions handle gracefully
- [ ] Try to load non-existent budget
- [ ] Verify error handling

**Expected Results:**
- Transactions show "Uncategorized" or similar
- Missing budget shows error or redirects
- No "Cannot read property" errors
- Graceful degradation

### 16.4 Concurrent Edits

**Test Steps:**
- [ ] User A and User B edit same transaction simultaneously
- [ ] Verify conflict resolution

**Expected Results:**
- Last write wins OR
- Conflict error shown OR
- Optimistic locking prevents conflicts
- Data remains consistent

### 16.5 Large Datasets

**Test Steps:**
- [ ] Import 1000+ transactions
- [ ] Verify performance
- [ ] Verify UI remains responsive

**Expected Results:**
- App remains responsive
- Rendering doesn't freeze
- Pagination or virtualization (if implemented)
- Charts handle large datasets

### 16.6 Browser Compatibility

**Test Steps:**
- [ ] Test in Chrome, Firefox, Safari, Edge
- [ ] Verify all features work

**Expected Results:**
- Core features work in all browsers
- No browser-specific errors
- CSS renders correctly
- JavaScript executes properly

---

## 17) Performance Testing - *30 minutes*

### 17.1 Page Load Performance

**Test Steps:**
- [ ] Open dashboard with fresh cache
- [ ] Measure load time
- [ ] Check network requests

**Expected Results:**
- Initial load < 3 seconds
- Data loads efficiently
- Minimal network requests
- No blocking resources

### 17.2 Data Loading Performance

**Test Steps:**
- [ ] Switch budgets
- [ ] Measure data load time
- [ ] Test with large datasets

**Expected Results:**
- Budget switch < 1 second
- Large datasets handled efficiently
- Pagination or virtualization for large lists
- No UI freezing

### 17.3 Chart Rendering Performance

**Test Steps:**
- [ ] Load dashboard with many transactions
- [ ] Verify charts render quickly
- [ ] Test chart interactions

**Expected Results:**
- Charts render < 2 seconds
- Interactions smooth (hover, click)
- No lag when updating data
- Charts handle 1000+ data points

### 17.4 Real-time Performance

**Test Steps:**
- [ ] Multiple users on shared budget
- [ ] Rapid changes
- [ ] Verify updates timely

**Expected Results:**
- Updates appear within 1-2 seconds
- No message backlog
- No performance degradation
- Handles rapid updates gracefully

## 18) Regression Testing Checklist

### Quick Smoke Test (5 minutes)
- [ ] Sign in successfully
- [ ] Create transaction
- [ ] Edit transaction
- [ ] Delete transaction
- [ ] Switch budgets
- [ ] View charts (no errors)
- [ ] Sign out

### Full Feature Test (30 minutes)
- [ ] Authentication: Sign up, sign in, sign out
- [ ] Budgets: Create personal, create shared, switch, delete
- [ ] Transactions: Add, edit, delete, search, filter, sort
- [ ] Categories: Create, edit, delete
- [ ] Goals: Create savings goal, add money, delete
- [ ] Financial Goals: Create, edit, delete
- [ ] Debts: Create, edit, delete
- [ ] Recurring: Create, edit, delete
- [ ] Import: CSV import, JSON import
- [ ] Export: JSON export
- [ ] Charts: All charts render without errors
- [ ] Real-time: Test with two users (if shared budget available)

### Comprehensive Test (2 hours)
- [ ] All features from Full Feature Test
- [ ] Shared Budget: Invite generation, joining, member management
- [ ] Bank Integration: Connect bank, import transactions
- [ ] Real-time: All real-time features with multiple users
- [ ] Edge Cases: Invalid input, network errors, large datasets
- [ ] Security: RLS permissions, data isolation
- [ ] Mobile: Responsive design, touch interactions
- [ ] Performance: Load times, large datasets
- [ ] Cross-browser: Chrome, Firefox, Safari, Edge

## 19) Test Data Preparation

### Sample Transactions
Create test transactions covering:
- Income transactions (various amounts, categories)
- Expense transactions (various amounts, categories, merchants)
- Transactions across multiple months
- Transactions with notes
- Transactions with different categories
- Large amounts and small amounts
- Transactions on different dates

### Sample Categories
- Income categories: Salary, Freelance, Investment
- Expense categories: Rent, Groceries, Transport, Fun, Bills
- Set monthly budgets for some categories
- Use different colors

### Sample Goals
- Savings goals with different targets
- Financial goals with different types
- Debts with interest rates
- Recurring transactions with different frequencies

### Sample Budgets
- Personal budget with data
- Shared budget with multiple members
- Empty budget (for testing empty states)

## 20) Automated Testing Considerations

### Unit Tests (Recommended)
- Service functions (transactionService, categoryService, etc.)
- Helper functions (formatMoney, formatDate, etc.)
- Data transformations
- Validation functions

### Integration Tests (Recommended)
- API calls to Supabase
- Real-time subscriptions
- Data migration
- Import/export functions

### E2E Tests (Optional)
- Critical user flows:
  - Sign up → Create transaction → View charts
  - Create shared budget → Invite user → Join → Add transaction
  - Import CSV → Verify data → Export JSON

## 21) Bug Reporting Template

When reporting bugs, include:

1. **Feature**: Which feature has the issue
2. **Steps to Reproduce**: Detailed steps
3. **Expected Result**: What should happen
4. **Actual Result**: What actually happens
5. **Environment**:
   - Browser and version
   - Device (desktop/mobile)
   - Supabase project
   - User role (owner/member)
6. **Console Errors**: Any errors in browser console
7. **Network Errors**: Any failed requests in Network tab
8. **Screenshots**: If applicable
9. **Data State**: What data was present when bug occurred

## 22) Testing Best Practices

1. **Test in Incognito/Private Mode**: Avoid cached data affecting tests
2. **Use Test Accounts**: Don't test with production data
3. **Clear Data Between Tests**: Start fresh for each major test
4. **Test Both Modes**: Supabase mode and localStorage fallback
5. **Test Permissions**: Test as owner, member, and non-member
6. **Test Real-time**: Always test with multiple users/browsers
7. **Test Mobile**: Don't just test desktop
8. **Test Edge Cases**: Invalid input, network errors, large data
9. **Verify Database**: Check database directly for data integrity
10. **Document Issues**: Keep track of bugs and fixes

---

## Summary

This testing guide covers **100+ features** across:
- Authentication & User Management (8 features)
- Budget Management (7 features)
- Shared Budget Collaboration (7 features)
- Transactions (10+ features)
- Categories (4 features)
- Goals & Planning (3 types, multiple features each)
- Recurring Transactions & Bills (4 features)
- Bank Integration (4 features)
- Real-time Features (7 features)
- Analytics & Visualization (7 features)
- Data Import/Export (5 features)
- UI/UX Features (8 features)
- Settings & Preferences (4 features)
- Security & Permissions (3 areas)
- Error Handling & Edge Cases (6 areas)
- Performance (4 areas)

**Total Test Cases**: 200+ individual test scenarios

---

## Total Estimated Testing Time

**Complete Comprehensive Testing**: **8-12 hours**

This includes:
- All feature testing (sections 1-16): ~7-9 hours
- Performance testing (section 17): ~30 minutes
- Regression testing (section 18): ~1-2 hours
- Test data preparation (section 19): ~30 minutes

**Quick Testing Options:**
- **Smoke Test** (critical features only): ~30-45 minutes
- **Full Feature Test** (all features once): ~3-4 hours
- **Deep Regression** (comprehensive + edge cases): ~8-12 hours

Use this guide to ensure comprehensive testing of all features before release or after major changes.

