# Accounts Feature Implementation Guide

## Overview
This document outlines the implementation of the Accounts, Credit Card Widget, and Net Worth tracking features for the Budget Dashboard. This guide provides a complete reference for what has been implemented and what integration steps remain.

---

## ✅ Completed Work

### 1. Database Schema (`sql/migrations/010_add_accounts_table.sql`)
- **Created `accounts` table** with columns:
  - `id` (UUID, primary key)
  - `budget_id` (UUID, foreign key to budgets)
  - `name` (text)
  - `type` (enum: checking, savings, credit_card, investment)
  - `current_balance` (decimal)
  - `credit_limit` (decimal, nullable - for credit cards only)
  - `created_at`, `updated_at` (timestamps)

- **Added `account_id` column** to `transactions` table
  - Nullable foreign key to accounts
  - Indexed for performance
  - SET NULL on delete (transactions remain when account is deleted)

- **Row Level Security (RLS) policies**:
  - Users can manage accounts in budgets they own or are members of
  - Full CRUD permissions for authorized users

- **Database triggers**:
  - Auto-update `updated_at` timestamp on account modifications

### 2. Services Layer

#### Account Service (`services/accountService.js` and `services/browser/accountService.browser.js`)
Implements full CRUD operations:
- `getAccounts(budgetId)` - Fetch all accounts for a budget
- `getAccount(accountId)` - Fetch single account
- `createAccount(budgetId, accountData)` - Create new account
- `updateAccount(accountId, updates)` - Update existing account
- `deleteAccount(accountId)` - Delete account
- `getAccountsByType(budgetId, type)` - Filter by account type
- `getCreditCardAccounts(budgetId)` - Get all credit cards
- `calculateAssets(budgetId)` - Sum checking + savings + investment balances
- `calculateCreditCardDebt(budgetId)` - Sum credit card balances
- `adjustAccountBalance(accountId, amount, type)` - Update balance based on transaction

### 3. Frontend Module (`js/accounts.js`)
Complete account management module with:

**Core Functions:**
- `initAccounts(deps)` - Initialize with dependencies
- `renderAccountsList()` - Render accounts in settings
- `openAddAccount()` - Open modal for new account
- `editAccount(accountId)` - Edit existing account
- `saveAccount()` - Save (create/update) account
- `deleteAccount()` - Delete account with confirmation
- `closeAccountModal()` - Close account modal
- `handleAccountTypeChange()` - Show/hide credit limit field

**Helper Functions:**
- `getAccounts()` - Get all accounts from state
- `getAccountById(accountId)` - Find account by ID
- `getCreditCardAccounts()` - Filter credit card accounts
- `calculateAssets()` - Calculate total assets
- `calculateCreditCardDebt()` - Calculate credit card debt
- `calculateNetWorth()` - Assets - (debts + credit cards)
- `getCreditUtilization(account)` - Calculate % of credit used
- `getCreditUtilizationStatus(utilization)` - Get status (low/medium/high)
- `renderAccountSelector(selectId, selectedAccountId)` - Populate account dropdown
- `createDefaultAccount()` - Create default checking account

### 4. Constants (`js/constants.js`)
Added account-related constants:
```javascript
ACCOUNT_TYPES = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  CREDIT_CARD: 'credit_card',
  INVESTMENT: 'investment'
}

ACCOUNT_TYPE_LABELS = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  investment: 'Investment'
}

CREDIT_UTILIZATION_THRESHOLDS = {
  LOW: 40,     // < 40% = good (green)
  MEDIUM: 70,  // 40-70% = caution (yellow)
  HIGH: 70     // > 70% = warning (red)
}

DEFAULT_ACCOUNT_NAMES = {
  CHECKING: 'Main Checking',
  CREDIT_CARD: 'Credit Card'
}
```

### 5. HTML Structure (`pages/DashBoard.html`)

#### Settings Modal - Accounts Section
Added after Categories section:
```html
<div class="settings-section">
  <h3>Accounts</h3>
  <div id="accountsList"></div>
  <button id="addAccountBtn" class="btn-secondary">+ Add Account</button>
</div>
```

#### Account Edit Modal
Complete form with:
- Account Name input
- Account Type selector (checking/savings/credit_card/investment)
- Current Balance input
- Credit Limit input (conditional - only for credit cards)
- Save/Cancel/Delete buttons

#### Transaction Form - Account Selector
Added optional account field:
```html
<div class="form-group form-group-full">
  <label for="drawerAccount">Account <span class="label-optional">(Optional)</span></label>
  <select id="drawerAccount"></select>
</div>
```

