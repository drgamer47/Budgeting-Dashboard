/**
 * UI Handlers Module
 * Centralizes all event handlers and user interactions
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { showToast, formatMoney, formatDate, isValidUUID } from './utils.js';
import { addNotification } from './notifications.js';
import { DEFAULT_CATEGORIES, API_BASE_URL, API_SERVER_PORT, TOAST_TYPES, RETRY_CONFIG, TRANSACTION_HISTORY_DAYS, INVITE_CODE_LENGTH, INVITE_CODE_EXPIRATION_DAYS, CSV_CONFIG } from './constants.js';

// Import render functions
import { renderAll, renderProfileSelector, closeProfileMenu, updateMonthYearSelectors } from './ui-renderers.js';

// Import feature module functions
import { 
  exitSelectionMode, 
  openDrawerForAdd, 
  handleDeleteSelected,
  toggleAllMonths,
  handleMonthYearChange
} from './transactions.js';

import { 
  openAddCategory, 
  saveCategory, 
  deleteCategory, 
  closeCategoryModal,
  renderCategoriesList
} from './categories.js';

import {
  addSavingsGoal,
  editSavingsGoal,
  deleteSavingsGoal,
  addToSavings,
  openAddFinancialGoal,
  editFinancialGoal,
  saveFinancialGoal,
  deleteFinancialGoal,
  closeFinancialGoalModal
} from './goals.js';

// Re-export for backward compatibility
export { addSavingsGoal as addGoal };

import {
  addDebt,
  editDebt,
  saveDebt,
  deleteDebt,
  closeDebtModal
} from './debts.js';

import {
  addRecurring,
  editRecurring,
  saveRecurring,
  deleteRecurring,
  closeRecurringModal
} from './recurring.js';

// External dependencies (will be injected)
let useSupabase = false;
let currentUser = null;
let currentBudget = null;
let loadDataFromSupabase = null;
let transactionService = null;
let goalService = null;
let debtService = null;
let recurringService = null;
let categoryService = null;

// Module-level state
let settings = {
  budgetAlertsEnabled: true,
  budgetAlertThreshold: 80,
  currencySymbol: '$',
  dateFormat: 'YYYY-MM-DD'
};

let editingRecurringId = null;
let editingDebtId = null;
let editingFinancialGoalId = null;

/**
 * Initialize UI handlers with dependencies
 * Sets up all event listeners and registers handlers for user interactions
 * @param {Object} deps - Dependencies object
 * @param {boolean} [deps.useSupabase] - Whether to use Supabase backend
 * @param {Object} [deps.currentUser] - Current authenticated user
 * @param {Object} [deps.currentBudget] - Current budget context
 * @param {Function} [deps.loadDataFromSupabase] - Function to reload data from Supabase
 * @param {Object} [deps.transactionService] - Transaction service for Supabase operations
 * @param {Object} [deps.goalService] - Goal service for Supabase operations
 * @param {Object} [deps.debtService] - Debt service for Supabase operations
 * @param {Object} [deps.recurringService] - Recurring transaction service
 * @param {Object} [deps.categoryService] - Category service for Supabase operations
 * @param {Function} [deps.onUpdate] - Callback to update dependencies when they change
 * @returns {void}
 */
export function initHandlers(deps) {
  useSupabase = deps.useSupabase || false;
  currentUser = deps.currentUser || null;
  currentBudget = deps.currentBudget || null;
  loadDataFromSupabase = deps.loadDataFromSupabase || null;
  transactionService = deps.transactionService || null;
  goalService = deps.goalService || null;
  debtService = deps.debtService || null;
  recurringService = deps.recurringService || null;
  categoryService = deps.categoryService || null;
  
  // Update when dependencies change
  if (deps.onUpdate) {
    deps.onUpdate(() => {
      useSupabase = deps.useSupabase || false;
      currentUser = deps.currentUser || null;
      currentBudget = deps.currentBudget || null;
    });
  }
  
  // Load settings
  loadSettings();
  
  // Register all event handlers
  registerEventHandlers();
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
  const saved = localStorage.getItem('budgetDashboardSettings');
  if (saved) {
    try {
      settings = { ...settings, ...JSON.parse(saved) };
    } catch (e) {
      logger.error('Error loading settings:', e);
    }
  }
  applySettings();
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  try {
    localStorage.setItem('budgetDashboardSettings', JSON.stringify(settings));
    applySettings();
  } catch (e) {
    logger.error('Error saving settings:', e);
  }
}

/**
 * Apply settings to UI
 */
function applySettings() {
  const budgetAlertsEnabled = document.getElementById('budgetAlertsEnabled');
  if (budgetAlertsEnabled) {
    budgetAlertsEnabled.checked = settings.budgetAlertsEnabled;
  }
  
  const budgetAlertThreshold = document.getElementById('budgetAlertThreshold');
  if (budgetAlertThreshold) {
    budgetAlertThreshold.value = settings.budgetAlertThreshold;
  }
  
  const currencySymbol = document.getElementById('currencySymbol');
  if (currencySymbol) {
    currencySymbol.value = settings.currencySymbol;
  }
  
  const dateFormat = document.getElementById('dateFormat');
  if (dateFormat) {
    dateFormat.value = settings.dateFormat;
  }
}

/**
 * Initialize theme from localStorage or system preference
 * Applies saved theme or defaults to system preference
 * @returns {void}
 */
