/**
 * Transactions Module
 * Handles transaction CRUD operations, filtering, sorting, selection, and rendering
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { formatMoney, formatDate, showToast, isValidUUID, isMobileDevice, triggerHapticFeedback, currentMonthISO, debounce } from './utils.js';
import { LONG_PRESS_DURATION, LONG_PRESS_MOVE_THRESHOLD, MOBILE_BREAKPOINT, DEFAULT_SORT_COLUMN, DEFAULT_SORT_DIRECTION, SELECTION_MODES } from './constants.js';

// Module-level state
let viewedMonth = currentMonthISO(new Date());
let showAllMonths = false;
let selectedTransactionIds = new Set();
let isSelectionMode = false;
let selectionModeType = null; // 'edit' or 'delete'

// Table sorting state
let sortColumn = DEFAULT_SORT_COLUMN;
let sortDirection = DEFAULT_SORT_DIRECTION;

// Long-press detection state
let longPressTimer = null;
let longPressElement = null;
let longPressStartPos = null;
let isLongPressing = false;

// Editing state
let editTransactionId = null;

// External dependencies (will be injected)
let transactionService = null;
let currentBudget = null;
let currentUser = null;
let useSupabase = false;
let loadDataFromSupabase = null;
let renderAll = null;

/**
 * Permission helpers (shared budgets)
 * RLS enforces this server-side; these checks are for better UX (avoid 406/0-row surprises).
 */
function isSharedBudget() {
  return !!(useSupabase && currentBudget && currentBudget.type === 'shared');
}

function isBudgetOwner() {
  return !!(isSharedBudget() && currentUser?.id && currentBudget?.owner_id === currentUser.id);
}

function canEditTransactionRecord(t) {
  if (!useSupabase) return true;
  if (!isSharedBudget()) return true;
  if (isBudgetOwner()) return true;
  return !!(t?.userId && currentUser?.id && t.userId === currentUser.id);
}

function canDeleteTransactionRecord(t) {
  // Same rule set as edit in current schema/policies
  return canEditTransactionRecord(t);
}

function showNoPermissionToast(action = 'modify') {
  const msg = isSharedBudget()
    ? `You can only ${action} transactions you added (unless you're the budget owner).`
    : `You don't have permission to ${action} this transaction.`;
  showToast(msg, 'Not allowed');
}

/**
 * Initialize transactions module with dependencies
 * Sets up transaction service, budget context, and callback functions
 * @param {Object} deps - Dependencies object
 * @param {Object} [deps.transactionService] - Transaction service for Supabase operations
 * @param {Object} [deps.currentBudget] - Current budget context
 * @param {Object} [deps.currentUser] - Current authenticated user
 * @param {boolean} [deps.useSupabase] - Whether to use Supabase backend
 * @param {Function} [deps.loadDataFromSupabase] - Function to reload data from Supabase
 * @param {Function} [deps.renderAll] - Function to trigger full UI re-render
 * @param {Function} [deps.onUpdate] - Callback to update dependencies when they change
 * @returns {void}
 */
export function initTransactions(deps) {
  transactionService = deps.transactionService;
  currentBudget = deps.currentBudget;
  currentUser = deps.currentUser;
  useSupabase = deps.useSupabase;
  loadDataFromSupabase = deps.loadDataFromSupabase;
  renderAll = deps.renderAll;

  // Fallback: ensure critical static UI handlers are bound even if ui-handlers.js
  // fails to register (e.g., due to an early runtime error). Guard to avoid double-binding.
  try {
    const addBtn = document.getElementById('addTransactionBtn');
    if (addBtn && !addBtn.dataset.boundOpenDrawerForAdd) {
      addBtn.addEventListener('click', openDrawerForAdd);
      addBtn.dataset.boundOpenDrawerForAdd = '1';
    }
  } catch (e) {
    // Avoid breaking module init due to DOM issues
    logger.warn('Failed to bind addTransactionBtn fallback handler:', e);
  }
  
  // Register search and filter event listeners
  setupSearchAndFilterListeners();
  
  // Register sorting event listeners
  setupSortingListeners();
  
  // Update when dependencies change
  if (deps.onUpdate) {
    deps.onUpdate(() => {
      currentBudget = deps.currentBudget;
      currentUser = deps.currentUser;
      useSupabase = deps.useSupabase;
    });
  }
}

/**
 * Setup search and filter event listeners
 */
function setupSearchAndFilterListeners() {
  // Debounced render function to avoid excessive re-renders
  const debouncedRender = debounce(() => {
    if (renderAll) {
      renderAll();
    }
  }, 300);

  // Search box
  const searchBox = document.getElementById('searchBox');
  if (searchBox && !searchBox.dataset.bound) {
    searchBox.addEventListener('input', debouncedRender);
    searchBox.dataset.bound = '1';
  }

  // Type filter
  const filterType = document.getElementById('filterType');
  if (filterType && !filterType.dataset.bound) {
    filterType.addEventListener('change', debouncedRender);
    filterType.dataset.bound = '1';
  }

  // Category filter
  const filterCategory = document.getElementById('filterCategory');
  if (filterCategory && !filterCategory.dataset.bound) {
    filterCategory.addEventListener('change', debouncedRender);
    filterCategory.dataset.bound = '1';
  }
}