#### Transactions Filter - Account Filter
Added account filter dropdown:
```html
<select id="filterAccount" class="filter-select">
  <option value="">Account: All</option>
</select>
```

#### Overview Tab - Net Worth KPI
Added 5th KPI card:
```html
<div class="kpi-card">
  <h2>Net Worth</h2>
  <div class="value" id="kpiNetWorth">$0</div>
  <div class="kpi-breakdown" id="netWorthBreakdown">
    Assets: $0 | Liabilities: $0
  </div>
</div>
```

#### Overview Tab - Credit Card Widget
Added widget between KPIs and Sankey diagram:
```html
<div class="chart-box" id="creditCardWidget">
  <h2 class="chart-title">Credit Card</h2>
  <div id="creditCardContent"></div>
</div>
```

### 6. CSS Styles (`styles/styles.css`)
Complete styling for:

**Account Items:**
- `.account-item` - Container with flex layout
- `.account-name` - Bold account name
- `.account-type-badge` - Color-coded badges by account type
- `.account-balance` - Balance display
- `.account-credit-info` - Credit limit and utilization info
- `.account-actions` - Button container

**Credit Card Widget:**
- `.credit-card-container` - Widget container
- `.credit-card-header` - Title and actions
- `.credit-card-stats` - 2-column grid for stats
- `.credit-card-progress-bar` - Visual progress indicator
- `.credit-card-progress-fill` - Color-coded fill (green/yellow/red)
- `.credit-card-utilization` - Utilization percentage display
- `.credit-card-empty` - Empty state with link to settings

**Mobile Responsive:**
- KPI row: 2 columns on mobile (instead of 5)
- Credit card stats: Single column on mobile
- Reduced padding on smaller screens

---

## 🔧 Integration Steps Required

### Step 1: Run Database Migration
```bash
# Run the migration against your Supabase database
# Use Supabase Dashboard > SQL Editor, or supabase CLI
psql your-database < sql/migrations/010_add_accounts_table.sql
```

### Step 2: Update `app.js`
Import and initialize accounts module:

```javascript
// Add to imports
import {
  initAccounts,
  renderAccountsList,
  openAddAccount,
  saveAccount,
  deleteAccount,
  closeAccountModal,
  renderAccountSelector,
  calculateNetWorth,
  getCreditCardAccounts,
  getCreditUtilization,
  getCreditUtilizationStatus,
  createDefaultAccount
} from './accounts.js';
import { AccountServiceBrowser } from '../services/browser/accountService.browser.js';

// Create account service instance
let accountService = null;
if (useSupabase && window.supabase) {
  accountService = new AccountServiceBrowser(window.supabase);
}

// Initialize accounts module (after other modules)
initAccounts({
  accountService,
  currentBudget,
  useSupabase,
  loadDataFromSupabase,
  renderAll,
  onUpdate: (callback) => {
    // Register callback for dependency updates
    updateCallbacks.push(callback);
  }
});
```

### Step 3: Update `state-management.js`
Add accounts array to data structure:

```javascript
// In getDefaultData() function
function getDefaultData() {
  return {
    transactions: [],
    categories: deepClone(DEFAULT_CATEGORIES),
    savingsGoals: [],
    financialGoals: [],
    debts: [],
    recurringTransactions: [],
    accounts: []  // ADD THIS LINE
  };
}
```

### Step 4: Update `loadDataFromSupabase()` in `app.js`
Load accounts from Supabase:

```javascript
async function loadDataFromSupabase() {
  if (!currentBudget || !useSupabase) return;

  try {
    // ... existing code for transactions, categories, etc.

    // ADD: Load accounts
    const { data: accounts, error: accountsError } = await accountService.getAccounts(currentBudget.id);
    if (accountsError) {
      logger.error('Error loading accounts:', accountsError);
    }

    data.accounts = (accounts || []).map(acc => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      current_balance: parseFloat(acc.current_balance) || 0,
      currentBalance: parseFloat(acc.current_balance) || 0,
      credit_limit: acc.credit_limit ? parseFloat(acc.credit_limit) : null,
      creditLimit: acc.credit_limit ? parseFloat(acc.credit_limit) : null,
      created_at: acc.created_at
    }));

    // ... rest of existing code
  } catch (error) {
    logger.error('Error loading data from Supabase:', error);
  }
}
```

