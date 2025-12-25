/**
 * Accounts Module
 * Handles account CRUD operations, rendering, and balance calculations
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, showToast } from './utils.js';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, CREDIT_UTILIZATION_THRESHOLDS, DEFAULT_ACCOUNT_NAMES } from './constants.js';

// Module-level state
let editingAccountId = null;

// External dependencies (will be injected)
let accountService = null;
let currentBudget = null;
let useSupabase = false;
let loadDataFromSupabase = null;
let renderAll = null;

/**
 * Initialize accounts module with dependencies
 * @param {Object} deps - Dependencies object
 */
export function initAccounts(deps) {
  accountService = deps.accountService;
  currentBudget = deps.currentBudget;
  useSupabase = deps.useSupabase;
  loadDataFromSupabase = deps.loadDataFromSupabase;
  renderAll = deps.renderAll;

  // Update when dependencies change
  if (deps.onUpdate) {
    deps.onUpdate(() => {
      currentBudget = deps.currentBudget;
      useSupabase = deps.useSupabase;
    });
  }
}

/**
 * Render accounts list in settings
 */
export function renderAccountsList() {
  const container = document.getElementById('accountsList');
  if (!container) return;

  const accounts = stateManager.getActiveData().accounts || [];
  container.innerHTML = '';

  if (accounts.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No accounts yet. Add an account to get started.</p>';
    return;
  }

  accounts.forEach(account => {
    const div = document.createElement('div');
    div.className = 'account-item';

    const typeLabel = ACCOUNT_TYPE_LABELS[account.type] || account.type;
    const balance = account.current_balance || account.currentBalance || 0;
    const creditLimit = account.credit_limit || account.creditLimit || null;

    let additionalInfo = '';
    if (account.type === ACCOUNT_TYPES.CREDIT_CARD && creditLimit) {
      const utilization = (balance / creditLimit * 100).toFixed(1);
      additionalInfo = `<div class="account-credit-info">Limit: ${formatMoney(creditLimit)} | Utilization: ${utilization}%</div>`;
    }

    div.innerHTML = `
      <div class="account-info">
        <div class="account-name">${account.name}</div>
        <div class="account-type-badge badge-${account.type}">${typeLabel}</div>
        <div class="account-balance">Balance: ${formatMoney(balance)}</div>
        ${additionalInfo}
      </div>
      <div class="account-actions">
        <button onclick="window.accountModule.editAccount('${account.id}')" class="btn-primary" style="padding:5px 10px; border:none; border-radius:4px; cursor:pointer;">Edit</button>
      </div>
    `;

    container.appendChild(div);
  });
}

/**
 * Open add account modal
 */
export function openAddAccount() {
  editingAccountId = null;
  const modalTitle = document.getElementById('accountModalTitle');
  const nameInput = document.getElementById('accountNameInput');
  const typeInput = document.getElementById('accountTypeInput');
  const balanceInput = document.getElementById('accountBalanceInput');
  const creditLimitInput = document.getElementById('accountCreditLimitInput');
  const creditLimitGroup = document.getElementById('accountCreditLimitGroup');
  const deleteBtn = document.getElementById('deleteAccountBtn');
  const modal = document.getElementById('accountModal');

  if (modalTitle) modalTitle.textContent = 'Add Account';
  if (nameInput) nameInput.value = '';
  if (typeInput) typeInput.value = ACCOUNT_TYPES.CHECKING;
  if (balanceInput) balanceInput.value = '0';
  if (creditLimitInput) creditLimitInput.value = '';
  if (creditLimitGroup) creditLimitGroup.style.display = 'none';
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (modal) modal.classList.add('show');
}

/**
 * Edit account
 * @param {string} accountId - Account ID
 */
export function editAccount(accountId) {
  const accounts = stateManager.getActiveData().accounts || [];
  const account = accounts.find(a => a.id === accountId);
  if (!account) return;

  editingAccountId = accountId;
  const modalTitle = document.getElementById('accountModalTitle');
  const nameInput = document.getElementById('accountNameInput');
  const typeInput = document.getElementById('accountTypeInput');
  const balanceInput = document.getElementById('accountBalanceInput');
  const creditLimitInput = document.getElementById('accountCreditLimitInput');
  const creditLimitGroup = document.getElementById('accountCreditLimitGroup');
  const deleteBtn = document.getElementById('deleteAccountBtn');
  const modal = document.getElementById('accountModal');

  if (modalTitle) modalTitle.textContent = 'Edit Account';
  if (nameInput) nameInput.value = account.name;
  if (typeInput) typeInput.value = account.type;
  if (balanceInput) balanceInput.value = account.current_balance || account.currentBalance || 0;

  const creditLimit = account.credit_limit || account.creditLimit || null;
  if (creditLimitInput) creditLimitInput.value = creditLimit || '';

  // Show/hide credit limit field based on account type
  if (creditLimitGroup) {
    creditLimitGroup.style.display = account.type === ACCOUNT_TYPES.CREDIT_CARD ? 'block' : 'none';
  }

  if (deleteBtn) deleteBtn.style.display = 'block';
  if (modal) modal.classList.add('show');
}