/**
 * Setup sorting event listeners
 */
function setupSortingListeners() {
  // Use delegated event listener to handle clicks on sortable headers
  document.addEventListener('click', (e) => {
    const th = e.target.closest('th.sortable[data-sort]');
    if (th && th.dataset.sort) {
      e.preventDefault();
      e.stopPropagation();
      sortTable(th.dataset.sort);
    }
  });
}

/**
 * Get filtered and sorted transactions based on current filters and sort settings
 * Applies month filter, search filter, type filter, category filter, and sorting
 * @returns {Array<Object>} Array of filtered and sorted transaction objects
 */
export function getFilteredTransactions() {
  const data = stateManager.getActiveData();
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  let tx = transactions.slice();

  // Filter by month
  if (!showAllMonths && viewedMonth) {
    tx = tx.filter(t => t.date.startsWith(viewedMonth));
  }

  // Filter by search
  const searchBox = document.getElementById("searchBox");
  const search = searchBox ? searchBox.value.toLowerCase().trim() : "";
  if (search) {
    tx = tx.filter(t => (t.description || "").toLowerCase().includes(search));
  }

  // Filter by type
  const typeSelect = document.getElementById("filterType");
  const typeFilter = typeSelect ? typeSelect.value : "";
  if (typeFilter) {
    tx = tx.filter(t => t.type === typeFilter);
  }

  // Filter by category
  const catSelect = document.getElementById("filterCategory");
  const catFilter = catSelect ? catSelect.value : "";
  if (catFilter) {
    tx = tx.filter(t => t.categoryId === catFilter);
  }

  // Apply sorting
  tx.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortColumn) {
      case 'date':
        aVal = a.date;
        bVal = b.date;
        break;
      case 'description':
        aVal = a.description.toLowerCase();
        bVal = b.description.toLowerCase();
        break;
      case 'type':
        aVal = a.type;
        bVal = b.type;
        break;
      case 'category':
        const categories = data.categories || [];
        const catA = categories.find(c => c.id === a.categoryId);
        const catB = categories.find(c => c.id === b.categoryId);
        aVal = catA ? catA.name.toLowerCase() : '';
        bVal = catB ? catB.name.toLowerCase() : '';
        break;
      case 'amount':
        aVal = a.amount;
        bVal = b.amount;
        break;
      default:
        aVal = a.date;
        bVal = b.date;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return tx;
}

/**
 * Sort transactions table by specified column
 * Toggles sort direction if clicking the same column, otherwise sorts ascending
 * @param {string} column - Column name to sort by ('date', 'description', 'type', 'category', 'amount')
 * @returns {void}
 */
export function sortTable(column) {
  // If clicking the same column, toggle direction
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  
  renderTransactionsTable();
  updateSortIndicators();
}

/**
 * Update sort indicators in table headers
 */
export function updateSortIndicators() {
  // Remove all sort indicators
  document.querySelectorAll('.sort-indicator').forEach(ind => {
    ind.textContent = '';
    ind.className = 'sort-indicator';
  });
  
  // Add indicator to active column
  const activeHeader = document.querySelector(`th[data-sort="${sortColumn}"]`);
  if (activeHeader) {
    const indicator = activeHeader.querySelector('.sort-indicator');
    if (indicator) {
      indicator.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
      indicator.className = 'sort-indicator active';
    }
  }
}

/**
 * Render transactions table (desktop) and cards (mobile)
 */
export function renderTransactionsTable() {
  const body = document.getElementById("transactionsTableBody");
  const cardsContainer = document.getElementById("transactionsCardsContainer");
  
  if (body) body.innerHTML = "";
  if (cardsContainer) cardsContainer.innerHTML = "";

  const tx = getFilteredTransactions();
  const data = stateManager.getActiveData();
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

  tx.forEach(t => {
    const cat = categories.find(c => c.id === t.categoryId);
    const isSelected = selectedTransactionIds.has(t.id);

    if (isMobile) {
      // Mobile: Card layout
      renderTransactionCard(t, cat, isSelected, cardsContainer);
    } else {
      // Desktop: Table layout
      renderTransactionRow(t, cat, isSelected, body);
    }
  });

  // Add checkbox listeners
  document.querySelectorAll(".transaction-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      e.stopPropagation();
      const id = e.target.dataset.id;
      if (e.target.checked) {
        selectedTransactionIds.add(id);
      } else {
        selectedTransactionIds.delete(id);
      }
      updateSelectionUI();
    });
    
    const label = cb.nextElementSibling;
    if (label && label.classList.contains('transaction-checkbox-label')) {
      label.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
  });
  
  // Update sort indicators (desktop only)
  if (!isMobile) {
    updateSortIndicators();
    
    // Update select all checkbox (only for delete mode)
    if (isSelectionMode && selectionModeType === SELECTION_MODES.DELETE) {
      updateSelectAllCheckbox();
    }
  }
}