### Step 5: Update `ui-handlers.js`
Add event handlers for account management:

```javascript
function registerEventHandlers() {
  // ... existing handlers ...

  // ADD: Account handlers
  const addAccountBtn = document.getElementById('addAccountBtn');
  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', openAddAccount);
  }

  const saveAccountBtn = document.getElementById('saveAccountBtn');
  if (saveAccountBtn) {
    saveAccountBtn.addEventListener('click', saveAccount);
  }

  const cancelAccountBtn = document.getElementById('cancelAccountBtn');
  if (cancelAccountBtn) {
    cancelAccountBtn.addEventListener('click', closeAccountModal);
  }

  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', deleteAccount);
  }

  // Close account modal when clicking outside
  const accountModal = document.getElementById('accountModal');
  if (accountModal) {
    accountModal.addEventListener('click', (e) => {
      if (e.target === accountModal) {
        closeAccountModal();
      }
    });
  }
}
```

### Step 6: Update `ui-renderers.js`
Add render functions for widgets:

```javascript
import {
  calculateNetWorth,
  calculateAssets,
  calculateCreditCardDebt,
  getCreditCardAccounts,
  getCreditUtilization,
  getCreditUtilizationStatus
} from './accounts.js';

/**
 * Render Net Worth KPI
 */
export function renderNetWorthKPI() {
  const kpiNetWorth = document.getElementById('kpiNetWorth');
  const netWorthBreakdown = document.getElementById('netWorthBreakdown');

  if (!kpiNetWorth || !netWorthBreakdown) return;

  const netWorth = calculateNetWorth();
  const assets = calculateAssets();
  const creditCardDebt = calculateCreditCardDebt();

  // Get total debt from debts
  const data = stateManager.getActiveData();
  const debts = data.debts || [];
  const totalDebt = debts.reduce((sum, d) => {
    const balance = d.current_balance || d.currentBalance || 0;
    return sum + parseFloat(balance);
  }, 0);

  const liabilities = creditCardDebt + totalDebt;

  // Update KPI
  kpiNetWorth.textContent = formatMoney(netWorth);
  kpiNetWorth.style.color = netWorth >= 0 ? 'var(--success)' : 'var(--danger)';

  // Update breakdown
  netWorthBreakdown.textContent = `Assets: ${formatMoney(assets)} | Liabilities: ${formatMoney(liabilities)}`;
}

/**
 * Render Credit Card Widget
 */
export function renderCreditCardWidget() {
  const widget = document.getElementById('creditCardWidget');
  const content = document.getElementById('creditCardContent');

  if (!widget || !content) return;

  const creditCards = getCreditCardAccounts();

  if (creditCards.length === 0) {
    // Show empty state
    content.innerHTML = `
      <div class="credit-card-empty">
        <p>No credit card added yet.</p>
        <a href="#" onclick="window.openSettings(); return false;">Add a credit card in Settings</a>
      </div>
    `;
    widget.style.display = 'block';
    return;
  }

  // Show first credit card (can be enhanced to show all cards)
  const card = creditCards[0];
  const balance = parseFloat(card.current_balance || card.currentBalance || 0);
  const limit = parseFloat(card.credit_limit || card.creditLimit || 0);
  const available = limit - balance;
  const utilization = getCreditUtilization(card);
  const status = getCreditUtilizationStatus(utilization);

  content.innerHTML = `
    <div class="credit-card-container">
      <div class="credit-card-header">
        <div class="credit-card-name">${card.name}</div>
      </div>

      <div class="credit-card-stats">
        <div class="credit-card-stat">
          <div class="credit-card-stat-label">Balance Owed</div>
          <div class="credit-card-stat-value">${formatMoney(balance)}</div>
        </div>
        <div class="credit-card-stat">
          <div class="credit-card-stat-label">Credit Limit</div>
          <div class="credit-card-stat-value">${formatMoney(limit)}</div>
        </div>
        <div class="credit-card-stat">
          <div class="credit-card-stat-label">Available Credit</div>
          <div class="credit-card-stat-value">${formatMoney(available)}</div>
        </div>
        <div class="credit-card-stat">
          <div class="credit-card-stat-label">Utilization</div>
          <div class="credit-card-stat-value">${utilization.toFixed(1)}%</div>
        </div>
      </div>

      <div class="credit-card-progress">
        <div class="credit-card-progress-bar">
          <div class="credit-card-progress-fill utilization-${status}" style="width: ${utilization}%"></div>
        </div>
      </div>

      <div class="credit-card-utilization utilization-${status}">
        ${utilization < 40 ? '✓ Good utilization' : utilization < 70 ? '⚠ Moderate utilization' : '⚠ High utilization'}
      </div>
    </div>
  `;

  widget.style.display = 'block';
}

// Add to renderAll() function
export function renderAll() {
  // ... existing renders ...
  renderNetWorthKPI();
  renderCreditCardWidget();
  renderAccountsList();
}
```

