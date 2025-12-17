# Supabase Integration Implementation Guide

This guide explains how to integrate Supabase authentication and shared budgets into the Budget Dashboard.

## Overview

The integration adds:
- ✅ User authentication (sign up, sign in, password reset)
- ✅ Personal budgets (one per user, created automatically)
- ✅ Shared budgets (multiple users can collaborate)
- ✅ Real-time sync for shared budgets
- ✅ Data migration from localStorage to Supabase
- ✅ Budget switching interface
- ✅ User attribution on transactions

## File Structure

```
Budgeting/
├── supabase-config.js          # Supabase client configuration
├── supabase-service.js         # All database operations
├── supabase-integration.js      # Auth & budget management
├── migration-utility.js        # localStorage → Supabase migration
├── database-schema.sql         # Complete database schema
├── auth.html                   # Login/signup page
├── DashBoard.html              # Main dashboard (updated)
├── script.js                   # Main app logic (needs integration)
├── SETUP-SUPABASE.md           # Setup instructions
└── IMPLEMENTATION-GUIDE.md     # This file
```

## Implementation Steps

### Phase 1: Setup (✅ Complete)

1. ✅ Install Supabase client: `npm install @supabase/supabase-js`
2. ✅ Create database schema in Supabase SQL Editor
3. ✅ Set up environment variables
4. ✅ Create authentication page
5. ✅ Create service modules

### Phase 2: Integrate Authentication

**Update `script.js` to check authentication on load:**

```javascript
// At the top of script.js, add:
import { initAuth, currentUser, currentBudget } from './supabase-integration.js';

// Replace the initial loadState() call with:
(async function init() {
  const authenticated = await initAuth();
  if (!authenticated) {
    return; // Will redirect to auth.html
  }
  
  // Continue with existing initialization
  loadState(); // Keep for backward compatibility during migration
  renderAll();
})();
```

### Phase 3: Replace localStorage with Supabase

**Create a data adapter layer in `script.js`:**

```javascript
// Add this after the state initialization
let useSupabase = false; // Toggle between localStorage and Supabase

async function loadData() {
  if (useSupabase && currentBudget) {
    // Load from Supabase
    const { data: transactions } = await transactionService.getTransactions(currentBudget.id);
    const { data: categories } = await categoryService.getCategories(currentBudget.id);
    // ... load other data
    
    // Update state
    state.dataByProfile[currentBudget.id] = {
      transactions: transactions || [],
      categories: categories || [],
      // ... other data
    };
  } else {
    // Fallback to localStorage
    loadState();
  }
}

async function saveData() {
  if (useSupabase && currentBudget && currentUser) {
    // Save to Supabase (transactions are saved individually)
    // Categories, goals, etc. are saved when modified
  } else {
    // Fallback to localStorage
    saveState();
  }
}
```

### Phase 4: Update Transaction Functions

**Modify transaction CRUD operations:**

```javascript
// Update saveTransactionFromDrawer function
async function saveTransactionFromDrawer() {
  // ... validation code ...
  
  if (useSupabase && currentBudget && currentUser) {
    if (editTransactionId) {
      await transactionService.updateTransaction(editTransactionId, {
        date, description: desc, amount: amt, type, category_id: cat, merchant, notes
      });
    } else {
      await transactionService.createTransaction(currentBudget.id, currentUser.id, {
        date, description: desc, amount: amt, type, category_id: cat, merchant, notes
      });
    }
  } else {
    // Existing localStorage code
  }
  
  renderAll();
}
```

### Phase 5: Add Budget Management UI

**Add event listeners in `script.js`:**

```javascript
// Budget selector
document.getElementById('budgetSelect')?.addEventListener('change', async (e) => {
  await switchBudget(e.target.value);
});

// Create budget button
document.getElementById('createBudgetBtn')?.addEventListener('click', () => {
  document.getElementById('budgetModal').classList.add('show');
});

// Save budget
document.getElementById('saveBudgetBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('budgetNameInput').value;
  const type = document.getElementById('budgetTypeInput').value;
  await createBudget(name, type);
  document.getElementById('budgetModal').classList.remove('show');
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to sign out?')) {
    await logout();
  }
});
```

### Phase 6: Add Real-Time Sync

**Add real-time subscriptions for shared budgets:**

```javascript
import { realtimeService } from './supabase-service.js';

let realtimeChannel = null;

function setupRealtime(budgetId) {
  if (realtimeChannel) {
    realtimeService.unsubscribe(realtimeChannel);
  }

  if (currentBudget?.type === 'shared') {
    realtimeChannel = realtimeService.subscribeToTransactions(budgetId, (payload) => {
      if (payload.eventType === 'INSERT') {
        showToast(`${payload.new.user?.display_name || 'Someone'} added a transaction`, 'Update');
      } else if (payload.eventType === 'UPDATE') {
        showToast(`Transaction updated`, 'Update');
      } else if (payload.eventType === 'DELETE') {
        showToast(`Transaction deleted`, 'Update');
      }
      renderAll(); // Refresh data
    });
  }
}
```

### Phase 7: Add Shared Budget Features

**Implement invite system:**

```javascript
import { inviteService } from './supabase-service.js';

// Join budget
document.getElementById('joinBudgetBtn')?.addEventListener('click', async () => {
  const code = document.getElementById('inviteCodeInput').value.toUpperCase();
  const { data: invite } = await inviteService.getInvite(code);
  
  if (!invite) {
    showToast('Invalid or expired invite code', 'Error');
    return;
  }
  
  await budgetService.addMember(invite.budget_id, currentUser.id);
  await inviteService.useInvite(code, currentUser.id);
  await loadUserData();
  showToast('Joined budget successfully!', 'Success');
});
```

## Migration Strategy

1. **Dual Mode**: App works with both localStorage and Supabase
2. **Gradual Migration**: Users can migrate data when ready
3. **Backward Compatible**: Existing users without accounts still work
4. **New Users**: Automatically use Supabase

## Testing Checklist

- [ ] User can sign up
- [ ] User can sign in
- [ ] Personal budget is created automatically
- [ ] User can create shared budget
- [ ] User can generate invite code
- [ ] User can join budget with invite code
- [ ] Transactions sync in real-time for shared budgets
- [ ] User attribution shows on shared budget transactions
- [ ] Budget switching works
- [ ] Data migration from localStorage works
- [ ] Logout works and redirects to auth page

## Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PORT=3000
```

## Next Steps

1. **Complete Integration**: Update `script.js` to use Supabase services
2. **Test Authentication**: Verify login/signup flow
3. **Test Data Operations**: Verify CRUD operations work
4. **Test Real-Time**: Open two browsers and verify sync
5. **Test Migration**: Import existing localStorage data
6. **Deploy**: Update environment variables for production

## Important Notes

- **RLS Policies**: All data access is controlled by Row Level Security
- **Real-Time**: Only enabled for shared budgets to save resources
- **Migration**: One-time process, localStorage cleared after migration
- **Backward Compatibility**: App can work offline with localStorage fallback

## Support

If you encounter issues:
1. Check Supabase dashboard for errors
2. Verify RLS policies are enabled
3. Check browser console for JavaScript errors
4. Verify environment variables are set correctly
5. Check Supabase logs in dashboard