export function initTheme() {
  const savedTheme = localStorage.getItem('budgetDashboardTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * Toggle between light and dark theme
 * Saves preference to localStorage and applies theme to document
 * @returns {void}
 */
export function toggleTheme() {
  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect) return;
  
  const newTheme = themeSelect.value;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('budgetDashboardTheme', newTheme);
  renderAll(); // Re-render charts with new theme
}

/**
 * Initialize tab navigation system
 * Sets up click handlers for tab switching and saves active tab to localStorage
 * @returns {void}
 */
export function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      
      // Remove active class from all buttons and panes
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      // Add active class to clicked button and corresponding pane
      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      
      // Save to localStorage
      localStorage.setItem('budgetDashboardActiveTab', targetTab);
      
      // Scroll tabs nav if needed (for mobile)
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });
  
  // Set initial active tab from localStorage or default to overview
  const savedTab = localStorage.getItem('budgetDashboardActiveTab') || 'overview';
  const savedBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
  if (savedBtn) {
    const targetTab = savedBtn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    savedBtn.classList.add('active');
    const targetPane = document.getElementById(`tab-${targetTab}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }
}

/**
 * Open settings modal
 * Displays the settings dialog with current configuration values
 * @returns {void}
 */
export function openSettings() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  modal.classList.add('show');
  renderCategoriesList();
  applySettings();
  
  // Set current theme in dropdown
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = currentTheme;
  }
}

/**
 * Close settings modal
 * Hides the settings dialog
 * @returns {void}
 */
export function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

/**
 * Check budget warnings
 */
export function checkBudgetWarnings() {
  if (!settings.budgetAlertsEnabled) return;
  
  const data = stateManager.getActiveData();
  const tx = data.transactions || [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const filteredTx = tx.filter(t => {
    const txMonth = t.date.substring(0, 7);
    return txMonth === currentMonth;
  });
  
  data.categories.forEach(cat => {
    if (!cat.monthlyBudget || cat.monthlyBudget === 0) return;
    
    const monthExpenses = filteredTx
      .filter(t => t.type === 'expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const percentage = (monthExpenses / cat.monthlyBudget) * 100;
    
    if (percentage >= settings.budgetAlertThreshold) {
      const message = percentage >= 100 
        ? `⚠️ Over budget: ${cat.name} (${formatMoney(monthExpenses)} / ${formatMoney(cat.monthlyBudget)})`
        : `⚠️ Approaching budget: ${cat.name} (${percentage.toFixed(0)}%)`;
      // Persist these in the notification center so users can review them later.
      // Dedupe per category per month to avoid spam.
      const dedupeKey = `budgetWarning:${currentMonth}:${cat.id}:${percentage >= 100 ? 'over' : 'near'}`;
      addNotification(message, { level: percentage >= 100 ? 'warning' : 'info', dedupeKey });
    }
  });
}

/**
 * Export to PDF
 * Generates a comprehensive PDF report with financial summary, transactions, budgets, goals, and more
 * @returns {Promise<void>}
 */
export async function exportToPdf() {
  try {
    // Dynamically import jsPDF (loaded via CDN)
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      showToast('PDF library not loaded. Please refresh the page.', TOAST_TYPES.ERROR);
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;
    const lineHeight = 7;
    const sectionSpacing = 10;

    // Get data
    const data = stateManager.getActiveData();
    const state = stateManager.getState();
    const activeProfile = state.profiles.find(p => p.id === state.activeProfileId);
    const profileName = activeProfile?.name || 'Default';
    
    const transactions = data.transactions || [];
    const categories = data.categories || [];
    const savingsGoals = data.savingsGoals || [];
    const financialGoals = data.financialGoals || [];
    const debts = data.debts || [];
    const recurring = data.recurringTransactions || [];

    // Get current month/year from selectors or use current date
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    const selectedMonth = monthSelect?.value || new Date().getMonth() + 1;
    const selectedYear = yearSelect?.value || new Date().getFullYear();
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    
    // Filter transactions for selected month
    const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr));
    const allTimeTransactions = transactions; // For summary stats

    // Calculate totals
    const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const monthExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const monthNet = monthIncome - monthExpenses;
    
    const allTimeIncome = allTimeTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const allTimeExpenses = allTimeTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const allTimeNet = allTimeIncome - allTimeExpenses;

    // Helper function to add new page if needed
    const checkNewPage = (requiredSpace = 20) => {
      if (yPos + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Helper function to add text with word wrap
    const addText = (text, x, y, maxWidth = pageWidth - 2 * margin, fontSize = 10) => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * (fontSize * 0.4);
    };

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Budget Report', margin, yPos);
    yPos += lineHeight * 2;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Profile: ${profileName}`, margin, yPos);
    yPos += lineHeight;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    doc.text(`Period: ${monthNames[selectedMonth - 1]} ${selectedYear}`, margin, yPos);
    yPos += lineHeight;
    
    const now = new Date();
    doc.text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, margin, yPos);
    yPos += sectionSpacing * 1.5;

    // Financial Summary
    checkNewPage();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Financial Summary', margin, yPos);
    yPos += lineHeight * 1.5;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Current Month Summary
    doc.setFont(undefined, 'bold');
    doc.text('Current Month:', margin, yPos);
    yPos += lineHeight;
    doc.setFont(undefined, 'normal');
    doc.text(`Income: ${formatMoney(monthIncome)}`, margin + 5, yPos);
    yPos += lineHeight;
    doc.text(`Expenses: ${formatMoney(monthExpenses)}`, margin + 5, yPos);
    yPos += lineHeight;
    doc.setFont(undefined, 'bold');
    if (monthNet >= 0) {
      doc.setTextColor(0, 150, 0);
    } else {
      doc.setTextColor(200, 0, 0);
    }
    doc.text(`Net: ${formatMoney(monthNet)}`, margin + 5, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += lineHeight * 1.5;

    // All-Time Summary
    doc.setFont(undefined, 'bold');
    doc.text('All-Time Summary:', margin, yPos);
    yPos += lineHeight;
    doc.setFont(undefined, 'normal');
    doc.text(`Total Income: ${formatMoney(allTimeIncome)}`, margin + 5, yPos);
    yPos += lineHeight;
    doc.text(`Total Expenses: ${formatMoney(allTimeExpenses)}`, margin + 5, yPos);
    yPos += lineHeight;
    doc.setFont(undefined, 'bold');
    if (allTimeNet >= 0) {
      doc.setTextColor(0, 150, 0);
    } else {
      doc.setTextColor(200, 0, 0);
    }
    doc.text(`Total Net: ${formatMoney(allTimeNet)}`, margin + 5, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += sectionSpacing;

    // Budget Breakdown by Category
    checkNewPage();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Budget Breakdown', margin, yPos);
    yPos += lineHeight * 1.5;

    const categoryData = [];
    categories.forEach(cat => {
      const catExpenses = monthTransactions
        .filter(t => t.type === 'expense' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      
      if (cat.monthlyBudget > 0 || catExpenses > 0) {
        const percentage = cat.monthlyBudget > 0 ? (catExpenses / cat.monthlyBudget * 100) : 0;
        categoryData.push([
          cat.name,
          formatMoney(cat.monthlyBudget),
          formatMoney(catExpenses),
          `${percentage.toFixed(1)}%`
        ]);
      }
    });

    if (categoryData.length > 0) {
      doc.autoTable({
        startY: yPos,
        head: [['Category', 'Budget', 'Spent', 'Usage']],
        body: categoryData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });
      yPos = doc.lastAutoTable.finalY + sectionSpacing;
    } else {
      doc.setFontSize(10);
      doc.text('No budget data available', margin, yPos);
      yPos += lineHeight + sectionSpacing;
    }

    // Transactions Table
    checkNewPage();
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Transactions', margin, yPos);
    yPos += lineHeight * 1.5;

    if (monthTransactions.length > 0) {
      const transactionData = monthTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 50) // Limit to 50 transactions to avoid huge PDFs
        .map(t => {
          const cat = categories.find(c => c.id === t.categoryId);
          return [
            formatDate(t.date),
            t.description.substring(0, 30),
            cat?.name || 'Other',
            t.type === 'income' ? formatMoney(t.amount) : formatMoney(-t.amount)
          ];
        });

      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Description', 'Category', 'Amount']],
        body: transactionData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 70 },
          2: { cellWidth: 40 },
          3: { cellWidth: 30, halign: 'right' }
        }
      });
      yPos = doc.lastAutoTable.finalY + sectionSpacing;
      
      if (monthTransactions.length > 50) {
        doc.setFontSize(9);
        doc.text(`(Showing first 50 of ${monthTransactions.length} transactions)`, margin, yPos);
        yPos += lineHeight;
      }
    } else {
      doc.setFontSize(10);
      doc.text('No transactions for this period', margin, yPos);
      yPos += lineHeight + sectionSpacing;
    }

    // Goals Section
    if (savingsGoals.length > 0 || financialGoals.length > 0) {
      checkNewPage();
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Goals & Progress', margin, yPos);
      yPos += lineHeight * 1.5;

      if (savingsGoals.length > 0) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Savings Goals:', margin, yPos);
        yPos += lineHeight;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        savingsGoals.forEach(goal => {
          checkNewPage(15);
          const progress = goal.target > 0 ? (goal.current / goal.target * 100) : 0;
          doc.text(`${goal.name}: ${formatMoney(goal.current)} / ${formatMoney(goal.target)} (${progress.toFixed(1)}%)`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += sectionSpacing / 2;
      }

      if (financialGoals.length > 0) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text('Financial Goals:', margin, yPos);
        yPos += lineHeight;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        financialGoals.forEach(goal => {
          checkNewPage(15);
          const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount * 100) : 0;
          doc.text(`${goal.name} (${goal.type}): ${formatMoney(goal.currentAmount)} / ${formatMoney(goal.targetAmount)} (${progress.toFixed(1)}%)`, margin + 5, yPos);
          yPos += lineHeight;
        });
        yPos += sectionSpacing;
      }
    }

    // Debts Section
    if (debts.length > 0) {
      checkNewPage();
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Debts', margin, yPos);
      yPos += lineHeight * 1.5;

      const debtData = debts.map(debt => {
        const progress = debt.originalBalance > 0 ? ((debt.originalBalance - debt.currentBalance) / debt.originalBalance * 100) : 0;
        return [
          debt.name,
          formatMoney(debt.originalBalance),
          formatMoney(debt.currentBalance),
          `${progress.toFixed(1)}%`
        ];
      });

      doc.autoTable({
        startY: yPos,
        head: [['Debt Name', 'Original', 'Current', 'Progress']],
        body: debtData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [200, 0, 0], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 245, 245] }
      });
      yPos = doc.lastAutoTable.finalY + sectionSpacing;
    }

    // Recurring Transactions
    if (recurring.length > 0) {
      checkNewPage();
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Recurring Transactions', margin, yPos);
      yPos += lineHeight * 1.5;

      const recurringData = recurring.map(r => {
        const cat = categories.find(c => c.id === r.categoryId);
        return [
          r.description.substring(0, 25),
          cat?.name || 'Other',
          formatMoney(r.amount),
          r.frequency,
          r.nextDate ? formatDate(r.nextDate) : 'N/A'
        ];
      });

      doc.autoTable({
        startY: yPos,
        head: [['Description', 'Category', 'Amount', 'Frequency', 'Next Date']],
        body: recurringData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });
    }

    // Footer on each page
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);
    }

    // Save PDF
    const fileName = `budget-report-${profileName}-${monthStr}-${now.getTime()}.pdf`;
    doc.save(fileName);
    
    showToast('PDF exported successfully', TOAST_TYPES.SUCCESS);
  } catch (error) {
    logger.error('Error exporting PDF:', error);
    showToast('Error exporting PDF: ' + (error.message || 'Unknown error'), TOAST_TYPES.ERROR);
  }
}

/**
 * Export to Excel (CSV format)
 * Exports all transactions to a CSV file for download
 * @returns {void}
 */