### Step 7: Update Transaction Handling
Modify transaction create/update to include account_id:

```javascript
// In transactions.js - openDrawerForAdd() function
export function openDrawerForAdd() {
  // ... existing code ...

  // ADD: Populate account selector
  renderAccountSelector('drawerAccount');
}

// In transactions.js - openDrawerForEdit() function
export function openDrawerForEdit(transactionId) {
  // ... existing code ...

  // ADD: Populate and select account
  renderAccountSelector('drawerAccount', t.account_id || t.accountId);
}

// In transactions.js - saveTransaction() function
export async function saveTransaction() {
  // ... existing code ...

  const accountId = document.getElementById('drawerAccount')?.value || null;

  const transactionData = {
    date,
    description,
    amount,
    type,
    category_id: categoryId,
    account_id: accountId,  // ADD THIS
    merchant,
    note
  };

  // ... rest of save logic ...
}
```

### Step 8: Add Account Filter to Transactions
Update transaction filtering logic:

```javascript
// In transactions.js - getFilteredTransactions() function
export function getFilteredTransactions() {
  // ... existing filters ...

  // ADD: Filter by account
  const accountSelect = document.getElementById("filterAccount");
  const accountFilter = accountSelect ? accountSelect.value : "";
  if (accountFilter) {
    tx = tx.filter(t => {
      const txAccountId = t.account_id || t.accountId;
      return txAccountId === accountFilter;
    });
  }

  return tx;
}

// In categories.js - renderCategoryFilters() function
export function renderCategoryFilters() {
  // ... existing code ...

  // ADD: Render account filter
  const accountSelect = document.getElementById("filterAccount");
  if (accountSelect) {
    renderAccountSelector('filterAccount');
  }
}
```

### Step 9: Add Real-time Subscriptions (Optional - for Supabase)
Add accounts table subscription in `app.js`:

```javascript
function setupRealtimeSubscriptions() {
  if (!useSupabase || !window.supabase || !currentBudget) return;

  // ... existing subscriptions ...

  // ADD: Subscribe to accounts changes
  const accountsChannel = window.supabase
    .channel('accounts-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'accounts',
        filter: `budget_id=eq.${currentBudget.id}`
      },
      async (payload) => {
        logger.info('Accounts changed:', payload);
        await loadDataFromSupabase();
        renderAll();
      }
    )
    .subscribe();

  subscriptions.push(accountsChannel);
}
```

### Step 10: Default Account Creation
Add logic to create default account for new budgets:

```javascript
// In app.js - after budget creation or migration
async function onBudgetCreated(budgetId) {
  // ... existing code ...

  // ADD: Create default checking account
  if (useSupabase && accountService) {
    const { data: accounts } = await accountService.getAccounts(budgetId);
    if (!accounts || accounts.length === 0) {
      await createDefaultAccount();
      await loadDataFromSupabase();
    }
  }
}
```

### Step 11: Sync Credit Cards with Debts (Optional Enhancement)
In `debts.js - renderDebts()` function, you can optionally include credit card accounts:

```javascript
export function renderDebts() {
  const container = document.getElementById('debtList');
  if (!container) return;

  const debts = stateManager.getActiveData().debts || [];
  const creditCards = getCreditCardAccounts();

  // Combine debts and credit cards
  const allLiabilities = [
    ...debts,
    ...creditCards.map(card => ({
      id: card.id,
      name: card.name,
      currentBalance: card.current_balance || card.currentBalance || 0,
      type: 'credit_card',
      interestRate: 0,
      minPayment: 0,
      isAccount: true // Flag to distinguish from regular debt
    }))
  ];

  // ... render combined list ...
}
```

---

## 🧪 Testing Checklist

### Database
- [ ] Migration runs successfully
- [ ] RLS policies work correctly
- [ ] Account deletion sets transactions.account_id to NULL

### Account Management
- [ ] Can create checking account
- [ ] Can create savings account
- [ ] Can create credit card with limit
- [ ] Can create investment account
- [ ] Credit limit field shows/hides based on type
- [ ] Can edit account
- [ ] Can delete account
- [ ] Accounts list renders in settings