/**
 * Render a transaction card (mobile)
 */
function renderTransactionCard(t, cat, isSelected, container) {
  if (!container) return;
  
  const card = document.createElement("div");
  card.className = "transaction-card-mobile";
  card.dataset.transactionId = t.id;
  
  if (isSelectionMode && selectionModeType === SELECTION_MODES.EDIT) {
    card.classList.add('editable-row');
  }

  // Build checkbox HTML if in delete mode
  const canDelete = canDeleteTransactionRecord(t);
  const checkboxHTML = (isSelectionMode && selectionModeType === SELECTION_MODES.DELETE) ? `
    <div class="transaction-checkbox-wrapper">
      <input type="checkbox" class="transaction-checkbox" data-id="${t.id}" ${isSelected ? 'checked' : ''} id="checkbox-${t.id}" ${canDelete ? '' : 'disabled'} title="${canDelete ? 'Select to delete' : 'Not allowed'}">
      <label for="checkbox-${t.id}" class="transaction-checkbox-label"></label>
    </div>
  ` : '';

  // User attribution for shared budgets
  const userAttribution = (useSupabase && currentBudget && currentBudget.type === 'shared' && t.user) 
    ? `<span class="transaction-user-attribution" title="Added by ${t.user.display_name || t.user.username || 'Unknown'}">👤 ${t.user.display_name || t.user.username || 'Unknown'}</span>`
    : '';
  
  let cardHTML = `
    <div class="transaction-card-header">
      ${checkboxHTML}
      <div class="transaction-card-content">
        <div class="transaction-card-top-row">
          <div class="transaction-card-date">${formatDate(t.date)}</div>
          <div class="transaction-card-amount">${formatMoney(t.amount)}</div>
        </div>
        <div class="transaction-card-description">${t.description}</div>
      </div>
    </div>
    <div class="transaction-card-details">
      <span class="transaction-card-badge badge-${t.type}">${t.type}</span>
      <span class="transaction-card-category">${cat ? cat.name : "—"}</span>
      ${t.merchant ? `<span class="transaction-card-merchant">📍 ${t.merchant}</span>` : ''}
      ${userAttribution}
    </div>
  `;

  card.innerHTML = cardHTML;

  // Prevent context menu
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Add click handler for edit mode
  if (isSelectionMode && selectionModeType === SELECTION_MODES.EDIT) {
    card.addEventListener('click', () => {
      if (!canEditTransactionRecord(t)) {
        showNoPermissionToast('edit');
        return;
      }
      openDrawerForEdit(t.id);
      exitSelectionMode();
    });
  }

  // Add long-press detection for mobile
  if (isMobileDevice() && !isSelectionMode) {
    addLongPressHandlers(card, t.id);
  }

  container.appendChild(card);
}

/**
 * Render a transaction row (desktop)
 */
function renderTransactionRow(t, cat, isSelected, body) {
  if (!body) return;
  
  const tr = document.createElement("tr");
  tr.dataset.transactionId = t.id;

  // Build row HTML
  let rowHTML = '';
  if (isSelectionMode && selectionModeType === SELECTION_MODES.DELETE) {
    const canDelete = canDeleteTransactionRecord(t);
    rowHTML += `<td class="checkbox-cell"><div class="transaction-checkbox-wrapper"><input type="checkbox" class="transaction-checkbox" data-id="${t.id}" ${isSelected ? 'checked' : ''} id="checkbox-${t.id}" ${canDelete ? '' : 'disabled'} title="${canDelete ? 'Select to delete' : 'Not allowed'}"><label for="checkbox-${t.id}" class="transaction-checkbox-label"></label></div></td>`;
  }
  
  // User attribution for shared budgets
  const userAttribution = (useSupabase && currentBudget && currentBudget.type === 'shared' && t.user) 
    ? `<span class="transaction-user-attribution" title="Added by ${t.user.display_name || t.user.username || 'Unknown'}">👤 ${t.user.display_name || t.user.username || 'Unknown'}</span>`
    : '';
  
  rowHTML += `
    <td>${formatDate(t.date)}</td>
    <td>${t.description}${t.merchant ? `<span class="merchant-badge">${t.merchant}</span>` : ''}${userAttribution}</td>
    <td><span class="badge-${t.type}">${t.type}</span></td>
    <td>${cat ? cat.name : "—"}</td>
    <td>${formatMoney(t.amount)}</td>
  `;

  tr.innerHTML = rowHTML;
  
  // Prevent context menu
  tr.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  
  // Add click handler for edit mode
  if (isSelectionMode && selectionModeType === SELECTION_MODES.EDIT) {
    tr.classList.add('editable-row');
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'SPAN' && (e.target.classList.contains('badge-income') || 
          e.target.classList.contains('badge-expense') ||
          e.target.classList.contains('merchant-badge'))) {
        return;
      }
      if (!canEditTransactionRecord(t)) {
        showNoPermissionToast('edit');
        return;
      }
      openDrawerForEdit(t.id);
      exitSelectionMode();
    });
  }
  
  // Add long-press detection for mobile table rows
  if (isMobileDevice() && !isSelectionMode) {
    addLongPressHandlers(tr, t.id);
  }
  
  body.appendChild(tr);
}