export function exportToExcel() {
  const data = stateManager.getActiveData();
  const tx = data.transactions || [];
  
  // Create CSV content
  let csv = 'Date,Description,Type,Category,Amount\n';
  tx.forEach(t => {
    const cat = data.categories.find(c => c.id === t.categoryId);
    csv += `${t.date},"${t.description}",${t.type},${cat?.name || 'Other'},${t.amount}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Exported to CSV (Excel-compatible)');
}

/**
 * Backup all data
 */
export function backupAllData() {
  const state = stateManager.getState();
  const backup = {
    state: state,
    settings: settings,
    timestamp: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Backup created');
}

/**
 * Export data to JSON file
 * Downloads complete application state as a JSON file
 * @returns {void}
 */
export function exportJson() {
  const state = stateManager.getState();
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'budget-data.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON exported');
}

/**
 * Import data from JSON file
 * Reads a JSON file and restores application state, with confirmation dialog
 * @returns {void}
 */
export function importJson() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json';
  
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        
        // Must contain our profile-based structure
        if (!obj.profiles || !obj.dataByProfile) {
          showToast('Invalid JSON structure', TOAST_TYPES.ERROR);
          return;
        }
        
        stateManager.loadState(obj);
        renderAll();
        showToast('JSON imported');
      } catch (err) {
        logger.error('Error importing JSON:', err);
        showToast('Failed to parse JSON', TOAST_TYPES.ERROR);
      }
    };
    
    reader.readAsText(file);
  };
  
  inp.click();
}

/**
 * Clear all data from the application
 * Removes all transactions, categories, goals, debts, and recurring transactions after confirmation
 * @returns {Promise<void>}
 * @throws {Error} If clearing data fails
 */
export async function clearData() {
  const confirmMessage = "Are you sure you want to clear ALL data for the current budget?\n\nThis will delete:\n- All transactions\n- All savings goals\n- All financial goals\n- All debts\n- All recurring transactions\n- Categories will be reset to defaults\n\nThis action cannot be undone!";
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  // Double confirmation for safety
  if (!confirm("This is your last chance! Click OK to permanently delete all data for this budget.")) {
    return;
  }
  
  // Clear from Supabase if available
  if (useSupabase && currentBudget && currentUser && transactionService && goalService && debtService && recurringService && categoryService) {
    try {
      // Immediately clear local UI state so the dashboard updates right away
      // (Supabase deletes can take a bit; this avoids the UI looking "stuck")
      const localData = stateManager.getActiveData();
      if (localData) {
        localData.transactions = [];
        localData.savingsGoals = [];
        localData.financialGoals = [];
        localData.debts = [];
        localData.recurringTransactions = [];
        localData.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        localData.lastImportBatchIds = [];
        localData.bankConnections = [];
        stateManager.setActiveData(localData);
        stateManager.saveState();
        renderAll();
      }

      showToast('Clearing data from Supabase...', 'Clearing');
      
      // Get all data first to get IDs for deletion
      const { data: transactions } = await transactionService.getTransactions(currentBudget.id);
      const { data: savingsGoals } = await goalService.getSavingsGoals(currentBudget.id);
      const { data: financialGoals } = await goalService.getFinancialGoals(currentBudget.id);
      const { data: debts } = await debtService.getDebts(currentBudget.id);
      const { data: recurringTransactions } = await recurringService.getRecurringTransactions(currentBudget.id);
      const { data: categories } = await categoryService.getCategories(currentBudget.id);
      
      // Delete all transactions
      if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
          await transactionService.deleteTransaction(tx.id);
        }
      }
      
      // Delete all savings goals
      if (savingsGoals && savingsGoals.length > 0) {
        for (const goal of savingsGoals) {
          await goalService.deleteSavingsGoal(goal.id);
        }
      }
      
      // Delete all financial goals
      if (financialGoals && financialGoals.length > 0) {
        for (const goal of financialGoals) {
          await goalService.deleteFinancialGoal(goal.id);
        }
      }
      
      // Delete all debts
      if (debts && debts.length > 0) {
        for (const debt of debts) {
          await debtService.deleteDebt(debt.id);
        }
      }
      
      // Delete all recurring transactions
      if (recurringTransactions && recurringTransactions.length > 0) {
        for (const rec of recurringTransactions) {
          await recurringService.deleteRecurringTransaction(rec.id);
        }
      }
      
      // Delete all custom categories (keep default ones or recreate them)
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          await categoryService.deleteCategory(cat.id);
        }
      }
      
      // Reload data (will show empty state)
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
      // Some flows don't re-render after load; ensure UI refresh
      renderAll();
      
      showToast('All data cleared from Supabase', 'Data Cleared');
    } catch (error) {
      logger.error('Error clearing data from Supabase:', error);
      showToast(`Error clearing data: ${error.message}`, TOAST_TYPES.ERROR);
    }
  } else {
    // Fallback to localStorage
    const data = stateManager.getActiveData();
    
    // Clear transactions
    data.transactions = [];
    
    // Clear savings goals
    data.savingsGoals = [];
    data.financialGoals = [];
    
    // Clear debts
    data.debts = [];
    
    // Clear recurring transactions
    data.recurringTransactions = [];
    
    // Reset categories to defaults
    data.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    
    // Clear import batch IDs
    data.lastImportBatchIds = [];
    
    // Clear bank connections
    data.bankConnections = [];
    
    stateManager.saveState();
    renderAll();
    showToast('All data cleared for this profile', 'Data Cleared');
  }
}

/**
 * Register all event handlers
 */
function registerEventHandlers() {
  // Profile menu
  const profileMenuBtn = document.getElementById('profileMenuBtn');
  if (profileMenuBtn) {
    profileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only one popover open at a time
      if (typeof window.closeNotificationsPanel === 'function') {
        window.closeNotificationsPanel();
      }
      const profileMenu = document.querySelector('.profile-menu');
      if (profileMenu) {
        profileMenu.classList.toggle('active');
      }
    });
  }

  // Edit profile/display name
  const editProfileNameBtn = document.getElementById('editProfileNameBtn');
  if (editProfileNameBtn) {
    editProfileNameBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const currentNameEl = document.getElementById('currentProfileName');
      const existingName = (currentNameEl?.textContent || '').trim();
      const newName = prompt('Edit name:', existingName);
      if (newName === null) return; // cancelled

      const trimmed = newName.trim();
      if (!trimmed) {
        showToast('Name cannot be empty', TOAST_TYPES.ERROR);
        return;
      }

      // Supabase mode: update profile display_name in Supabase
      if (stateManager.getUseSupabase()) {
        if (!currentUser?.id) {
          showToast('Not signed in', TOAST_TYPES.ERROR);
          return;
        }

        try {
          const services = await import('../services/supabase-browser.js');
          const { profileService } = services;
          const { error } = await profileService.updateProfile(currentUser.id, { display_name: trimmed });
          if (error) {
            showToast(`Error updating name: ${error.message || 'Unknown error'}`, TOAST_TYPES.ERROR);
            return;
          }

          // Update UI immediately
          if (currentNameEl) currentNameEl.textContent = trimmed;
          const profileInitial = document.getElementById('profileInitial');
          if (profileInitial) profileInitial.textContent = trimmed.charAt(0).toUpperCase();

          showToast('Name updated', TOAST_TYPES.SUCCESS);
        } catch (err) {
          logger.error('Error updating Supabase profile name:', err);
          showToast('Error updating name', TOAST_TYPES.ERROR);
        }

        return;
      }

      // LocalStorage mode: rename active profile
      const activeProfileId = stateManager.getActiveProfileId();
      const ok = stateManager.updateProfileName(activeProfileId, trimmed);
      if (!ok) {
        showToast('Could not update name', TOAST_TYPES.ERROR);
        return;
      }

      renderAll();
      showToast('Profile renamed', TOAST_TYPES.SUCCESS);
    });
  }
  
  // Close profile menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-menu')) {
      const profileMenu = document.querySelector('.profile-menu');
      if (profileMenu) {
        profileMenu.classList.remove('active');
      }
    }
  });
  
  // Close menu when clicking a menu item
  document.querySelectorAll('.profile-dropdown .menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const profileMenu = document.querySelector('.profile-menu');
      if (profileMenu) {
        profileMenu.classList.remove('active');
      }
    });
  });
  
  // Settings panel
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
  
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', closeSettings);
  }
  
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', openAddCategory);
  }
  
  const saveCategoryBtn = document.getElementById('saveCategoryBtn');
  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener('click', saveCategory);
  }
  
  const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
  if (cancelCategoryBtn) {
    cancelCategoryBtn.addEventListener('click', closeCategoryModal);
  }
  
  const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
  if (deleteCategoryBtn) {
    deleteCategoryBtn.addEventListener('click', deleteCategory);
  }
  
  // Settings controls
  const budgetAlertsEnabled = document.getElementById('budgetAlertsEnabled');
  if (budgetAlertsEnabled) {
    budgetAlertsEnabled.addEventListener('change', e => {
      settings.budgetAlertsEnabled = e.target.checked;
      saveSettings();
    });
  }
  
  const budgetAlertThreshold = document.getElementById('budgetAlertThreshold');
  if (budgetAlertThreshold) {
    budgetAlertThreshold.addEventListener('change', e => {
      settings.budgetAlertThreshold = parseInt(e.target.value) || 80;
      saveSettings();
    });
  }
  
  const currencySymbol = document.getElementById('currencySymbol');
  if (currencySymbol) {
    currencySymbol.addEventListener('change', e => {
      settings.currencySymbol = e.target.value || '$';
      saveSettings();
      renderAll();
    });
  }
  
  const dateFormat = document.getElementById('dateFormat');
  if (dateFormat) {
    dateFormat.addEventListener('change', e => {
      settings.dateFormat = e.target.value;
      saveSettings();
      renderAll();
    });
  }
  
  // Export buttons
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportToPdf);
  }
  
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', exportToExcel);
  }
  
  const backupDataBtn = document.getElementById('backupDataBtn');
  if (backupDataBtn) {
    backupDataBtn.addEventListener('click', backupAllData);
  }
  
  const clearDataBtn = document.getElementById('clearDataBtn');
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', clearData);
  }
  
  // Theme toggle in settings
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', toggleTheme);
  }
  
  // Recurring transactions
  const addRecurringBtn = document.getElementById('addRecurringBtn');
  if (addRecurringBtn) {
    addRecurringBtn.addEventListener('click', addRecurring);
  }
  
  const saveRecurringBtn = document.getElementById('saveRecurringBtn');
  if (saveRecurringBtn) {
    saveRecurringBtn.addEventListener('click', saveRecurring);
  }
  
  const cancelRecurringBtn = document.getElementById('cancelRecurringBtn');
  if (cancelRecurringBtn) {
    cancelRecurringBtn.addEventListener('click', closeRecurringModal);
  }
  
  const deleteRecurringBtn = document.getElementById('deleteRecurringBtn');
  if (deleteRecurringBtn) {
    deleteRecurringBtn.addEventListener('click', () => {
      if (editingRecurringId) {
        deleteRecurring(editingRecurringId);
      }
    });
  }
  
  // Debt tracking
  const addDebtBtn = document.getElementById('addDebtBtn');
  if (addDebtBtn) {
    addDebtBtn.addEventListener('click', addDebt);
  }
  
  const saveDebtBtn = document.getElementById('saveDebtBtn');
  if (saveDebtBtn) {
    saveDebtBtn.addEventListener('click', saveDebt);
  }
  
  const cancelDebtBtn = document.getElementById('cancelDebtBtn');
  if (cancelDebtBtn) {
    cancelDebtBtn.addEventListener('click', closeDebtModal);
  }
  
  const deleteDebtBtn = document.getElementById('deleteDebtBtn');
  if (deleteDebtBtn) {
    deleteDebtBtn.addEventListener('click', () => {
      if (editingDebtId) {
        deleteDebt(editingDebtId);
      }
    });
  }
  
  // Financial goals
  const addFinancialGoalBtn = document.getElementById('addFinancialGoalBtn');
  if (addFinancialGoalBtn) {
    addFinancialGoalBtn.addEventListener('click', openAddFinancialGoal);
  }
  
  const saveFinancialGoalBtn = document.getElementById('saveFinancialGoalBtn');
  if (saveFinancialGoalBtn) {
    saveFinancialGoalBtn.addEventListener('click', saveFinancialGoal);
  }
  
  const cancelFinancialGoalBtn = document.getElementById('cancelFinancialGoalBtn');
  if (cancelFinancialGoalBtn) {
    cancelFinancialGoalBtn.addEventListener('click', closeFinancialGoalModal);
  }
  
  const deleteFinancialGoalBtn = document.getElementById('deleteFinancialGoalBtn');
  if (deleteFinancialGoalBtn) {
    deleteFinancialGoalBtn.addEventListener('click', () => {
      if (editingFinancialGoalId) {
        deleteFinancialGoal(editingFinancialGoalId);
      }
    });
  }
  
  // Transaction handlers
  const addTransactionBtn = document.getElementById('addTransactionBtn');
  if (addTransactionBtn) {
    // Guard against double-binding (transactions module may also bind as a fallback)
    if (!addTransactionBtn.dataset.boundOpenDrawerForAdd) {
      addTransactionBtn.addEventListener('click', openDrawerForAdd);
      addTransactionBtn.dataset.boundOpenDrawerForAdd = '1';
    }
  }
  
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', handleDeleteSelected);
  }
  
  // Month/year selectors
  const monthSelect = document.getElementById('monthSelect');
  const yearSelect = document.getElementById('yearSelect');
  if (monthSelect && yearSelect) {
    monthSelect.addEventListener('change', handleMonthYearChange);
    yearSelect.addEventListener('change', handleMonthYearChange);
  }
  
  // Toggle all months
  const toggleAllMonthsBtn = document.getElementById('toggleAllMonthsBtn');
  if (toggleAllMonthsBtn) {
    toggleAllMonthsBtn.addEventListener('click', toggleAllMonths);
  }
  
  // Bank connection and CSV import
  const connectBankBtn = document.getElementById('connectBankBtn');
  if (connectBankBtn) {
    connectBankBtn.addEventListener('click', connectBank);
  }
  
  const importCsvBtn = document.getElementById('importCsvBtn');
  if (importCsvBtn) {
    importCsvBtn.addEventListener('click', importCsv);
  }
  
  const undoImportBtn = document.getElementById('undoImportBtn');
  if (undoImportBtn) {
    undoImportBtn.addEventListener('click', undoImport);
  }
  
  // Import/Export JSON buttons
  const importJsonBtn = document.getElementById('importJsonBtn');
  if (importJsonBtn) {
    importJsonBtn.addEventListener('click', importJson);
  }
  
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', exportJson);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out?')) {
        try {
          const integration = await import('../services/supabase-integration.js');
          await integration.logout();
        } catch (error) {
          logger.error('Error logging out:', error);
          showToast('Error signing out', TOAST_TYPES.ERROR);
        }
      }
    });
  }
  
  // Transaction drawer buttons
  const drawerCancelBtn = document.getElementById('drawerCancelBtn');
  if (drawerCancelBtn) {
    drawerCancelBtn.addEventListener('click', async () => {
      const { closeDrawer } = await import('./transactions.js');
      closeDrawer();
    });
  }
  
  const drawerSaveBtn = document.getElementById('drawerSaveBtn');
  if (drawerSaveBtn) {
    drawerSaveBtn.addEventListener('click', async () => {
      const { saveTransactionFromDrawer } = await import('./transactions.js');
      await saveTransactionFromDrawer();
    });
  }
  
  // Transaction selection mode buttons
  const editModeBtn = document.getElementById('editModeBtn');
  if (editModeBtn) {
    editModeBtn.addEventListener('click', async () => {
      const { enterSelectionMode } = await import('./transactions.js');
      const { SELECTION_MODES } = await import('./constants.js');
      enterSelectionMode(SELECTION_MODES.EDIT);
    });
  }
  
  const deleteModeBtn = document.getElementById('deleteModeBtn');
  if (deleteModeBtn) {
    deleteModeBtn.addEventListener('click', async () => {
      const { enterSelectionMode } = await import('./transactions.js');
      const { SELECTION_MODES } = await import('./constants.js');
      enterSelectionMode(SELECTION_MODES.DELETE);
    });
  }
  
  const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
  if (cancelSelectionBtn) {
    cancelSelectionBtn.addEventListener('click', async () => {
      const { exitSelectionMode } = await import('./transactions.js');
      exitSelectionMode();
    });
  }
  
  // Add goal button (savings goal)
  const addGoalBtn = document.getElementById('addGoalBtn');
  if (addGoalBtn) {
    addGoalBtn.addEventListener('click', addSavingsGoal);
  }
  
  // Budget settings modal buttons (set up when modal opens, but also register here for safety)
  const closeBudgetSettingsBtn = document.getElementById('closeBudgetSettingsBtn');
  if (closeBudgetSettingsBtn) {
    closeBudgetSettingsBtn.addEventListener('click', () => {
      const modal = document.getElementById('budgetSettingsModal');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  }
  
  const generateInviteBtn = document.getElementById('generateInviteBtn');
  if (generateInviteBtn) {
    generateInviteBtn.addEventListener('click', generateInviteCode);
  }
  
  const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
  if (copyInviteLinkBtn) {
    copyInviteLinkBtn.addEventListener('click', () => {
      const inviteCodeText = document.getElementById('inviteCodeText');
      if (inviteCodeText && inviteCodeText.textContent && inviteCodeText.textContent !== 'Loading...' && inviteCodeText.textContent !== 'No active invite') {
        const inviteCode = inviteCodeText.textContent.trim();
        const inviteLink = `${window.location.origin}/auth.html?invite=${inviteCode}`;
        navigator.clipboard.writeText(inviteLink).then(() => {
          showToast('Invite link copied to clipboard', TOAST_TYPES.SUCCESS);
        }).catch(() => {
          showToast('Failed to copy link', TOAST_TYPES.ERROR);
        });
      } else {
        showToast('No active invite code to copy', TOAST_TYPES.ERROR);
      }
    });
  }
  
  const deleteBudgetBtn = document.getElementById('deleteBudgetBtn');
  if (deleteBudgetBtn) {
    deleteBudgetBtn.addEventListener('click', deleteCurrentBudget);
  }
  
  // Close modals when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });
}

/**
 * Get current settings object
 * Returns the settings object containing budget alerts, currency, and date format preferences
 * @returns {Object} Settings object with budgetAlertsEnabled, budgetAlertThreshold, currencySymbol, dateFormat
 */
export function getSettings() {
  return settings;
}

/**
 * Connect bank account via Plaid
 * Initializes Plaid Link and opens the bank connection flow
 * @returns {Promise<void>}
 * @throws {Error} If Plaid initialization or connection fails
 */
let plaidLink = null;

function isSavingsLikePlaidAccount(account) {
  const type = (account?.type || '').toLowerCase();
  const subtype = (account?.subtype || '').toLowerCase();
  if (type !== 'depository') return false;
  return subtype === 'savings' || subtype === 'money market' || subtype === 'money_market' || subtype === 'cd';
}

function classifyPlaidAccounts(accounts = []) {
  const transactionAccountIds = [];
  const savingsAccountIds = [];

  accounts.forEach(a => {
    const id = a?.id;
    if (!id) return;
    if (isSavingsLikePlaidAccount(a)) {
      savingsAccountIds.push(id);
      return;
    }
    // Treat checking + credit card accounts as transaction sources
    transactionAccountIds.push(id);
  });

  return { transactionAccountIds, savingsAccountIds };
}

async function fetchPlaidAccounts(access_token) {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || `Server error: ${response.status}`;
    throw new Error(errorMessage);
  }

  const { accounts } = await response.json();
  return Array.isArray(accounts) ? accounts : [];
}

function upsertLinkedSavingsGoal(totalBalance, institutionName, accountCount) {
  const data = stateManager.getActiveData();
  if (!data.savingsGoals) data.savingsGoals = [];

  const GOAL_ID = 'goal_linked_savings';
  const existing = data.savingsGoals.find(g => g.id === GOAL_ID);
  const name = institutionName ? `Linked Savings (${institutionName})` : 'Linked Savings';

  // If no savings balance and no existing goal, don't add noise.
  if ((!totalBalance || totalBalance <= 0) && !existing) return false;

  if (existing) {
    existing.name = name;
    existing.current = totalBalance || 0;
    // Keep target >= current so bar doesn't exceed 100%
    existing.target = Math.max(existing.target || 0, existing.current || 0, 1);
    existing.readOnly = true;
    existing.linkedBank = true;
    existing.linkedMeta = { institutionName: institutionName || null, accountCount: accountCount || 0 };
  } else {
    data.savingsGoals.unshift({
      id: GOAL_ID,
      name,
      target: Math.max(totalBalance || 0, 1),
      current: totalBalance || 0,
      readOnly: true,
      linkedBank: true,
      linkedMeta: { institutionName: institutionName || null, accountCount: accountCount || 0 }
    });
  }

  stateManager.saveState();
  return true;
}

async function updateLinkedSavingsFromBank(access_token, savingsAccountIds, institutionName) {
  if (!Array.isArray(savingsAccountIds) || savingsAccountIds.length === 0) return;

  const accounts = await fetchPlaidAccounts(access_token);
  const idSet = new Set(savingsAccountIds);
  const savingsAccounts = accounts.filter(a => idSet.has(a.account_id));

  const totalBalance = savingsAccounts.reduce((sum, a) => {
    const b = a?.balances || {};
    const n = (typeof b.current === 'number' ? b.current : (typeof b.available === 'number' ? b.available : 0));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const updated = upsertLinkedSavingsGoal(totalBalance, institutionName, savingsAccounts.length);
  if (updated) {
    renderAll();
  }
}

export async function connectBank() {
  try {
    const data = stateManager.getActiveData();
    const activeProfileId = stateManager.getActiveProfileId();
    
    // Get link token from backend
    const response = await fetch(`${API_BASE_URL}/create_link_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activeProfileId })
    });

    if (!response.ok) {
      throw new Error('Failed to create link token. Make sure the server is running.');
    }

    const { link_token } = await response.json();

    // Initialize Plaid Link
    if (plaidLink) {
      plaidLink.destroy();
    }

    plaidLink = Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        // Exchange public token for access token
        const exchangeResponse = await fetch(`${API_BASE_URL}/exchange_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token })
        });

        const { access_token, item_id } = await exchangeResponse.json();

        const selectedAccounts = Array.isArray(metadata?.accounts) ? metadata.accounts : [];
        const { transactionAccountIds, savingsAccountIds } = classifyPlaidAccounts(selectedAccounts);
        
        // Store access token (in a real app, you'd want to encrypt this)
        if (!data.bankConnections) data.bankConnections = [];
        data.bankConnections.push({
          item_id,
          access_token,
          institution: metadata.institution?.name || 'Unknown',
          accounts: selectedAccounts,
          transactionAccountIds,
          savingsAccountIds
        });
        stateManager.saveState();

        // Update linked savings goal(s) from selected savings accounts
        await updateLinkedSavingsFromBank(access_token, savingsAccountIds, metadata.institution?.name);

        // Fetch and import transactions (checking + credit, excluding savings)
        await importBankTransactions(access_token, { accountIds: transactionAccountIds });
        
        showToast(`Connected to ${metadata.institution?.name || 'bank'}`, TOAST_TYPES.BANK_CONNECTED);
      },
      onExit: (err, metadata) => {
        if (err) {
          logger.error('Plaid Link error:', err);
          logger.error('Plaid Link metadata:', metadata);
          showToast(`Connection error: ${err.error_message || err.display_message || 'Unknown error'}`, TOAST_TYPES.CONNECTION_ERROR);
        } else {
          showToast('Bank connection cancelled', TOAST_TYPES.INFO);
        }
      },
      onEvent: (eventName, metadata) => {
        logger.log('Plaid Link event:', eventName, metadata);
        if (eventName === 'ERROR' && metadata) {
          logger.error('Plaid Link error event:', metadata);
        }
      },
    });

    plaidLink.open();
  } catch (error) {
    logger.error('Bank connection error:', error);
    showToast(`Error: ${error.message}. Make sure the server is running on port ${API_SERVER_PORT}.`, 'Connection Error');
  }
}

/**
 * Import bank transactions from Plaid
 */
export async function importBankTransactions(access_token, retryCount = 0) {
  try {
    // Backwards compatibility: allow passing options as 2nd arg
    let options = {};
    if (typeof retryCount === 'object' && retryCount !== null) {
      options = retryCount;
      retryCount = arguments.length >= 3 ? arguments[2] : 0;
    }

    // Validate access_token
    if (!access_token) {
      throw new Error('Access token is required. Please reconnect your bank account.');
    }

    // Get last N days of transactions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - TRANSACTION_HISTORY_DAYS);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
      throw new Error(`Invalid date format. Expected YYYY-MM-DD, got start: ${startDateStr}, end: ${endDateStr}`);
    }

    logger.log('Fetching bank transactions...', {
      start_date: startDateStr,
      end_date: endDateStr,
      retry: retryCount,
      has_access_token: !!access_token
    });

    const requestBody = {
      access_token: access_token,
      start_date: startDateStr,
      end_date: endDateStr
    };
    if (Array.isArray(options.accountIds) && options.accountIds.length > 0) {
      requestBody.account_ids = options.accountIds;
    }

    logger.log('Request body:', { ...requestBody, access_token: access_token ? '***' : 'MISSING' });

    const response = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `Server error: ${response.status}`;
      const details = errorData.details || {};
      const plaidErrorCode = (details.error_code || '').toString();
      const requestId = details.request_id;

      // Retry ONLY for Plaid "product not ready" / processing states
      const msgLower = (errorMessage || '').toLowerCase();
      const isNotReady =
        plaidErrorCode === 'PRODUCT_NOT_READY' ||
        msgLower.includes('not yet ready') ||
        msgLower.includes('product not ready') ||
        msgLower.includes('webhook');

      if (isNotReady) {
        if (retryCount < RETRY_CONFIG.MAX_RETRIES) {
          const delay = RETRY_CONFIG.BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
          logger.log(
            `Transactions not ready yet. Retrying in ${delay / 1000} seconds... (${retryCount + 1}/${RETRY_CONFIG.MAX_RETRIES})`,
            { plaidErrorCode, requestId }
          );

          showToast(
            `Transactions are still processing. Retrying in ${delay / 1000} seconds...`,
            TOAST_TYPES.PROCESSING
          );

          await new Promise(resolve => setTimeout(resolve, delay));
          return importBankTransactions(access_token, options, retryCount + 1);
        }

        // Max retries reached
        showToast(
          `Transactions are still processing. Please wait a few minutes and try importing again.${requestId ? ` (Request ID: ${requestId})` : ''}`,
          TOAST_TYPES.PROCESSING
        );
        return;
      }

      const requestIdSuffix = requestId ? ` (Request ID: ${requestId})` : '';
      throw new Error(`${errorMessage}${requestIdSuffix}`);
    }

    const responseData = await response.json();
    const transactions = responseData.transactions || [];
    
    logger.log(`Received ${transactions.length} transactions from server`);
    
    if (!transactions || transactions.length === 0) {
      showToast(`No transactions found in the last ${TRANSACTION_HISTORY_DAYS} days. Try connecting to a different test account.`, TOAST_TYPES.INFO);
      return;
    }

    const data = stateManager.getActiveData();
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const categoryIdSet = new Set(categories.map(c => c?.id).filter(Boolean));
    const defaultCat =
      categories.find(c => (c?.id || '').toLowerCase() === 'other')?.id ||
      categories.find(c => (c?.name || '').toLowerCase() === 'other')?.id ||
      categories[0]?.id ||
      null;

    // Dedupe by plaid_id
    const existingByPlaidId = new Map();
    (Array.isArray(data.transactions) ? data.transactions : []).forEach(t => {
      if (t && t.plaid_id) existingByPlaidId.set(t.plaid_id, t);
    });

    const incoming = (Array.isArray(transactions) ? transactions : []).filter(t => t && t.plaid_id);
    const toInsert = incoming.filter(t => !existingByPlaidId.has(t.plaid_id));

    // Supabase mode: write imported transactions to Supabase (so they get real UUID ids)
    if (useSupabase && currentBudget && currentUser && transactionService) {
      if (toInsert.length === 0) {
        showToast('No new bank transactions to import', TOAST_TYPES.INFO);
        return;
      }

      const rows = toInsert.map(tx => ({
        date: tx.date,
        description: tx.description,
        amount: Number(tx.amount),
        type: tx.type,
        category_id: isValidUUID(defaultCat) ? defaultCat : null,
        merchant: tx.merchant || null,
        notes: tx.note || null,
        plaid_id: tx.plaid_id || null,
        account_id: tx.account_id || null
      }));

      // Insert in bulk if available
      if (typeof transactionService.bulkCreateTransactions === 'function') {
        const { error } = await transactionService.bulkCreateTransactions(currentBudget.id, currentUser.id, rows);
        if (error) throw error;
      } else {
        for (const row of rows) {
          const { error } = await transactionService.createTransaction(currentBudget.id, currentUser.id, row);
          if (error) throw error;
        }
      }

      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
      renderAll();
      showToast(`Imported ${toInsert.length} bank transaction${toInsert.length === 1 ? '' : 's'}`, TOAST_TYPES.SUCCESS);
      return;
    }

    // LocalStorage mode: merge into local transactions and preserve/repair categories
    let added = 0;
    let updated = 0;

    incoming.forEach(tx => {
      const existing = existingByPlaidId.get(tx.plaid_id);
      if (!existing) {
        tx.categoryId = defaultCat || tx.categoryId || 'other';
        data.transactions.push(tx);
        added++;
        return;
      }

      const preservedCategoryId = existing.categoryId;
      existing.date = tx.date;
      existing.description = tx.description;
      existing.amount = tx.amount;
      existing.type = tx.type;
      existing.note = tx.note;
      existing.account_id = tx.account_id;

      if (!preservedCategoryId || (defaultCat && !categoryIdSet.has(preservedCategoryId))) {
        existing.categoryId = defaultCat || preservedCategoryId || 'other';
      }
      updated++;
    });

    stateManager.saveState();
    renderAll();
    const msg = updated > 0
      ? `Imported ${added} new and updated ${updated} existing transactions from bank`
      : `Imported ${added} transactions from bank`;
    showToast(msg, 'Bank Import');
  } catch (error) {
    logger.error('Error importing transactions:', error);
    showToast(error?.message || 'Error importing transactions', TOAST_TYPES.ERROR);
  }
}

/**
 * Import transactions from CSV file
 * Reads a CSV file, parses transaction data, and imports into the application
 * Supports date, description, amount, type, and category columns
 * @returns {void}
 */
export function importCsv() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.csv,text/csv';

  inp.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result;
      const lines = text.split(/\r?\n/).filter(x => x.trim());

      const data = stateManager.getActiveData();
      const categories = Array.isArray(data.categories) ? data.categories : [];
      const defaultCat =
        categories.find(c => (c.id || '').toLowerCase() === 'other')?.id ||
        categories.find(c => (c.name || '').toLowerCase() === 'other')?.id ||
        categories[0]?.id ||
        'other';

      const imported = [];

      function normalizeDate(raw) {
        raw = raw.replace(/^"|"$/g, '').trim();

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        // MM/DD/YYYY → YYYY-MM-DD
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
          const [mm, dd, yyyy] = raw.split('/');
          return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }

        return null;
      }

      function normalizeAmount(raw) {
        raw = raw.replace(/^"|"$/g, '').trim();
        raw = raw.replace(/[^0-9.\-]/g, ''); // remove junk
        if (!raw) return null;
        const n = parseFloat(raw);
        return isNaN(n) ? null : n;
      }

      function findCategoryId(token) {
        const raw = (token || '').replace(/^"|"$/g, '').trim();
        if (!raw) return defaultCat;
        const key = raw.toLowerCase();

        const found = categories.find(c =>
          (c.id && c.id.toLowerCase() === key) ||
          (c.name && c.name.toLowerCase() === key)
        );
        return found ? found.id : defaultCat;
      }

      function buildTx({ dateStr, desc, rawAmount, typeToken, categoryToken }) {
        if (!dateStr) return null;
        if (rawAmount === null) return null;

        const description = (desc || '').toString().trim();
        if (!description) return null;

        // Determine type (explicit wins; otherwise infer from sign)
        const explicitType = (typeToken || '').toString().trim().toLowerCase();
        const inferredType = rawAmount < 0 ? 'expense' : 'income';
        const type = (explicitType === 'income' || explicitType === 'expense') ? explicitType : inferredType;

        // Category token may actually be a type token in some CSV formats (e.g. "income")
        let categoryKey = (categoryToken || '').toString().trim();
        if (categoryKey && (categoryKey.toLowerCase() === 'income' || categoryKey.toLowerCase() === 'expense')) {
          categoryKey = ''; // ignore
        }

        const catId = findCategoryId(categoryKey);

        return {
          id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          date: dateStr,
          description,
          amount: Math.abs(rawAmount),
          type,
          categoryId: catId
        };
      }

      for (let line of lines) {
        // Smart split that respects quotes
        let cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
        if (!cols || cols.length < CSV_CONFIG.MIN_COLUMNS) continue;

        // Trim and strip quotes
        cols = cols.map(c => c.replace(/^"|"$/g, '').trim());

        const dateStr = normalizeDate(cols[0]);
        if (!dateStr) continue;

        // Supported formats:
        // A) date, description, amount, type, category
        // B) date, amount, description, category (type inferred from amount sign; income rows may contain "income")
        // C) date, description, amount, category (type inferred)
        // D) date, amount, description

        let tx = null;

        // Try A: [date, desc, amount, type, category]
        tx = buildTx({
          dateStr,
          desc: cols[1],
          rawAmount: normalizeAmount(cols[2]),
          typeToken: cols[3],
          categoryToken: cols[4]
        });

        // Try B: [date, amount, desc, categoryOrType]
        if (!tx) {
          const rawAmt = normalizeAmount(cols[1]);
          if (rawAmt !== null) {
            tx = buildTx({
              dateStr,
              desc: cols[2],
              rawAmount: rawAmt,
              typeToken: '', // infer
              categoryToken: cols[3]
            });
          }
        }

        // Try C: [date, desc, amount, categoryOrType]
        if (!tx) {
          const rawAmt = normalizeAmount(cols[2]);
          if (rawAmt !== null) {
            tx = buildTx({
              dateStr,
              desc: cols[1],
              rawAmount: rawAmt,
              typeToken: '', // infer
              categoryToken: cols[3]
            });
          }
        }

        // Try D: [date, amount, desc]
        if (!tx) {
          const rawAmt = normalizeAmount(cols[1]);
          if (rawAmt !== null) {
            tx = buildTx({
              dateStr,
              desc: cols[2],
              rawAmount: rawAmt,
              typeToken: '', // infer
              categoryToken: ''
            });
          }
        }

        if (tx) imported.push(tx);
      }

      if (imported.length === 0) {
        showToast('No valid transactions found in CSV', TOAST_TYPES.ERROR);
        return;
      }

      // Deduplicate against existing transactions (prevents re-importing the same CSV twice)
      // Fingerprint: date + type + amount(cents) + normalized description
      function normalizeDesc(s) {
        return (s || '')
          .toString()
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
      }
      function toCents(n) {
        const num = Number(n);
        if (!isFinite(num)) return null;
        return Math.round(num * 100);
      }
      function txFingerprint(t) {
        const cents = toCents(t.amount);
        return `${t.date}|${t.type}|${cents}|${normalizeDesc(t.description)}`;
      }

      const existingTx = Array.isArray(data.transactions) ? data.transactions : [];
      const existingSet = new Set(existingTx.map(txFingerprint));
      const batchSet = new Set();
      let duplicates = 0;
      const uniqueImported = [];

      for (const tx of imported) {
        const fp = txFingerprint(tx);
        if (existingSet.has(fp) || batchSet.has(fp)) {
          duplicates++;
          continue;
        }
        batchSet.add(fp);
        uniqueImported.push(tx);
      }

      if (uniqueImported.length === 0) {
        showToast(
          `No new transactions to import (skipped ${duplicates} duplicate${duplicates === 1 ? '' : 's'})`,
          TOAST_TYPES.INFO
        );
        return;
      }

      // Add to transactions
      // Save to Supabase if available
      if (useSupabase && currentBudget && currentUser && transactionService) {
        try {
          // Optimistic UI update so the app refreshes immediately after import
          // (Supabase reload can be async/racey; this prevents the UI from looking stuck.)
          const optimisticIds = uniqueImported.map(t => t.id);
          try {
            stateManager.setActiveProfileId(currentBudget.id);
            const localData = stateManager.getActiveData();
            if (localData) {
              localData.transactions = Array.isArray(localData.transactions) ? localData.transactions : [];
              localData.transactions.push(...uniqueImported);
              localData.lastImportBatchIds = optimisticIds;
              stateManager.setActiveData(localData);
              stateManager.saveState();
              renderAll();
            }
          } catch {
            // no-op
          }

          // Validate amounts against database DECIMAL(10, 2) limit (max: 99,999,999.99)
          const MAX_AMOUNT = 99999999.99;
          const validRows = [];
          const skippedRows = [];
          
          for (const tx of uniqueImported) {
            const amount = parseFloat(tx.amount);
            if (isNaN(amount) || Math.abs(amount) >= MAX_AMOUNT) {
              skippedRows.push({
                description: tx.description,
                amount: tx.amount,
                reason: isNaN(amount) ? 'Invalid amount' : 'Amount too large (max: $99,999,999.99)'
              });
              continue;
            }
            
            validRows.push({
              date: tx.date,
              description: tx.description,
              amount: amount,
              type: tx.type,
              category_id: isValidUUID(tx.categoryId) ? tx.categoryId : null
            });
          }
          
          if (validRows.length === 0) {
            showToast(
              `No valid transactions to import. ${skippedRows.length > 0 ? `Skipped ${skippedRows.length} transaction(s) with invalid amounts.` : ''}`,
              TOAST_TYPES.ERROR
            );
            return;
          }
          
          if (skippedRows.length > 0) {
            logger.warn(`Skipped ${skippedRows.length} transaction(s) with invalid amounts:`, skippedRows);
            showToast(
              `Skipped ${skippedRows.length} transaction(s) with invalid amounts (max: $99,999,999.99). Importing ${validRows.length} valid transaction(s)...`,
              TOAST_TYPES.WARNING
            );
          }

          // Prefer bulk insert to avoid spamming requests
          if (typeof transactionService.bulkCreateTransactions === 'function') {
            const { error } = await transactionService.bulkCreateTransactions(currentBudget.id, currentUser.id, validRows);
            if (error) {
              throw error;
            }
          } else {
            // Fallback: single inserts (correct signature)
            for (const row of validRows) {
              const { error } = await transactionService.createTransaction(currentBudget.id, currentUser.id, row);
              if (error) {
                throw error;
              }
            }
          }

          if (loadDataFromSupabase) {
            await loadDataFromSupabase();
          }
          // Ensure visible refresh even if loadDataFromSupabase bails early
          renderAll();

          const successMsg = `Imported ${validRows.length} transaction${validRows.length === 1 ? '' : 's'} from CSV` +
            (duplicates ? ` (skipped ${duplicates} duplicate${duplicates === 1 ? '' : 's'})` : '') +
            (skippedRows.length > 0 ? ` (skipped ${skippedRows.length} invalid amount${skippedRows.length === 1 ? '' : 's'})` : '');
          showToast(successMsg, TOAST_TYPES.SUCCESS);
          return;
        } catch (error) {
          // Roll back optimistic UI rows (if any)
          try {
            const localData = stateManager.getActiveData();
            if (localData && Array.isArray(localData.transactions) && Array.isArray(localData.lastImportBatchIds)) {
              const rollbackIds = new Set(localData.lastImportBatchIds);
              localData.transactions = localData.transactions.filter(t => !rollbackIds.has(t.id));
              localData.lastImportBatchIds = [];
              stateManager.setActiveData(localData);
              stateManager.saveState();
              renderAll();
            }
          } catch {
            // no-op
          }
          logger.error('Error saving CSV transactions to Supabase:', error);
          
          // Extract meaningful error message from Supabase error object
          let errorMsg = 'Unknown error';
          if (error) {
            if (typeof error === 'string') {
              errorMsg = error;
            } else if (error.message) {
              errorMsg = error.message;
            } else if (error.details) {
              errorMsg = error.details;
            } else if (error.hint) {
              errorMsg = error.hint;
            } else if (error.code) {
              errorMsg = `Error code: ${error.code}`;
            } else {
              // Last resort: try to stringify the error
              try {
                errorMsg = JSON.stringify(error);
              } catch {
                errorMsg = String(error);
              }
            }
          }
          
          showToast(`Error importing CSV to Supabase: ${errorMsg}`, TOAST_TYPES.ERROR);
          return;
        }
      }

      // LocalStorage mode
      // Validate amounts (same limit as database for consistency)
      const MAX_AMOUNT = 99999999.99;
      const validForLocal = [];
      const skippedForLocal = [];
      
      for (const tx of uniqueImported) {
        const amount = parseFloat(tx.amount);
        if (isNaN(amount) || Math.abs(amount) >= MAX_AMOUNT) {
          skippedForLocal.push({
            description: tx.description,
            amount: tx.amount,
            reason: isNaN(amount) ? 'Invalid amount' : 'Amount too large (max: $99,999,999.99)'
          });
          continue;
        }
        validForLocal.push(tx);
      }
      
      if (validForLocal.length === 0) {
        showToast(
          `No valid transactions to import. ${skippedForLocal.length > 0 ? `Skipped ${skippedForLocal.length} transaction(s) with invalid amounts.` : ''}`,
          TOAST_TYPES.ERROR
        );
        return;
      }
      
      if (skippedForLocal.length > 0) {
        logger.warn(`Skipped ${skippedForLocal.length} transaction(s) with invalid amounts:`, skippedForLocal);
      }
      
      data.transactions.push(...validForLocal);
      data.lastImportBatchIds = validForLocal.map(t => t.id);
      stateManager.saveState();
      renderAll();
      
      const localSuccessMsg = `Imported ${validForLocal.length} transaction${validForLocal.length === 1 ? '' : 's'} from CSV` +
        (duplicates ? ` (skipped ${duplicates} duplicate${duplicates === 1 ? '' : 's'})` : '') +
        (skippedForLocal.length > 0 ? ` (skipped ${skippedForLocal.length} invalid amount${skippedForLocal.length === 1 ? '' : 's'})` : '');
      showToast(localSuccessMsg, TOAST_TYPES.SUCCESS);
    };

    reader.readAsText(file);
  };

  inp.click();
}

/**
 * Undo last import
 */
export function undoImport() {
  const data = stateManager.getActiveData();
  const ids = data.lastImportBatchIds || [];

  if (!ids.length) {
    showToast('Nothing to undo');
    return;
  }

  // Remove transactions from Supabase if available
  if (useSupabase && currentBudget && transactionService) {
    // Note: This would require tracking transaction IDs from Supabase
    // For now, just remove from local state
    data.transactions = data.transactions.filter(t => !ids.includes(t.id));
    data.lastImportBatchIds = [];
    
    if (loadDataFromSupabase) {
      loadDataFromSupabase();
    }
  } else {
    data.transactions = data.transactions.filter(t => !ids.includes(t.id));
    data.lastImportBatchIds = [];
    stateManager.saveState();
  }

  renderAll();
  showToast('Last import undone');
}

/**
 * Open budget settings modal
 */
export async function openBudgetSettings() {
  if (!currentBudget || !useSupabase) return;
  
  const modal = document.getElementById('budgetSettingsModal');
  if (!modal) return;
  
  document.getElementById('budgetSettingsTitle').textContent = `${currentBudget.name} Settings`;
  
  // Load members
  await loadBudgetMembers();
  
  // Show invite section for shared budgets
  const inviteSection = document.getElementById('budgetInviteSection');
  const dangerSection = document.getElementById('budgetDangerSection');
  
  // Invite section is shared-only
  if (currentBudget.type === 'shared') {
    if (inviteSection) inviteSection.style.display = 'block';
    await loadInviteCode();
  } else {
    if (inviteSection) inviteSection.style.display = 'none';
  }

  // Danger zone (Delete Budget) should show for ANY budget type if the current user is the owner
  if (dangerSection) {
    dangerSection.style.display = currentBudget.owner_id === currentUser?.id ? 'block' : 'none';
  }
  
  modal.classList.add('show');
}

/**
 * Load budget members
 */
async function loadBudgetMembers() {
  if (!currentBudget || !useSupabase) return;
  
  const membersList = document.getElementById('budgetMembersList');
  if (!membersList) return;
  
  try {
    const services = await import('../services/supabase-browser.js');
    const { budgetService } = services;
    
    const { data: members, error } = await budgetService.getBudgetMembers(currentBudget.id);
    if (error) {
      showToast(`Error loading members: ${error.message}`, TOAST_TYPES.ERROR);
      return;
    }
    
    membersList.innerHTML = '';
    
    if (!members || members.length === 0) {
      membersList.innerHTML = '<p>No members found</p>';
      return;
    }
    
    members.forEach(member => {
      const memberDiv = document.createElement('div');
      memberDiv.className = 'budget-member-item';
      memberDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;';
      
      const user = member.user || {};
      const userName = user.display_name || user.username || user.email || 'Unknown';
      const isOwner = member.role === 'owner';
      const isCurrentUser = member.user_id === currentUser?.id;
      const canRemove = currentBudget.owner_id === currentUser?.id && !isOwner && !isCurrentUser;
      
      memberDiv.innerHTML = `
        <div>
          <strong>${userName}</strong>
          <span style="margin-left: 8px; font-size: 12px; color: var(--text-secondary);">(${member.role})</span>
          ${isCurrentUser ? '<span style="margin-left: 8px; font-size: 11px; color: var(--accent);">(You)</span>' : ''}
        </div>
        ${canRemove ? `<button class="btn-danger" style="padding: 6px 12px; font-size: 12px;" data-member-id="${member.user_id}">Remove</button>` : ''}
      `;
      
      if (canRemove) {
        const removeBtn = memberDiv.querySelector('button');
        removeBtn.addEventListener('click', async () => {
          if (confirm(`Remove ${userName} from this budget?`)) {
            await removeBudgetMember(member.user_id);
          }
        });
      }
      
      membersList.appendChild(memberDiv);
    });
  } catch (error) {
    logger.error('Error loading members:', error);
    showToast('Error loading members', TOAST_TYPES.ERROR);
  }
}

/**
 * Remove budget member
 */
async function removeBudgetMember(userId) {
  if (!currentBudget || !useSupabase) return;
  
  try {
    const services = await import('../services/supabase-browser.js');
    const { budgetService } = services;
    
    const { error } = await budgetService.removeMember(currentBudget.id, userId);
    if (error) {
      logger.error('Error removing member:', error);
      showToast(`Error removing member: ${error.message || error.code || 'Unknown error'}`, TOAST_TYPES.ERROR);
      return;
    }
    
    // Reload members to verify deletion
    await loadBudgetMembers();
    
    // Double-check the member was actually removed
    const { data: members } = await budgetService.getBudgetMembers(currentBudget.id);
    const stillMember = members?.some(m => m.user_id === userId);
    
    if (stillMember) {
      showToast('Failed to remove member. You may not have permission.', TOAST_TYPES.ERROR);
      logger.error('Member still exists after delete attempt');
    } else {
      showToast('Member removed', TOAST_TYPES.SUCCESS);
    }
    
    // Reload budgets if current user was removed
    if (userId === currentUser?.id) {
      const integration = await import('../services/supabase-integration.js');
      await integration.loadUserData();
    }
  } catch (error) {
    logger.error('Error removing member:', error);
    showToast(`Error removing member: ${error.message || 'Unknown error'}`, TOAST_TYPES.ERROR);
  }
}

/**
 * Delete current budget
 */
export async function deleteCurrentBudget() {
  if (!currentBudget || !useSupabase || currentBudget.owner_id !== currentUser?.id) {
    showToast('Only budget owners can delete budgets', TOAST_TYPES.ERROR);
    return;
  }
  
  try {
    const services = await import('../services/supabase-browser.js');
    const { budgetService } = services;
    
    const { error } = await budgetService.deleteBudget(currentBudget.id);
    if (error) {
      showToast(`Error: ${error.message}`, TOAST_TYPES.ERROR);
      return;
    }
    
    showToast('Budget deleted', TOAST_TYPES.SUCCESS);
    const modal = document.getElementById('budgetSettingsModal');
    if (modal) {
      modal.classList.remove('show');
    }
    
    // Reload budgets
    const integration = await import('../services/supabase-integration.js');
    await integration.loadUserData();
  } catch (error) {
    logger.error('Error deleting budget:', error);
    showToast('Error deleting budget', TOAST_TYPES.ERROR);
  }
}

/**
 * Load invite code
 */
async function loadInviteCode() {
  if (!currentBudget || currentBudget.type !== 'shared') return;
  
  const inviteCodeText = document.getElementById('inviteCodeText');
  if (!inviteCodeText) return;
  
  try {
    const services = await import('../services/supabase-browser.js');
    const { inviteService } = services;
    
    const { data: invites, error } = await inviteService.getBudgetInvites(currentBudget.id);
    if (error) {
      inviteCodeText.textContent = 'Error loading invite';
      return;
    }
    
    // Find active invite (not used, not expired)
    const activeInvite = invites?.find(inv => !inv.used_at && new Date(inv.expires_at) > new Date());
    
    if (activeInvite) {
      inviteCodeText.textContent = activeInvite.invite_code;
    } else {
      inviteCodeText.textContent = 'No active invite';
    }
  } catch (error) {
    logger.error('Error loading invite:', error);
    inviteCodeText.textContent = 'Error';
  }
}

/**
 * Generate invite code
 */
export async function generateInviteCode() {
  if (!currentBudget || !useSupabase || currentBudget.owner_id !== currentUser?.id) {
    showToast('Only budget owners can generate invite codes', TOAST_TYPES.ERROR);
    return;
  }
  
  try {
    const services = await import('../services/supabase-browser.js');
    const { inviteService } = services;
    
    const { data, error } = await inviteService.createInvite(currentBudget.id, currentUser.id, INVITE_CODE_EXPIRATION_DAYS);
    if (error) {
      showToast(`Error: ${error.message}`, TOAST_TYPES.ERROR);
      return;
    }
    
    showToast('Invite code generated', TOAST_TYPES.SUCCESS);
    await loadInviteCode();
  } catch (error) {
    logger.error('Error generating invite:', error);
    showToast('Error generating invite', TOAST_TYPES.ERROR);
  }
}

/**
 * Join budget with invite code
 * Validates invite code and adds current user as a member of the shared budget
 * @returns {Promise<void>}
 * @throws {Error} If invite code is invalid, expired, or join operation fails
 */
export async function joinBudgetWithCode() {
  const codeInput = document.getElementById('inviteCodeInput');
  if (!codeInput) return;
  
    const code = codeInput.value.trim().toUpperCase();
    if (!code || code.length !== INVITE_CODE_LENGTH) {
      showToast(`Please enter a valid ${INVITE_CODE_LENGTH}-character invite code`, TOAST_TYPES.ERROR);
    return;
  }
  
  if (!useSupabase || !currentUser) {
    showToast('Please sign in to join a budget', TOAST_TYPES.ERROR);
    return;
  }
  
  try {
    const services = await import('../services/supabase-browser.js');
    const { inviteService, budgetService } = services;
    
    // Get invite
    const { data: invite, error: inviteError } = await inviteService.getInvite(code);
    if (inviteError || !invite) {
      showToast('Invalid or expired invite code', TOAST_TYPES.ERROR);
      return;
    }
    
    // Check if user is already a member
    const { data: existingMembers, error: checkError } = await budgetService.getBudgetMembers(invite.budget_id);
    const isAlreadyMember = existingMembers?.some(m => m.user_id === currentUser.id);
    
    if (isAlreadyMember) {
      showToast('You are already a member of this budget', TOAST_TYPES.INFO);
      const modal = document.getElementById('joinBudgetModal');
      if (modal) {
        modal.classList.remove('show');
      }
      codeInput.value = '';
      // Reload budgets
      const integration = await import('../services/supabase-integration.js');
      await integration.loadUserData();
      return;
    }
    
    // Add user as member
    const { error: memberError } = await budgetService.addMember(invite.budget_id, currentUser.id, 'member');
    if (memberError) {
      // Handle 409 Conflict (already a member) gracefully
      if (memberError.code === '23505' || memberError.message?.includes('duplicate') || memberError.message?.includes('unique')) {
        showToast('You are already a member of this budget', TOAST_TYPES.INFO);
        const modal = document.getElementById('joinBudgetModal');
        if (modal) {
          modal.classList.remove('show');
        }
        codeInput.value = '';
        // Reload budgets
        const integration = await import('../services/supabase-integration.js');
        await integration.loadUserData();
        return;
      }
      showToast(`Error: ${memberError.message}`, TOAST_TYPES.ERROR);
      return;
    }
    
    // Mark invite as used
    await inviteService.useInvite(code, currentUser.id);
    
    showToast('Successfully joined budget!', TOAST_TYPES.SUCCESS);
    const modal = document.getElementById('joinBudgetModal');
    if (modal) {
      modal.classList.remove('show');
    }
    codeInput.value = '';
    
    // Reload budgets
    const integration = await import('../services/supabase-integration.js');
    await integration.loadUserData();
  } catch (error) {
    logger.error('Error joining budget:', error);
    showToast('Error joining budget', TOAST_TYPES.ERROR);
  }
}

/**
 * Open manage budgets modal
 * Displays a list of all budgets the user has access to with options to manage each
 * @returns {Promise<void>}
 * @throws {Error} If loading budgets fails
 */
export async function openManageBudgets() {
  const modal = document.getElementById('manageBudgetsModal');
  if (!modal) return;
  
  // Load and display budgets
  const budgetsList = document.getElementById('budgetsList');
  if (budgetsList) {
    try {
      const integration = await import('../services/supabase-integration.js');
      const { userBudgets } = integration;
      
      budgetsList.innerHTML = '';
      
      if (!userBudgets || userBudgets.length === 0) {
        budgetsList.innerHTML = '<p>No budgets found</p>';
      } else {
        userBudgets.forEach(budget => {
          const budgetDiv = document.createElement('div');
          budgetDiv.style.cssText = 'padding: 12px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';
          
          const badge = budget.type === 'shared' ? '👥' : '👤';
          const isOwner = budget.owner_id === currentUser?.id;
          
          budgetDiv.innerHTML = `
            <div>
              <strong>${budget.name}</strong> ${badge}
              <span style="margin-left: 8px; font-size: 12px; color: var(--text-secondary);">${budget.type}</span>
              ${isOwner ? '<span style="margin-left: 8px; font-size: 11px; color: var(--accent);">(Owner)</span>' : ''}
            </div>
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" data-budget-id="${budget.id}">Settings</button>
          `;
          
          const settingsBtn = budgetDiv.querySelector('button[data-budget-id]');
          if (settingsBtn) {
            settingsBtn.addEventListener('click', async () => {
              await integration.switchBudget(budget.id);
              // Ensure this module's budget context matches the selected budget
              currentBudget = integration.currentBudget || budget;
              await openBudgetSettings();
              const manageModal = document.getElementById('manageBudgetsModal');
              if (manageModal) {
                manageModal.classList.remove('show');
              }
            });
          }
          
          budgetsList.appendChild(budgetDiv);
        });
      }
    } catch (error) {
      logger.error('Error loading budgets:', error);
      budgetsList.innerHTML = '<p>Error loading budgets</p>';
    }
  }
  
  modal.classList.add('show');
}