### Transactions
- [ ] Account selector populates in transaction form
- [ ] Can create transaction with account
- [ ] Can create transaction without account
- [ ] Account filter works
- [ ] Editing transaction preserves account

### Widgets
- [ ] Net Worth KPI shows correct calculation
- [ ] Net Worth breakdown shows assets and liabilities
- [ ] Credit card widget shows for credit card accounts
- [ ] Credit card widget shows empty state when no cards
- [ ] Utilization progress bar colors correctly (green/yellow/red)
- [ ] Link to settings works in empty state

### Real-time (Supabase)
- [ ] Account changes sync across sessions
- [ ] Widgets update when accounts change
- [ ] No duplicate subscriptions

### Mobile
- [ ] KPI row shows 2 columns on mobile
- [ ] Credit card widget is readable on mobile
- [ ] Account modal is usable on mobile
- [ ] All buttons are touch-friendly

---

## 📊 Data Structure Reference

### Account Object (Supabase)
```javascript
{
  id: "uuid",
  budget_id: "uuid",
  name: "Chase Checking",
  type: "checking", // or "savings", "credit_card", "investment"
  current_balance: 1500.00,
  credit_limit: null, // or number for credit cards
  created_at: "2025-12-25T10:00:00Z",
  updated_at: "2025-12-25T10:00:00Z"
}
```

### Account Object (localStorage)
```javascript
{
  id: "acc_1234567890",
  name: "Chase Checking",
  type: "checking",
  currentBalance: 1500.00,
  creditLimit: null
}
```

### Transaction with Account
```javascript
{
  id: "uuid",
  account_id: "uuid", // or null
  // ... other transaction fields
}
```

---

## 🎨 UI/UX Notes

### Color Coding
- **Checking**: Blue (#60a5fa)
- **Savings**: Green (#4ade80)
- **Credit Card**: Yellow (#fbbf24)
- **Investment**: Purple (#c084fc)

### Credit Utilization Thresholds
- **< 40%**: Green (Good)
- **40-70%**: Yellow (Caution)
- **> 70%**: Red (Warning)

### Empty States
- Credit card widget: Shows link to settings
- Accounts list: Shows "No accounts yet" message

---

## 🚀 Next Steps

1. **Run migration** against Supabase database
2. **Follow integration steps** 1-11 above
3. **Test thoroughly** using checklist
4. **Commit changes** with descriptive message
5. **Create pull request** for review

---

## 💡 Future Enhancements

- Multiple credit card support in widget (carousel/tabs)
- Account-based budgeting (per account)
- Account balance history/trends chart
- Automatic balance updates from transactions
- Account reconciliation feature
- Import/export account data
- Account-to-account transfers
- Account-based reports

---

## 🐛 Troubleshooting

### Accounts not loading
- Check migration ran successfully
- Verify RLS policies are enabled
- Check browser console for errors
- Verify `accountService` is initialized

### Credit card widget not showing
- Check if credit card accounts exist
- Verify `getCreditCardAccounts()` returns data
- Check `renderCreditCardWidget()` is called in `renderAll()`

### Net worth calculation incorrect
- Verify assets calculation includes all account types
- Check debts are being summed correctly
- Ensure credit card balances are included in liabilities

---

## 📝 Notes

- All account balances are stored as positive numbers
- Credit card balances represent amount OWED (liability)
- Net Worth = Assets - Liabilities
- Accounts are budget-scoped (one budget's accounts don't affect another)
- Account deletion is safe (sets transaction.account_id to NULL)
- Real-time subscriptions require Supabase setup

---

## ✅ Commit Message Template

```
feat: Add accounts, credit cards, and net worth tracking

- Add accounts table with RLS policies
- Create account service with full CRUD operations
- Implement account management UI in settings
- Add account selector to transaction form
- Add account filter to transactions list
- Create credit card widget with utilization tracking
- Add net worth KPI with assets/liabilities breakdown
- Add responsive styling for all new components
- Support for checking, savings, credit card, and investment accounts

Database changes:
- New accounts table
- account_id column in transactions table
- RLS policies for multi-user support

Features:
- Create/edit/delete accounts
- Track credit card utilization
- Calculate net worth automatically
- Filter transactions by account
- Link transactions to accounts
```

---

**Implementation Status**: Foundation Complete - Integration Required
**Estimated Integration Time**: 2-3 hours
**Difficulty**: Intermediate