/**
 * Handle account type change (show/hide credit limit field)
 */
export function handleAccountTypeChange() {
  const typeInput = document.getElementById('accountTypeInput');
  const creditLimitGroup = document.getElementById('accountCreditLimitGroup');

  if (!typeInput || !creditLimitGroup) return;

  const type = typeInput.value;
  creditLimitGroup.style.display = type === ACCOUNT_TYPES.CREDIT_CARD ? 'block' : 'none';
}

/**
 * Save account (create or update)
 */
export async function saveAccount() {
  const nameInput = document.getElementById('accountNameInput');
  const typeInput = document.getElementById('accountTypeInput');
  const balanceInput = document.getElementById('accountBalanceInput');
  const creditLimitInput = document.getElementById('accountCreditLimitInput');

  if (!nameInput || !typeInput || !balanceInput) {
    showToast('Account form elements not found', 'Error');
    return;
  }

  const name = nameInput.value.trim();
  const type = typeInput.value;
  const balance = parseFloat(balanceInput.value) || 0;
  const creditLimit = type === ACCOUNT_TYPES.CREDIT_CARD ? (parseFloat(creditLimitInput.value) || null) : null;

  if (!name) {
    showToast('Account name is required', 'Error');
    return;
  }

  if (type === ACCOUNT_TYPES.CREDIT_CARD && (!creditLimit || creditLimit <= 0)) {
    showToast('Credit limit is required for credit card accounts', 'Error');
    return;
  }

  if (useSupabase && currentBudget && accountService) {
    // Use Supabase
    try {
      const accountData = {
        name,
        type,
        current_balance: balance,
        credit_limit: creditLimit
      };

      if (editingAccountId) {
        // Update existing
        const { error } = await accountService.updateAccount(editingAccountId, accountData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Account updated');
      } else {
        // Create new
        const { data: newAccount, error } = await accountService.createAccount(currentBudget.id, accountData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Account added');
      }

      // Reload data from Supabase
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error saving account:', error);
      showToast(`Error saving account: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (!data.accounts) data.accounts = [];

    if (editingAccountId) {
      // Edit existing
      const account = data.accounts.find(a => a.id === editingAccountId);
      if (account) {
        account.name = name;
        account.type = type;
        account.currentBalance = balance;
        account.creditLimit = creditLimit;
      }
    } else {
      // Add new
      const newId = `acc_${Date.now()}`;
      data.accounts.push({
        id: newId,
        name,
        type,
        currentBalance: balance,
        creditLimit
      });
    }

    stateManager.setActiveData(data);
  }

  if (renderAll) {
    renderAll();
  }
  renderAccountsList();
  closeAccountModal();
}

/**
 * Delete account
 */
export async function deleteAccount() {
  if (!editingAccountId) return;

  const accounts = stateManager.getActiveData().accounts || [];
  const accountName = accounts.find(a => a.id === editingAccountId)?.name;

  if (!confirm(`Delete account "${accountName}"? Transactions linked to this account will not be deleted.`)) {
    return;
  }

  if (useSupabase && accountService) {
    // Use Supabase
    try {
      const { error } = await accountService.deleteAccount(editingAccountId);
      if (error) {
        showToast(`Error: ${error.message}`, 'Error');
        return;
      }

      showToast('Account deleted');

      // Reload data from Supabase
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting account:', error);
      showToast(`Error deleting account: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (data.accounts) {
      data.accounts = data.accounts.filter(a => a.id !== editingAccountId);
    }
    stateManager.setActiveData(data);
    showToast('Account deleted');
  }

  if (renderAll) {
    renderAll();
  }
  renderAccountsList();
  closeAccountModal();
}

/**
 * Close account modal
 */
export function closeAccountModal() {
  const modal = document.getElementById('accountModal');
  if (modal) {
    modal.classList.remove('show');
  }
  editingAccountId = null;
}

/**
 * Get all accounts
 * @returns {Array} Accounts array
 */
export function getAccounts() {
  return stateManager.getActiveData().accounts || [];
}

/**
 * Get account by ID
 * @param {string} accountId - Account ID
 * @returns {Object|null} Account object or null
 */
export function getAccountById(accountId) {
  const accounts = getAccounts();
  return accounts.find(a => a.id === accountId) || null;
}

/**
 * Get credit card accounts
 * @returns {Array} Credit card accounts array
 */
export function getCreditCardAccounts() {
  const accounts = getAccounts();
  return accounts.filter(a => a.type === ACCOUNT_TYPES.CREDIT_CARD);
}

/**
 * Calculate total assets (checking + savings + investment)
 * @returns {number} Total assets
 */
export function calculateAssets() {
  const accounts = getAccounts();
  return accounts
    .filter(a => [ACCOUNT_TYPES.CHECKING, ACCOUNT_TYPES.SAVINGS, ACCOUNT_TYPES.INVESTMENT].includes(a.type))
    .reduce((sum, a) => sum + (parseFloat(a.current_balance || a.currentBalance || 0)), 0);
}

/**
 * Calculate total credit card debt
 * @returns {number} Total credit card debt
 */
export function calculateCreditCardDebt() {
  const accounts = getAccounts();
  return accounts
    .filter(a => a.type === ACCOUNT_TYPES.CREDIT_CARD)
    .reduce((sum, a) => sum + (parseFloat(a.current_balance || a.currentBalance || 0)), 0);
}

/**
 * Calculate net worth (assets - liabilities)
 * Liabilities = debts + credit card balances
 * @returns {number} Net worth
 */
export function calculateNetWorth() {
  const assets = calculateAssets();
  const creditCardDebt = calculateCreditCardDebt();

  // Get debts from state
  const data = stateManager.getActiveData();
  const debts = data.debts || [];
  const totalDebt = debts.reduce((sum, d) => {
    const balance = d.current_balance || d.currentBalance || 0;
    return sum + parseFloat(balance);
  }, 0);

  return assets - (creditCardDebt + totalDebt);
}

/**
 * Get credit utilization percentage
 * @param {Object} account - Credit card account
 * @returns {number} Utilization percentage (0-100)
 */
export function getCreditUtilization(account) {
  const balance = parseFloat(account.current_balance || account.currentBalance || 0);
  const limit = parseFloat(account.credit_limit || account.creditLimit || 0);

  if (limit <= 0) return 0;
  return (balance / limit) * 100;
}

/**
 * Get credit utilization status (low, medium, high)
 * @param {number} utilization - Utilization percentage
 * @returns {string} Status: 'low', 'medium', or 'high'
 */
export function getCreditUtilizationStatus(utilization) {
  if (utilization < CREDIT_UTILIZATION_THRESHOLDS.LOW) return 'low';
  if (utilization < CREDIT_UTILIZATION_THRESHOLDS.MEDIUM) return 'medium';
  return 'high';
}

/**
 * Render account selector (for transaction forms)
 * @param {string} selectId - ID of select element
 * @param {string} selectedAccountId - Currently selected account ID
 */
export function renderAccountSelector(selectId, selectedAccountId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const accounts = getAccounts();

  select.innerHTML = '<option value="">No Account</option>';

  accounts.forEach(account => {
    const option = document.createElement('option');
    option.value = account.id;
    const typeLabel = ACCOUNT_TYPE_LABELS[account.type] || account.type;
    option.textContent = `${account.name} (${typeLabel})`;

    if (selectedAccountId && account.id === selectedAccountId) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

/**
 * Create default checking account
 * @returns {Promise<boolean>} Success status
 */
export async function createDefaultAccount() {
  if (useSupabase && currentBudget && accountService) {
    try {
      const { data, error } = await accountService.createAccount(currentBudget.id, {
        name: DEFAULT_ACCOUNT_NAMES.CHECKING,
        type: ACCOUNT_TYPES.CHECKING,
        current_balance: 0
      });

      if (error) {
        logger.error('Error creating default account:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error creating default account:', error);
      return false;
    }
  } else {
    // localStorage mode
    const data = stateManager.getActiveData();
    if (!data.accounts) data.accounts = [];

    data.accounts.push({
      id: `acc_${Date.now()}`,
      name: DEFAULT_ACCOUNT_NAMES.CHECKING,
      type: ACCOUNT_TYPES.CHECKING,
      currentBalance: 0
    });

    stateManager.setActiveData(data);
    return true;
  }
}

// Export module to window for onclick handlers
if (typeof window !== 'undefined') {
  window.accountModule = {
    editAccount,
    handleAccountTypeChange
  };
}
