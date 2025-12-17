/**
 * Debts Module
 * Handles debt CRUD operations, rendering, and payment tracking
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, formatDate, showToast, generateId } from './utils.js';

// Module-level state
let editingDebtId = null;

// External dependencies (will be injected)
let debtService = null;
let currentBudget = null;
let useSupabase = false;
let loadDataFromSupabase = null;
let renderAll = null;

/**
 * Initialize debts module with dependencies
 * @param {Object} deps - Dependencies object
 */
export function initDebts(deps) {
  debtService = deps.debtService;
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
 * Render debts list
 */
export function renderDebts() {
  const container = document.getElementById('debtList');
  if (!container) return;
  
  const debts = stateManager.getActiveData().debts || [];
  container.innerHTML = '';
  
  if (debts.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No debts tracked yet.</p>';
    return;
  }
  
  debts.forEach(d => {
    const div = document.createElement('div');
    div.className = 'debt-item';
    const currentBalance = d.currentBalance || d.current_balance || 0;
    const originalBalance = d.originalBalance || d.original_balance || currentBalance;
    const percentPaid = originalBalance ? ((originalBalance - currentBalance) / originalBalance * 100) : 0;
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <strong>${d.name}</strong>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            Balance: ${formatMoney(currentBalance)} | Interest: ${d.interestRate || d.interest_rate || 0}% | Min Payment: ${formatMoney(d.minPayment || d.min_payment || 0)}
          </div>
        </div>
        <div>
          <button class="editDebtBtn" data-id="${d.id}" style="margin-right: 6px;">Edit</button>
          <button class="deleteDebtBtn" data-id="${d.id}">Delete</button>
        </div>
      </div>
      <div class="debt-progress">
        <div class="debt-progress-fill" style="width: ${Math.min(100, percentPaid)}%"></div>
      </div>
      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
        ${percentPaid.toFixed(1)}% paid off
      </div>
    `;
    container.appendChild(div);
  });
  
  container.querySelectorAll('.editDebtBtn').forEach(btn => {
    btn.addEventListener('click', () => editDebt(btn.dataset.id));
  });
  
  container.querySelectorAll('.deleteDebtBtn').forEach(btn => {
    btn.addEventListener('click', () => deleteDebt(btn.dataset.id));
  });
}

/**
 * Open add debt modal
 */
export function openAddDebt() {
  editingDebtId = null;
  const modalTitle = document.getElementById('debtModalTitle');
  const nameInput = document.getElementById('debtNameInput');
  const balanceInput = document.getElementById('debtBalanceInput');
  const interestInput = document.getElementById('debtInterestInput');
  const minPaymentInput = document.getElementById('debtMinPaymentInput');
  const targetDateInput = document.getElementById('debtTargetDateInput');
  const deleteBtn = document.getElementById('deleteDebtBtn');
  const modal = document.getElementById('debtModal');
  
  if (modalTitle) modalTitle.textContent = 'Add Debt';
  if (nameInput) nameInput.value = '';
  if (balanceInput) balanceInput.value = '';
  if (interestInput) interestInput.value = '';
  if (minPaymentInput) minPaymentInput.value = '';
  if (targetDateInput) targetDateInput.value = '';
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (modal) modal.classList.add('show');
}

/**
 * Edit debt
 * @param {string} id - Debt ID
 */
export function editDebt(id) {
  const debts = stateManager.getActiveData().debts || [];
  const d = debts.find(x => x.id === id);
  if (!d) return;
  
  editingDebtId = id;
  const modalTitle = document.getElementById('debtModalTitle');
  const nameInput = document.getElementById('debtNameInput');
  const balanceInput = document.getElementById('debtBalanceInput');
  const interestInput = document.getElementById('debtInterestInput');
  const minPaymentInput = document.getElementById('debtMinPaymentInput');
  const targetDateInput = document.getElementById('debtTargetDateInput');
  const deleteBtn = document.getElementById('deleteDebtBtn');
  const modal = document.getElementById('debtModal');
  
  if (modalTitle) modalTitle.textContent = 'Edit Debt';
  if (nameInput) nameInput.value = d.name;
  if (balanceInput) balanceInput.value = d.currentBalance || d.current_balance || 0;
  if (interestInput) interestInput.value = d.interestRate || d.interest_rate || 0;
  if (minPaymentInput) minPaymentInput.value = d.minPayment || d.min_payment || 0;
  if (targetDateInput) targetDateInput.value = d.targetDate || d.target_date || '';
  if (deleteBtn) deleteBtn.style.display = 'block';
  if (modal) modal.classList.add('show');
}

/**
 * Save debt (create or update)
 */
export async function saveDebt() {
  const nameInput = document.getElementById('debtNameInput');
  const balanceInput = document.getElementById('debtBalanceInput');
  const interestInput = document.getElementById('debtInterestInput');
  const minPaymentInput = document.getElementById('debtMinPaymentInput');
  const targetDateInput = document.getElementById('debtTargetDateInput');
  
  if (!nameInput || !balanceInput || !interestInput || !minPaymentInput || !targetDateInput) {
    showToast('Debt form elements not found', 'Error');
    return;
  }
  
  const name = nameInput.value.trim();
  const balance = parseFloat(balanceInput.value);
  const interest = parseFloat(interestInput.value) || 0;
  const minPayment = parseFloat(minPaymentInput.value) || 0;
  const targetDate = targetDateInput.value;
  
  if (!name || isNaN(balance) || balance <= 0) {
    showToast('Please fill all required fields', 'Error');
    return;
  }
  
  if (useSupabase && currentBudget && debtService) {
    // Use Supabase
    try {
      const debtData = {
        name,
        current_balance: balance,
        interest_rate: interest,
        min_payment: minPayment,
        target_date: targetDate || null
      };
      
      if (editingDebtId) {
        // For update, preserve original_balance if it exists
        const { error } = await debtService.updateDebt(editingDebtId, debtData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Debt updated');
      } else {
        debtData.original_balance = balance;
        const { error } = await debtService.createDebt(currentBudget.id, debtData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Debt added');
      }
      
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error saving debt:', error);
      showToast(`Error saving debt: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (!data.debts) data.debts = [];
    
    if (editingDebtId) {
      const d = data.debts.find(x => x.id === editingDebtId);
      if (d) {
        d.name = name;
        d.currentBalance = balance;
        d.interestRate = interest;
        d.minPayment = minPayment;
        d.targetDate = targetDate || undefined;
        if (!d.originalBalance) d.originalBalance = balance;
      }
      showToast('Debt updated');
    } else {
      data.debts.push({
        id: 'debt_' + generateId(),
        name,
        currentBalance: balance,
        originalBalance: balance,
        interestRate: interest,
        minPayment,
        targetDate: targetDate || undefined
      });
      showToast('Debt added');
    }
    stateManager.setActiveData(data);
  }
  
  closeDebtModal();
  if (renderAll) {
    renderAll();
  }
}

/**
 * Delete debt
 * @param {string} id - Debt ID
 */
export async function deleteDebt(id) {
  if (!confirm('Delete this debt?')) return;
  
  if (useSupabase && debtService) {
    // Use Supabase
    try {
      const { error } = await debtService.deleteDebt(id);
      if (error) {
        showToast(`Error: ${error.message}`, 'Error');
        return;
      }
      showToast('Debt deleted');
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting debt:', error);
      showToast(`Error deleting debt: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (data.debts) {
      data.debts = data.debts.filter(d => d.id !== id);
    }
    stateManager.setActiveData(data);
    showToast('Debt deleted');
  }
  
  if (renderAll) {
    renderAll();
  }
}

/**
 * Close debt modal
 */
export function closeDebtModal() {
  const modal = document.getElementById('debtModal');
  if (modal) {
    modal.classList.remove('show');
  }
  editingDebtId = null;
}

/**
 * Get all debts
 * @returns {Array} Debts array
 */
export function getDebts() {
  return stateManager.getActiveData().debts || [];
}

/**
 * Calculate debt progress percentage
 * @param {number} currentBalance - Current balance
 * @param {number} originalBalance - Original balance
 * @returns {number} Progress percentage (0-100)
 */
export function calculateDebtProgress(currentBalance, originalBalance) {
  if (!originalBalance || originalBalance <= 0) return 0;
  return Math.min(100, ((originalBalance - currentBalance) / originalBalance * 100));
}

// Export alias for backward compatibility
export { openAddDebt as addDebt };