/**
 * Add long-press handlers to element
 */
function addLongPressHandlers(element, transactionId) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let hasMoved = false;
  
  element.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    hasMoved = false;
    startLongPress(element, transactionId, touchStartX, touchStartY);
  }, { passive: true });
  
  element.addEventListener('touchmove', (e) => {
    if (!hasMoved && checkLongPressMove(e.touches[0].clientX, e.touches[0].clientY)) {
      hasMoved = true;
      return;
    }
    if (!hasMoved) {
      checkLongPressMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  
  element.addEventListener('touchend', (e) => {
    const touchDuration = Date.now() - touchStartTime;
    if (hasMoved) {
      cancelLongPress();
      return;
    }
    if (touchDuration < LONG_PRESS_DURATION) {
      cancelLongPress();
    } else {
      cancelLongPress();
    }
  }, { passive: true });
  
  element.addEventListener('touchcancel', () => {
    cancelLongPress();
    hasMoved = false;
  }, { passive: true });
}

/**
 * Start long-press detection
 */
function startLongPress(element, transactionId, startX, startY) {
  // Don't start if already in selection mode
  if (isSelectionMode) {
    return;
  }
  
  cancelLongPress();
  
  longPressElement = element;
  longPressStartPos = { x: startX, y: startY };
  isLongPressing = false;
  
  element.classList.add('long-press-active');
  
  longPressTimer = setTimeout(() => {
    if (longPressElement === element && !isLongPressing) {
      isLongPressing = true;
      activateDeleteModeFromLongPress(transactionId);
      element.classList.remove('long-press-active');
      element.classList.add('long-press-complete');
      setTimeout(() => {
        element.classList.remove('long-press-complete');
      }, 200);
    }
  }, LONG_PRESS_DURATION);
}

/**
 * Cancel long-press
 */
function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  
  if (longPressElement) {
    longPressElement.classList.remove('long-press-active', 'long-press-complete');
    longPressElement = null;
  }
  
  longPressStartPos = null;
  isLongPressing = false;
}

/**
 * Check if long-press should be cancelled due to movement
 */
function checkLongPressMove(currentX, currentY) {
  if (!longPressStartPos) return false;
  
  const deltaX = Math.abs(currentX - longPressStartPos.x);
  const deltaY = Math.abs(currentY - longPressStartPos.y);
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  if (distance > LONG_PRESS_MOVE_THRESHOLD) {
    cancelLongPress();
    return true;
  }
  
  return false;
}

/**
 * Activate delete mode from long-press
 */
function activateDeleteModeFromLongPress(transactionId) {
  triggerHapticFeedback();
  
  isSelectionMode = true;
  selectionModeType = SELECTION_MODES.DELETE;
  
  // Show/hide UI elements
  const editBtn = document.getElementById("editModeBtn");
  const deleteBtn = document.getElementById("deleteModeBtn");
  const cancelBtn = document.getElementById("cancelSelectionBtn");
  const checkboxHeader = document.getElementById("checkboxHeader");
  const actionsBar = document.getElementById("selectionActionsBar");
  const editIndicator = document.getElementById("editModeIndicator");
  
  if (editBtn) editBtn.style.display = "none";
  if (deleteBtn) deleteBtn.style.display = "none";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  if (checkboxHeader) checkboxHeader.style.display = "table-cell";
  if (actionsBar) actionsBar.style.display = "none";
  if (editIndicator) editIndicator.style.display = "none";
  
  // Remove edit mode class
  const tableBox = document.querySelector("#tab-transactions .table-box");
  if (tableBox) {
    tableBox.classList.remove('edit-mode');
  }
  
  // Automatically select the long-pressed transaction only if deletable
  selectedTransactionIds.clear();
  try {
    const data = stateManager.getActiveData();
    const t = (data.transactions || []).find(x => x.id === transactionId);
    if (canDeleteTransactionRecord(t)) {
      selectedTransactionIds.add(transactionId);
    } else {
      showNoPermissionToast('delete');
    }
  } catch {
    // no-op
  }
  
  renderTransactionsTable();
  updateSelectionUI();
  
  showToast("Delete mode activated. Tap to select more transactions.", "Long-press");
}

/**
 * Enter selection mode
 * @param {string} mode - 'edit' or 'delete'
 */
export function enterSelectionMode(mode) {
  // In shared budgets, members can only edit/delete their own transactions (owners can manage all).
  // Give a friendly heads-up when entering a mode, and avoid entering a mode that has 0 eligible rows
  // in the current filtered view (prevents confusing UX).
  if (useSupabase && isSharedBudget() && !isBudgetOwner()) {
    try {
      const eligible = getFilteredTransactions().filter(t =>
        mode === SELECTION_MODES.DELETE ? canDeleteTransactionRecord(t) : canEditTransactionRecord(t)
      );

      if (eligible.length === 0) {
        showToast(
          mode === SELECTION_MODES.DELETE
            ? "No deletable transactions in this view. You can only delete transactions you added."
            : "No editable transactions in this view. You can only edit transactions you added.",
          "Not allowed"
        );
        return;
      }

      // Heads-up toast (once per mode entry)
      showToast(
        mode === SELECTION_MODES.DELETE
          ? "You can only delete transactions you added."
          : "You can only edit transactions you added.",
        "Heads up"
      );
    } catch {
      // no-op
    }
  }

  isSelectionMode = true;
  selectionModeType = mode;
  selectedTransactionIds.clear();
  
  // Show/hide UI elements
  const editBtn = document.getElementById("editModeBtn");
  const deleteBtn = document.getElementById("deleteModeBtn");
  const cancelBtn = document.getElementById("cancelSelectionBtn");
  const checkboxHeader = document.getElementById("checkboxHeader");
  const actionsBar = document.getElementById("selectionActionsBar");
  const editIndicator = document.getElementById("editModeIndicator");
  
  if (editBtn) editBtn.style.display = "none";
  if (deleteBtn) deleteBtn.style.display = "none";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  
  if (mode === SELECTION_MODES.DELETE) {
    if (checkboxHeader) checkboxHeader.style.display = "table-cell";
    if (actionsBar) actionsBar.style.display = "none";
    if (editIndicator) editIndicator.style.display = "none";
  } else {
    // Edit mode
    if (checkboxHeader) checkboxHeader.style.display = "none";
    if (actionsBar) actionsBar.style.display = "none";
    if (editIndicator) editIndicator.style.display = "flex";
  }
  
  // Add edit mode class to table
  const tableBox = document.querySelector("#tab-transactions .table-box");
  if (tableBox) {
    if (mode === SELECTION_MODES.EDIT) {
      tableBox.classList.add('edit-mode');
    } else {
      tableBox.classList.remove('edit-mode');
    }
  }
  
  renderTransactionsTable();
  updateSelectionUI();
}

/**
 * Exit selection mode and clear all selections
 * Removes checkboxes, clears selected transaction IDs, and restores normal UI
 * @returns {void}
 */
export function exitSelectionMode() {
  isSelectionMode = false;
  selectionModeType = null;
  selectedTransactionIds.clear();
  
  // Show/hide UI elements
  const editBtn = document.getElementById("editModeBtn");
  const deleteBtn = document.getElementById("deleteModeBtn");
  const cancelBtn = document.getElementById("cancelSelectionBtn");
  const checkboxHeader = document.getElementById("checkboxHeader");
  const actionsBar = document.getElementById("selectionActionsBar");
  const editIndicator = document.getElementById("editModeIndicator");
  
  if (editBtn) editBtn.style.display = "inline-block";
  if (deleteBtn) deleteBtn.style.display = "inline-block";
  if (cancelBtn) cancelBtn.style.display = "none";
  if (checkboxHeader) checkboxHeader.style.display = "none";
  if (actionsBar) actionsBar.style.display = "none";
  if (editIndicator) editIndicator.style.display = "none";
  
  // Remove edit mode class
  const tableBox = document.querySelector("#tab-transactions .table-box");
  if (tableBox) {
    tableBox.classList.remove('edit-mode');
  }
  
  renderTransactionsTable();
}

/**
 * Enter selection mode with a specific transaction selected
 */
export function enterSelectionModeWithTransaction(mode, transactionId) {
  enterSelectionMode(mode);
  if (transactionId) {
    selectedTransactionIds.add(transactionId);
    renderTransactionsTable();
    updateSelectionUI();
  }
}

/**
 * Update selection UI elements (buttons, counters, checkboxes)
 * Shows/hides selection controls and updates selected count display
 * @returns {void}
 */
export function updateSelectionUI() {
  if (!isSelectionMode) {
    const actionsBar = document.getElementById("selectionActionsBar");
    const editIndicator = document.getElementById("editModeIndicator");
    if (actionsBar) actionsBar.style.display = "none";
    if (editIndicator) editIndicator.style.display = "none";
    return;
  }
  
  if (selectionModeType === SELECTION_MODES.DELETE) {
    // Count only deletable selections (in case of stale selections)
    const data = stateManager.getActiveData();
    const txMap = new Map((data.transactions || []).map(t => [t.id, t]));
    const count = Array.from(selectedTransactionIds).filter(id => canDeleteTransactionRecord(txMap.get(id))).length;
    const actionsBar = document.getElementById("selectionActionsBar");
    const selectedCount = document.getElementById("selectedCount");
    
    if (count > 0) {
      if (actionsBar) actionsBar.style.display = "flex";
      if (selectedCount) {
        selectedCount.textContent = `${count} transaction${count === 1 ? '' : 's'} selected`;
      }
    } else {
      if (actionsBar) actionsBar.style.display = "none";
    }
    
    updateSelectAllCheckbox();
  } else {
    // Edit mode
    const editIndicator = document.getElementById("editModeIndicator");
    const actionsBar = document.getElementById("selectionActionsBar");
    if (editIndicator) editIndicator.style.display = "flex";
    if (actionsBar) actionsBar.style.display = "none";
  }
}

/**
 * Update select all checkbox state based on current selections
 * Checks/unchecks the "select all" checkbox if all/none are selected
 * @returns {void}
 */
export function updateSelectAllCheckbox() {
  if (!isSelectionMode) return;
  
  const selectAll = document.getElementById("selectAllCheckbox");
  if (!selectAll) return;
  
  // In shared budgets, only allow selecting deletable transactions
  const tx = getFilteredTransactions().filter(t => canDeleteTransactionRecord(t));
  const allSelected = tx.length > 0 && tx.every(t => selectedTransactionIds.has(t.id));
  const someSelected = tx.some(t => selectedTransactionIds.has(t.id));
  
  selectAll.checked = allSelected;
  selectAll.indeterminate = someSelected && !allSelected;
  selectAll.disabled = tx.length === 0;
}

/**
 * Handle select all checkbox
 */
export function handleSelectAll() {
  if (!isSelectionMode) return;
  
  const selectAll = document.getElementById("selectAllCheckbox");
  if (!selectAll) return;
  
  const tx = getFilteredTransactions().filter(t => canDeleteTransactionRecord(t));
  
  if (selectAll.checked) {
    tx.forEach(t => selectedTransactionIds.add(t.id));
  } else {
    tx.forEach(t => selectedTransactionIds.delete(t.id));
  }
  
  renderTransactionsTable();
  updateSelectionUI();
}

/**
 * Handle edit selected (for compatibility)
 */
export function handleEditSelected() {
  if (!isSelectionMode || selectionModeType !== SELECTION_MODES.EDIT) return;
  exitSelectionMode();
}

/**
 * Handle delete selected transactions
 */
export async function handleDeleteSelected() {
  if (!isSelectionMode || selectionModeType !== SELECTION_MODES.DELETE) return;
  
  const ids = Array.from(selectedTransactionIds);
  if (ids.length === 0) {
    showToast("No transactions selected. Please select transaction(s) to delete.", "Error");
    return;
  }

  // Filter to deletable IDs (shared budgets: own tx or owner)
  const data = stateManager.getActiveData();
  const txMap = new Map((data.transactions || []).map(t => [t.id, t]));
  const deletableIds = ids.filter(id => canDeleteTransactionRecord(txMap.get(id)));
  const blockedCount = ids.length - deletableIds.length;
  if (deletableIds.length === 0) {
    showNoPermissionToast('delete');
    return;
  }
  
  const count = deletableIds.length;
  const message = blockedCount > 0
    ? `You can delete ${count} transaction${count === 1 ? '' : 's'} (skipping ${blockedCount} you don't have permission to delete). Continue?`
    : `Are you sure you want to delete ${count} transaction${count === 1 ? '' : 's'}? This action cannot be undone.`;
  
  if (!confirm(message)) {
    return;
  }
  
  // Delete all selected transactions
  for (const id of deletableIds) {
    await deleteTransaction(id);
  }
  
  exitSelectionMode();
  showToast(
    blockedCount > 0
      ? `Deleted ${count} transaction${count === 1 ? '' : 's'} (${blockedCount} skipped)`
      : `Deleted ${count} transaction${count === 1 ? '' : 's'}`
  );
}

/**
 * Open drawer for adding transaction
 */
export function openDrawerForAdd() {
  editTransactionId = null;
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerDate = document.getElementById("drawerDate");
  const drawerDesc = document.getElementById("drawerDesc");
  const drawerAmount = document.getElementById("drawerAmount");
  const drawerType = document.getElementById("drawerType");
  const drawerCategory = document.getElementById("drawerCategory");
  const drawerMerchant = document.getElementById("drawerMerchant");
  const drawerNote = document.getElementById("drawerNote");
  const drawer = document.getElementById("drawer");
  
  if (drawerTitle) drawerTitle.textContent = "Add Transaction";
  if (drawerDate) drawerDate.value = new Date().toISOString().slice(0, 10);
  if (drawerDesc) drawerDesc.value = "";
  if (drawerAmount) drawerAmount.value = "";
  if (drawerType) drawerType.value = "expense";
  
  const data = stateManager.getActiveData();
  const cats = Array.isArray(data.categories) ? data.categories : [];
  if (drawerCategory) {
    drawerCategory.value = cats.length ? cats[0].id : "";
  }
  
  if (drawerMerchant) drawerMerchant.value = "";
  if (drawerNote) drawerNote.value = "";
  if (drawer) drawer.classList.add("open");
}

/**
 * Open drawer for editing transaction
 * @param {string} id - Transaction ID
 */
export function openDrawerForEdit(id) {
  editTransactionId = id;
  const data = stateManager.getActiveData();
  const t = data.transactions.find(x => x.id === id);

  if (!t) return;
  if (!canEditTransactionRecord(t)) {
    showNoPermissionToast('edit');
    editTransactionId = null;
    return;
  }

  const drawerTitle = document.getElementById("drawerTitle");
  const drawerDate = document.getElementById("drawerDate");
  const drawerDesc = document.getElementById("drawerDesc");
  const drawerAmount = document.getElementById("drawerAmount");
  const drawerType = document.getElementById("drawerType");
  const drawerCategory = document.getElementById("drawerCategory");
  const drawerMerchant = document.getElementById("drawerMerchant");
  const drawerNote = document.getElementById("drawerNote");
  const drawer = document.getElementById("drawer");
  
  if (drawerTitle) drawerTitle.textContent = "Edit Transaction";
  if (drawerDate) drawerDate.value = t.date;
  if (drawerDesc) drawerDesc.value = t.description;
  if (drawerAmount) drawerAmount.value = t.amount;
  if (drawerType) drawerType.value = t.type;
  if (drawerCategory) drawerCategory.value = t.categoryId;
  if (drawerMerchant) drawerMerchant.value = t.merchant || "";
  if (drawerNote) drawerNote.value = t.note || "";
  if (drawer) drawer.classList.add("open");
}

/**
 * Close transaction drawer and reset form state
 * Clears edit transaction ID and hides the drawer
 * @returns {void}
 */
export function closeDrawer() {
  const drawer = document.getElementById("drawer");
  if (drawer) {
    drawer.classList.remove("open");
  }
  editTransactionId = null;
}

/**
 * Save transaction from drawer
 */
export async function saveTransactionFromDrawer() {
  // Keep budget context synced on budget switches (integration updates window.currentBudget)
  if (typeof window !== 'undefined' && window.currentBudget) {
    currentBudget = window.currentBudget;
  }

  const drawerDate = document.getElementById("drawerDate");
  const drawerDesc = document.getElementById("drawerDesc");
  const drawerAmount = document.getElementById("drawerAmount");
  const drawerType = document.getElementById("drawerType");
  const drawerCategory = document.getElementById("drawerCategory");
  const drawerMerchant = document.getElementById("drawerMerchant");
  const drawerNote = document.getElementById("drawerNote");
  
  if (!drawerDate || !drawerDesc || !drawerAmount) {
    showToast("Missing fields", "Error");
    return;
  }
  
  const date = drawerDate.value;
  const desc = drawerDesc.value.trim();
  const amt = parseFloat(drawerAmount.value);
  const type = drawerType.value;
  const cat = drawerCategory.value;
  const merchant = drawerMerchant.value.trim();
  const note = drawerNote.value.trim();

  if (!date || !desc || !amt) {
    showToast("Missing fields", "Error");
    return;
  }

  const data = stateManager.getActiveData();
  const wasEditing = !!editTransactionId;
  if (editTransactionId) {
    const existing = (data.transactions || []).find(x => x.id === editTransactionId);
    if (existing && !canEditTransactionRecord(existing)) {
      showNoPermissionToast('edit');
      return;
    }
  }

  if (useSupabase && currentBudget && currentUser && transactionService) {
    // Use Supabase
    try {
      // Validate category_id
      let categoryId = cat || null;
      if (categoryId && !isValidUUID(categoryId)) {
        const categories = stateManager.getActiveData().categories;
        const foundCategory = categories.find(c => c.id === categoryId || c.name.toLowerCase() === categoryId.toLowerCase());
        if (foundCategory && isValidUUID(foundCategory.id)) {
          categoryId = foundCategory.id;
        } else {
          logger.warn('Invalid category ID:', categoryId, '- setting to null');
          categoryId = null;
        }
      }
      
      const transactionData = {
        date,
        description: desc,
        amount: amt,
        type,
        category_id: categoryId,
        merchant: merchant || null,
        notes: note || null
      };
      
      if (editTransactionId) {
        // Update existing
        const { data: updatedTx, error } = await transactionService.updateTransaction(editTransactionId, transactionData);
        if (error) {
          showToast(`Error: ${error.message}`, "Error");
          return;
        }
        if (!updatedTx) {
          // Most commonly: RLS prevented the update (0 rows visible/affected)
          showNoPermissionToast('edit');
          return;
        }
        showToast("Transaction updated");
      } else {
        // Create new
        logger.info('Creating transaction:', { budgetId: currentBudget.id, userId: currentUser.id });
        const { data: newTx, error } = await transactionService.createTransaction(
          currentBudget.id,
          currentUser.id,
          transactionData
        );
        if (error) {
          logger.error('Transaction creation error:', error);
          showToast(`Error: ${error.message}`, "Error");
          return;
        }
        logger.info('Transaction created successfully:', newTx);
        showToast("Transaction added");
      }
      
      // Reload data from Supabase
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error saving transaction:', error);
      showToast(`Error saving transaction: ${error.message}`, "Error");
      return;
    }
  } else {
    // Use localStorage (fallback)
    if (editTransactionId) {
      // Edit existing
      const t = data.transactions.find(x => x.id === editTransactionId);
      if (t) {
        t.date = date;
        t.description = desc;
        t.amount = amt;
        t.type = type;
        t.categoryId = cat;
        t.merchant = merchant;
        t.note = note;
        stateManager.setActiveData(data);
        showToast("Transaction updated");
      }
    } else {
      // Create new
      const newId = "tx_" + Math.random().toString(36).slice(2);
      data.transactions.push({
        id: newId,
        date,
        description: desc,
        amount: amt,
        type,
        categoryId: cat,
        merchant: merchant || undefined,
        note
      });
      stateManager.setActiveData(data);
      showToast("Transaction added");
    }
  }

  closeDrawer();
  
  // Exit selection mode if we were editing from selection mode
  if (wasEditing && isSelectionMode) {
    exitSelectionMode();
  }
  
  if (renderAll) {
    renderAll();
  }
}

/**
 * Delete a transaction
 * @param {string} id - Transaction ID
 */
export async function deleteTransaction(id) {
  if (useSupabase && currentBudget && transactionService) {
    // UX guard: in shared budgets, only creator or owner can delete
    try {
      const data = stateManager.getActiveData();
      const t = (data.transactions || []).find(x => x.id === id);
      if (t && !canDeleteTransactionRecord(t)) {
        showNoPermissionToast('delete');
        return;
      }
    } catch {
      // no-op
    }

    // Use Supabase
    try {
      const { error } = await transactionService.deleteTransaction(id);
      if (error) {
        showToast(`Error: ${error.message}`, "Error");
        return;
      }
      showToast("Transaction deleted");
      // Reload data from Supabase
      if (loadDataFromSupabase) {
        await loadDataFromSupabase();
      }
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      showToast(`Error deleting transaction: ${error.message}`, "Error");
      return;
    }
  } else {
    // Use localStorage (fallback)
    const data = stateManager.getActiveData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    stateManager.setActiveData(data);
    showToast("Transaction deleted");
  }
  
  if (renderAll) {
    renderAll();
  }
}

/**
 * Get viewed month
 * @returns {string} Month in YYYY-MM format
 */
export function getViewedMonth() {
  return viewedMonth;
}

/**
 * Set viewed month
 * @param {string} month - Month in YYYY-MM format
 */
export function setViewedMonth(month) {
  viewedMonth = month;
  if (isSelectionMode) {
    exitSelectionMode();
  }
}

/**
 * Get show all months flag
 * @returns {boolean} True if showing all months
 */
export function getShowAllMonths() {
  return showAllMonths;
}

/**
 * Set show all months flag
 * @param {boolean} show - Whether to show all months
 */
export function setShowAllMonths(show) {
  showAllMonths = show;

  // Keep header button in sync even when showAllMonths is changed indirectly
  const toggleBtn = document.getElementById('toggleAllMonthsBtn');
  if (toggleBtn) {
    toggleBtn.textContent = showAllMonths ? 'Current Month' : 'All Months';
    toggleBtn.setAttribute('aria-pressed', showAllMonths ? 'true' : 'false');
  }
}

/**
 * Get selection mode state
 * @returns {Object} Selection mode state
 */
export function getSelectionMode() {
  return {
    isActive: isSelectionMode,
    type: selectionModeType,
    selectedIds: Array.from(selectedTransactionIds)
  };
}

/**
 * Handle month/year selector change
 * Updates the viewed month when user changes month or year dropdowns
 * @returns {void}
 */
export function handleMonthYearChange() {
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");
  
  if (monthSelect && yearSelect) {
    const month = monthSelect.value;
    const year = yearSelect.value;
    const newMonth = `${year}-${month.padStart(2, '0')}`;
    setViewedMonth(newMonth);
    setShowAllMonths(false);
    
    // Exit selection mode when changing month
    if (isSelectionMode) {
      exitSelectionMode();
    }
    
    if (renderAll) {
      renderAll();
    }
  }
}

/**
 * Toggle between showing all months and a specific month
 * Switches between filtered view (single month) and all months view
 * @returns {void}
 */
export function toggleAllMonths() {
  const newShowAll = !showAllMonths;
  setShowAllMonths(newShowAll);
  
  // Exit selection mode when toggling
  if (isSelectionMode) {
    exitSelectionMode();
  }
  
  if (renderAll) {
    renderAll();
  }
}

