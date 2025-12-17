/**
 * Recurring Transactions Module
 * Handles recurring transaction CRUD operations, rendering, and next date calculations
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, formatDate, showToast, generateId, isValidUUID } from './utils.js';
import { RECURRING_FREQUENCIES } from './constants.js';

// Module-level state
let editingRecurringId = null;

// External dependencies (will be injected)
let recurringService = null;
let currentBudget = null;
let useSupabase = false;
let loadDataFromSupabase = null;
let renderAll = null;

/**
 * Initialize recurring module with dependencies
 * @param {Object} deps - Dependencies object
 */
export function initRecurring(deps) {
  recurringService = deps.recurringService;
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
 * Render recurring transactions
 */
export function renderRecurringTransactions() {
  const container = document.getElementById('recurringList');
  if (!container) return;
  
  const recurring = stateManager.getActiveData().recurringTransactions || [];
  container.innerHTML = '';
  
  if (recurring.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No recurring transactions yet.</p>';
    return;
  }
  
  recurring.forEach(r => {
    const div = document.createElement('div');
    div.className = 'recurring-item';
    const nextDate = new Date(r.nextDate || r.next_date);
    const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
    div.innerHTML = `
      <div>
        <strong>${r.description}</strong> - ${formatMoney(r.amount)}
        <span class="recurring-badge">${r.frequency}</span>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
          Next: ${formatDate(r.nextDate || r.next_date)} (${daysUntil} days)
        </div>
      </div>
      <div>
        <button class="editRecurringBtn" data-id="${r.id}" style="margin-right: 6px;">Edit</button>
        <button class="deleteRecurringBtn" data-id="${r.id}">Delete</button>
      </div>
    `;
    container.appendChild(div);
  });
  
  container.querySelectorAll('.editRecurringBtn').forEach(btn => {
    btn.addEventListener('click', () => editRecurring(btn.dataset.id));
  });
  
  container.querySelectorAll('.deleteRecurringBtn').forEach(btn => {
    btn.addEventListener('click', () => deleteRecurring(btn.dataset.id));
  });
}

/**
 * Open add recurring transaction modal
 */
export function openAddRecurring() {
  editingRecurringId = null;
  const modalTitle = document.getElementById('recurringModalTitle');
  const descInput = document.getElementById('recurringDescInput');
  const amountInput = document.getElementById('recurringAmountInput');
  const typeInput = document.getElementById('recurringTypeInput');
  const frequencyInput = document.getElementById('recurringFrequencyInput');
  const nextDateInput = document.getElementById('recurringNextDateInput');
  const categoryInput = document.getElementById('recurringCategoryInput');
  const deleteBtn = document.getElementById('deleteRecurringBtn');
  const modal = document.getElementById('recurringModal');
  
  if (modalTitle) modalTitle.textContent = 'Add Recurring Transaction';
  if (descInput) descInput.value = '';
  if (amountInput) amountInput.value = '';
  if (typeInput) typeInput.value = 'expense';
  if (frequencyInput) frequencyInput.value = RECURRING_FREQUENCIES.MONTHLY;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (nextDateInput) nextDateInput.value = tomorrow.toISOString().slice(0, 10);
  
  const cats = stateManager.getActiveData().categories || [];
  if (categoryInput) {
    categoryInput.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (cats.length) categoryInput.value = cats[0].id;
  }
  
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (modal) modal.classList.add('show');
}

/**
 * Edit recurring transaction
 * @param {string} id - Recurring transaction ID
 */
export function editRecurring(id) {
  const recurring = stateManager.getActiveData().recurringTransactions || [];
  const r = recurring.find(x => x.id === id);
  if (!r) return;
  
  editingRecurringId = id;
  const modalTitle = document.getElementById('recurringModalTitle');
  const descInput = document.getElementById('recurringDescInput');
  const amountInput = document.getElementById('recurringAmountInput');
  const typeInput = document.getElementById('recurringTypeInput');
  const frequencyInput = document.getElementById('recurringFrequencyInput');
  const nextDateInput = document.getElementById('recurringNextDateInput');
  const categoryInput = document.getElementById('recurringCategoryInput');
  const deleteBtn = document.getElementById('deleteRecurringBtn');
  const modal = document.getElementById('recurringModal');
  
  if (modalTitle) modalTitle.textContent = 'Edit Recurring Transaction';
  if (descInput) descInput.value = r.description;
  if (amountInput) amountInput.value = r.amount;
  if (typeInput) typeInput.value = r.type;
  if (frequencyInput) frequencyInput.value = r.frequency;
  if (nextDateInput) nextDateInput.value = r.nextDate || r.next_date;
  
  const cats = stateManager.getActiveData().categories || [];
  if (categoryInput) {
    categoryInput.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    categoryInput.value = r.categoryId || r.category_id || '';
  }
  
  if (deleteBtn) deleteBtn.style.display = 'block';
  if (modal) modal.classList.add('show');
}

/**
 * Save recurring transaction (create or update)
 */
export async function saveRecurring() {
  const descInput = document.getElementById('recurringDescInput');
  const amountInput = document.getElementById('recurringAmountInput');
  const typeInput = document.getElementById('recurringTypeInput');
  const categoryInput = document.getElementById('recurringCategoryInput');
  const frequencyInput = document.getElementById('recurringFrequencyInput');
  const nextDateInput = document.getElementById('recurringNextDateInput');
  
  if (!descInput || !amountInput || !typeInput || !categoryInput || !frequencyInput || !nextDateInput) {
    showToast('Recurring transaction form elements not found', 'Error');
    return;
  }
  
  const desc = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const type = typeInput.value;
  let categoryId = categoryInput.value;
  const frequency = frequencyInput.value;
  const nextDate = nextDateInput.value;
  
  if (!desc || !amount || !nextDate) {
    showToast('Please fill all required fields', 'Error');
    return;
  }
  
  // Validate category_id - must be a UUID or null
  if (categoryId && !isValidUUID(categoryId)) {
    const categories = stateManager.getActiveData().categories || [];
    const foundCategory = categories.find(c => c.id === categoryId || c.name.toLowerCase() === categoryId.toLowerCase());
    if (foundCategory && isValidUUID(foundCategory.id)) {
      categoryId = foundCategory.id;
    } else {
      logger.warn('Invalid category ID:', categoryId, '- setting to null');
      categoryId = null;
    }
  }
  
  if (useSupabase && currentBudget && recurringService) {
    // Use Supabase
    try {
      const recurringData = {
        description: desc,
        amount,
        type,
        category_id: categoryId || null,
        frequency,
        next_date: nextDate
      };
      
      if (editingRecurringId) {
        const { error } = await recurringService.updateRecurringTransaction(editingRecurringId, recurringData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Recurring transaction updated');
      } else {
        const { error } = await recurringService.createRecurringTransaction(currentBudget.id, recurringData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Recurring transaction added');
      }
      
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error saving recurring transaction:', error);
      showToast(`Error saving recurring transaction: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (!data.recurringTransactions) data.recurringTransactions = [];
    
    if (editingRecurringId) {
      const r = data.recurringTransactions.find(x => x.id === editingRecurringId);
      if (r) {
        r.description = desc;
        r.amount = amount;
        r.type = type;
        r.categoryId = categoryId;
        r.frequency = frequency;
        r.nextDate = nextDate;
      }
      showToast('Recurring transaction updated');
    } else {
      data.recurringTransactions.push({
        id: 'recur_' + generateId(),
        description: desc,
        amount,
        type,
        categoryId,
        frequency,
        nextDate
      });
      showToast('Recurring transaction added');
    }
    stateManager.setActiveData(data);
  }
  
  closeRecurringModal();
  if (renderAll) {
    renderAll();
  }
}

/**
 * Delete recurring transaction
 * @param {string} id - Recurring transaction ID
 */
export async function deleteRecurring(id) {
  if (!confirm('Delete this recurring transaction?')) return;
  
  if (useSupabase && recurringService) {
    // Use Supabase
    try {
      const { error } = await recurringService.deleteRecurringTransaction(id);
      if (error) {
        showToast(`Error: ${error.message}`, 'Error');
        return;
      }
      showToast('Recurring transaction deleted');
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting recurring transaction:', error);
      showToast(`Error deleting recurring transaction: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (data.recurringTransactions) {
      data.recurringTransactions = data.recurringTransactions.filter(r => r.id !== id);
    }
    stateManager.setActiveData(data);
    showToast('Recurring transaction deleted');
  }
  
  if (renderAll) {
    renderAll();
  }
}

/**
 * Close recurring modal
 */
export function closeRecurringModal() {
  const modal = document.getElementById('recurringModal');
  if (modal) {
    modal.classList.remove('show');
  }
  editingRecurringId = null;
}

/**
 * Calculate next date based on frequency
 * @param {Date} currentDate - Current date
 * @param {string} frequency - Frequency (daily, weekly, monthly, yearly)
 * @returns {Date} Next date
 */
export function calculateNextDate(currentDate, frequency) {
  const next = new Date(currentDate);
  
  switch (frequency) {
    case RECURRING_FREQUENCIES.DAILY:
      next.setDate(next.getDate() + 1);
      break;
    case RECURRING_FREQUENCIES.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case RECURRING_FREQUENCIES.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    case RECURRING_FREQUENCIES.YEARLY:
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1); // Default to monthly
  }
  
  return next;
}

/**
 * Get all recurring transactions
 * @returns {Array} Recurring transactions array
 */
export function getRecurringTransactions() {
  return stateManager.getActiveData().recurringTransactions || [];
}

/**
 * Get days until next occurrence
 * @param {string} nextDate - Next date string (YYYY-MM-DD)
 * @returns {number} Days until next occurrence
 */
export function getDaysUntilNext(nextDate) {
  if (!nextDate) return 0;
  const next = new Date(nextDate);
  const now = new Date();
  return Math.ceil((next - now) / (1000 * 60 * 60 * 24));
}

// Export alias for backward compatibility
export { openAddRecurring as addRecurring };

