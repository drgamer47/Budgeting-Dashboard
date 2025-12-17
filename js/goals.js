/**
 * Goals Module
 * Handles savings goals and financial goals CRUD operations, rendering, and progress calculations
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, formatDate, showToast, generateId } from './utils.js';

// Module-level state
let editingSavingsGoalId = null;
let editingFinancialGoalId = null;

// External dependencies (will be injected)
let goalService = null;
let transactionService = null;
let currentBudget = null;
let useSupabase = false;
let loadDataFromSupabase = null;
let renderAll = null;

/**
 * Initialize goals module with dependencies
 * @param {Object} deps - Dependencies object
 */
export function initGoals(deps) {
  goalService = deps.goalService;
  transactionService = deps.transactionService;
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

// ============================================
// SAVINGS GOALS
// ============================================

/**
 * Render savings goals (alias for backward compatibility)
 */
export function renderGoals() {
  renderSavingsGoals();
}

/**
 * Render savings goals
 */
export function renderSavingsGoals() {
  const list = document.getElementById("goalsList");
  if (!list) return;
  list.innerHTML = "";

  const data = stateManager.getActiveData();
  const goals = Array.isArray(data.savingsGoals) ? data.savingsGoals : [];

  goals.forEach(g => {
    const isReadOnly = !!g.readOnly || !!g.linkedBank;
    const safeTarget = (g.target && g.target > 0) ? g.target : 1;
    const percent = Math.min(100, ((g.current || 0) / safeTarget) * 100);

    const div = document.createElement("div");
    div.className = "goal-item";
    const badge = isReadOnly ? '<span style="margin-left:8px; font-size:11px; color:var(--text-secondary); border:1px solid var(--border); padding:2px 6px; border-radius:999px;">Linked</span>' : '';
    const buttons = isReadOnly
      ? ''
      : `
      <button data-id="${g.id}" class="addToSavingsBtn" style="margin-top:6px; background:var(--success); color:var(--text-primary);">Add to Savings</button>
      <button data-id="${g.id}" class="editGoalBtn" style="margin-left:6px;">Edit</button>
      <button data-id="${g.id}" class="deleteGoalBtn" style="margin-left:6px;">Delete</button>
    `;
    div.innerHTML = `
      <div class="goal-label"><b>${g.name}</b>${badge} — ${formatMoney(g.current || 0)} / ${formatMoney(safeTarget)}</div>
      <div class="goal-bar"><div class="goal-fill" style="width:${percent}%"></div></div>
      ${buttons}
    `;
    list.appendChild(div);
  });

  list.querySelectorAll(".addToSavingsBtn").forEach(btn => {
    btn.addEventListener("click", () => addToSavings(btn.dataset.id));
  });
  list.querySelectorAll(".editGoalBtn").forEach(btn => {
    btn.addEventListener("click", () => editSavingsGoal(btn.dataset.id));
  });
  list.querySelectorAll(".deleteGoalBtn").forEach(btn => {
    btn.addEventListener("click", () => deleteSavingsGoal(btn.dataset.id));
  });
}

/**
 * Add savings goal (using prompts for simplicity)
 */
export async function addSavingsGoal() {
  const name = prompt("Goal name:");
  if (!name) return;

  const target = parseFloat(prompt("Target amount:") || "");
  if (!target || target <= 0) {
    showToast("Invalid goal target", "Error");
    return;
  }

  const current = parseFloat(prompt("Current saved amount:") || "0");
  if (isNaN(current) || current < 0) {
    showToast("Invalid saved amount", "Error");
    return;
  }

  if (useSupabase && currentBudget && goalService) {
    // Use Supabase
    try {
      const { data, error } = await goalService.createSavingsGoal(currentBudget.id, {
        name,
        target,
        current
      });
      if (error) {
        showToast(`Error: ${error.message}`, "Error");
        return;
      }
      showToast("Goal added");
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error adding goal:', error);
      showToast(`Error adding goal: ${error.message}`, "Error");
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (!data.savingsGoals) data.savingsGoals = [];
    data.savingsGoals.push({
      id: "goal_" + generateId(),
      name,
      target,
      current
    });
    stateManager.setActiveData(data);
    showToast("Goal added");
  }

  if (renderAll) {
    renderAll();
  }
}

/**
 * Edit savings goal
 * @param {string} id - Goal ID
 */
export async function editSavingsGoal(id) {
  const goals = stateManager.getActiveData().savingsGoals || [];
  const g = goals.find(x => x.id === id);
  if (!g) return;
  if (g.readOnly || g.linkedBank) {
    showToast('This goal is linked to a bank account and cannot be edited.', 'Info');
    return;
  }

  const name = prompt("Goal name:", g.name);
  if (!name) return;

  const target = parseFloat(prompt("Target amount:", g.target) || "");
  if (!target || target <= 0) {
    showToast("Invalid target", "Error");
    return;
  }

  const current = parseFloat(prompt("Current saved:", g.current) || "");
  if (isNaN(current) || current < 0) {
    showToast("Invalid saved", "Error");
    return;
  }

  if (useSupabase && goalService) {
    // Use Supabase
    try {
      const { error } = await goalService.updateSavingsGoal(id, {
        name,
        target,
        current
      });
      if (error) {
        showToast(`Error: ${error.message}`, "Error");
        return;
      }
      showToast("Goal updated");
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error updating goal:', error);
      showToast(`Error updating goal: ${error.message}`, "Error");
      return;
    }
  } else {
    // Use localStorage (fallback)
    g.name = name;
    g.target = target;
    g.current = current;
    const data = stateManager.getActiveData();
    stateManager.setActiveData(data);
    showToast("Goal updated");
  }

  if (renderAll) {
    renderAll();
  }
}

/**
 * Delete savings goal
 * @param {string} id - Goal ID
 */
export async function deleteSavingsGoal(id) {
  if (!confirm('Delete this savings goal?')) return;

  const goals = stateManager.getActiveData().savingsGoals || [];
  const g = goals.find(x => x.id === id);
  if (g && (g.readOnly || g.linkedBank)) {
    showToast('This goal is linked to a bank account and cannot be deleted.', 'Info');
    return;
  }
  
  if (useSupabase && goalService) {
    // Use Supabase
    try {
      const { error } = await goalService.deleteSavingsGoal(id);
      if (error) {
        showToast(`Error: ${error.message}`, "Error");
        return;
      }
      showToast("Goal deleted");
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting goal:', error);
      showToast(`Error deleting goal: ${error.message}`, "Error");
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    let goals = data.savingsGoals || [];
    goals = goals.filter(g => g.id !== id);
    data.savingsGoals = goals;
    stateManager.setActiveData(data);
    showToast("Goal deleted");
  }

  if (renderAll) {
    renderAll();
  }
}

/**
 * Add money to savings goal
 * @param {string} goalId - Goal ID
 */
export function addToSavings(goalId) {
  const goals = stateManager.getActiveData().savingsGoals || [];
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;
  if (goal.readOnly || goal.linkedBank) {
    showToast('This goal is linked to a bank account and cannot be updated manually.', 'Info');
    return;
  }

  const amountStr = prompt(`Add to "${goal.name}" savings:\n\nCurrent: ${formatMoney(goal.current)}\nTarget: ${formatMoney(goal.target)}`, "");
  if (!amountStr) return;

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    showToast("Invalid amount", "Error");
    return;
  }

  const data = stateManager.getActiveData();
  
  // Update the goal's current amount
  goal.current = (goal.current || 0) + amount;
  
  // Create an expense transaction for the savings transfer
  // Find or use "other" category for savings transfers
  const savingsCat = data.categories.find(c => c.name.toLowerCase().includes("savings")) || 
                     data.categories.find(c => c.id === "other") || 
                     data.categories[0];
  
  const today = new Date().toISOString().slice(0, 10);
  if (!data.transactions) data.transactions = [];
  
  data.transactions.push({
    id: "tx_" + generateId(),
    date: today,
    description: `Savings Transfer - ${goal.name}`,
    amount: amount,
    type: "expense",
    categoryId: savingsCat.id,
    note: `Added to savings goal: ${goal.name}`
  });

  stateManager.setActiveData(data);
  
  if (renderAll) {
    renderAll();
  }
  showToast(`Added ${formatMoney(amount)} to ${goal.name}`, "Savings Updated");
}

/**
 * Calculate progress percentage for a goal
 * @param {number} current - Current amount
 * @param {number} target - Target amount
 * @returns {number} Progress percentage (0-100)
 */
export function calculateGoalProgress(current, target) {
  if (!target || target <= 0) return 0;
  return Math.min(100, (current / target) * 100);
}

// ============================================
// FINANCIAL GOALS
// ============================================

/**
 * Render financial goals
 */
export function renderFinancialGoals() {
  const container = document.getElementById('financialGoalsList');
  if (!container) return;
  
  const goals = stateManager.getActiveData().financialGoals || [];
  container.innerHTML = '';
  
  if (goals.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No financial goals yet.</p>';
    return;
  }
  
  goals.forEach(g => {
    const div = document.createElement('div');
    div.className = 'goal-item';
    const percent = calculateGoalProgress(g.current, g.target);
    div.innerHTML = `
      <div class="goal-label">
        <b>${g.name}</b> (${g.type}) — ${formatMoney(g.current)} / ${formatMoney(g.target)}
        ${g.targetDate || g.target_date ? `<div style="font-size: 12px; color: var(--text-secondary);">Target: ${formatDate(g.targetDate || g.target_date)}</div>` : ''}
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${percent}%"></div></div>
      <button class="editFinancialGoalBtn" data-id="${g.id}" style="margin-top:6px;">Edit</button>
      <button class="deleteFinancialGoalBtn" data-id="${g.id}" style="margin-left:6px;">Delete</button>
    `;
    container.appendChild(div);
  });
  
  container.querySelectorAll('.editFinancialGoalBtn').forEach(btn => {
    btn.addEventListener('click', () => editFinancialGoal(btn.dataset.id));
  });
  
  container.querySelectorAll('.deleteFinancialGoalBtn').forEach(btn => {
    btn.addEventListener('click', () => deleteFinancialGoal(btn.dataset.id));
  });
}

/**
 * Open add financial goal modal
 */
export function openAddFinancialGoal() {
  editingFinancialGoalId = null;
  const modalTitle = document.getElementById('financialGoalModalTitle');
  const nameInput = document.getElementById('financialGoalNameInput');
  const typeInput = document.getElementById('financialGoalTypeInput');
  const targetInput = document.getElementById('financialGoalTargetInput');
  const currentInput = document.getElementById('financialGoalCurrentInput');
  const dateInput = document.getElementById('financialGoalDateInput');
  const deleteBtn = document.getElementById('deleteFinancialGoalBtn');
  const modal = document.getElementById('financialGoalModal');
  
  if (modalTitle) modalTitle.textContent = 'Add Financial Goal';
  if (nameInput) nameInput.value = '';
  if (typeInput) typeInput.value = 'savings';
  if (targetInput) targetInput.value = '';
  if (currentInput) currentInput.value = '0';
  if (dateInput) dateInput.value = '';
  if (deleteBtn) deleteBtn.style.display = 'none';
  if (modal) modal.classList.add('show');
}

/**
 * Edit financial goal
 * @param {string} id - Goal ID
 */
export function editFinancialGoal(id) {
  const goals = stateManager.getActiveData().financialGoals || [];
  const g = goals.find(x => x.id === id);
  if (!g) return;
  
  editingFinancialGoalId = id;
  const modalTitle = document.getElementById('financialGoalModalTitle');
  const nameInput = document.getElementById('financialGoalNameInput');
  const typeInput = document.getElementById('financialGoalTypeInput');
  const targetInput = document.getElementById('financialGoalTargetInput');
  const currentInput = document.getElementById('financialGoalCurrentInput');
  const dateInput = document.getElementById('financialGoalDateInput');
  const deleteBtn = document.getElementById('deleteFinancialGoalBtn');
  const modal = document.getElementById('financialGoalModal');
  
  if (modalTitle) modalTitle.textContent = 'Edit Financial Goal';
  if (nameInput) nameInput.value = g.name;
  if (typeInput) typeInput.value = g.type;
  if (targetInput) targetInput.value = g.target;
  if (currentInput) currentInput.value = g.current;
  if (dateInput) dateInput.value = g.targetDate || g.target_date || '';
  if (deleteBtn) deleteBtn.style.display = 'block';
  if (modal) modal.classList.add('show');
}

/**
 * Save financial goal (create or update)
 */
export async function saveFinancialGoal() {
  const nameInput = document.getElementById('financialGoalNameInput');
  const typeInput = document.getElementById('financialGoalTypeInput');
  const targetInput = document.getElementById('financialGoalTargetInput');
  const currentInput = document.getElementById('financialGoalCurrentInput');
  const dateInput = document.getElementById('financialGoalDateInput');
  
  if (!nameInput || !typeInput || !targetInput || !currentInput || !dateInput) {
    showToast('Financial goal form elements not found', 'Error');
    return;
  }
  
  const name = nameInput.value.trim();
  const type = typeInput.value;
  const target = parseFloat(targetInput.value);
  const current = parseFloat(currentInput.value) || 0;
  const targetDate = dateInput.value;
  
  if (!name || !target || target <= 0) {
    showToast('Please fill all required fields', 'Error');
    return;
  }
  
  if (useSupabase && currentBudget && goalService) {
    // Use Supabase
    try {
      const goalData = {
        name,
        type,
        target,
        current,
        target_date: targetDate || null
      };
      
      if (editingFinancialGoalId) {
        const { error } = await goalService.updateFinancialGoal(editingFinancialGoalId, goalData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Financial goal updated');
      } else {
        const { error } = await goalService.createFinancialGoal(currentBudget.id, goalData);
        if (error) {
          showToast(`Error: ${error.message}`, 'Error');
          return;
        }
        showToast('Financial goal added');
      }
      
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error saving financial goal:', error);
      showToast(`Error saving financial goal: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (!data.financialGoals) data.financialGoals = [];
    
    if (editingFinancialGoalId) {
      const g = data.financialGoals.find(x => x.id === editingFinancialGoalId);
      if (g) {
        g.name = name;
        g.type = type;
        g.target = target;
        g.current = current;
        g.targetDate = targetDate || undefined;
      }
      showToast('Financial goal updated');
    } else {
      data.financialGoals.push({
        id: 'fgoal_' + generateId(),
        name,
        type,
        target,
        current,
        targetDate: targetDate || undefined
      });
      showToast('Financial goal added');
    }
    stateManager.setActiveData(data);
  }
  
  closeFinancialGoalModal();
  if (renderAll) {
    renderAll();
  }
}

/**
 * Delete financial goal
 * @param {string} id - Goal ID
 */
export async function deleteFinancialGoal(id) {
  if (!confirm('Delete this financial goal?')) return;
  
  if (useSupabase && goalService) {
    // Use Supabase
    try {
      const { error } = await goalService.deleteFinancialGoal(id);
      if (error) {
        showToast(`Error: ${error.message}`, 'Error');
        return;
      }
      showToast('Financial goal deleted');
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting financial goal:', error);
      showToast(`Error deleting financial goal: ${error.message}`, 'Error');
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    if (!data.financialGoals) data.financialGoals = [];
    data.financialGoals = data.financialGoals.filter(g => g.id !== id);
    stateManager.setActiveData(data);
    showToast('Financial goal deleted');
  }
  
  if (renderAll) {
    renderAll();
  }
}

/**
 * Close financial goal modal
 */
export function closeFinancialGoalModal() {
  const modal = document.getElementById('financialGoalModal');
  if (modal) {
    modal.classList.remove('show');
  }
  editingFinancialGoalId = null;
}

/**
 * Get savings goals
 * @returns {Array} Savings goals array
 */
export function getSavingsGoals() {
  return stateManager.getActiveData().savingsGoals || [];
}

/**
 * Get financial goals
 * @returns {Array} Financial goals array
 */
export function getFinancialGoals() {
  return stateManager.getActiveData().financialGoals || [];
}

