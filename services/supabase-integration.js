/**
 * Supabase Integration Module
 * Handles authentication, budget switching, and data sync
 * This file bridges the old localStorage-based app with Supabase
 */

import { logger } from '../js/logger.js';
import { stateManager } from '../js/state-management.js';
import { showToast } from '../js/utils.js';

// Dynamic imports for services
let authService, budgetService, profileService, migrationService;

async function loadServices() {
  if (!authService) {
    // Try browser-compatible version first, fallback to module version
    try {
      const services = await import('./supabase-browser.js');
      authService = services.authService;
      budgetService = services.budgetService;
      profileService = services.profileService;
    } catch (e) {
      // Fallback to module version
      const services = await import('./supabase-service.js');
      authService = services.authService;
      budgetService = services.budgetService;
      profileService = services.profileService;
    }
    
    try {
      const migration = await import('./migration-utility.js');
      migrationService = migration.migrationService;
    } catch (e) {
      logger.warn('Migration utility not available');
    }
  }
}

// Global state
let currentUser = null;
let currentBudget = null;
let userBudgets = [];
let isAuthenticated = false;

// ============================================
// BUDGET ACCESS WATCHDOG
// ============================================
// Realtime membership events may not always reach the removed user (RLS can block delivery after removal).
// To ensure removed members get "booted" promptly, periodically validate budget access.
let budgetAccessWatchdogTimer = null;
let budgetAccessCheckInFlight = false;
let lastBudgetAccessCheckAt = 0;
const BUDGET_ACCESS_CHECK_INTERVAL_MS = 2000; // "near real-time" without being too noisy

async function validateBudgetAccess({ reason = 'interval' } = {}) {
  if (!currentUser || !budgetService) return;
  const now = Date.now();
  // Throttle in case multiple triggers fire
  if (budgetAccessCheckInFlight) return;
  if (now - lastBudgetAccessCheckAt < 1000) return;
  lastBudgetAccessCheckAt = now;
  budgetAccessCheckInFlight = true;

  try {
    const previousBudgetId = currentBudget?.id || localStorage.getItem('activeBudgetId');
    const previousBudgetName = currentBudget?.name || 'that budget';

    const { data: budgets, error } = await budgetService.getUserBudgets(currentUser.id);
    if (error || !Array.isArray(budgets)) return;

    userBudgets = budgets;
    updateBudgetSelector();

    if (previousBudgetId && !budgets.some(b => b.id === previousBudgetId)) {
      // Boot from removed budget
      try {
        const activeBudgetId = localStorage.getItem('activeBudgetId');
        if (activeBudgetId === previousBudgetId) {
          localStorage.removeItem('activeBudgetId');
        }
      } catch {
        // no-op
      }

      if (typeof showToast === 'function') {
        showToast(`You were removed from ${previousBudgetName}.`, 'Access removed');
      }

      // Switch away if we were currently on it
      const personalBudget = budgets.find(b => b.type === 'personal');
      const fallback = personalBudget || budgets[0];
      if (fallback && currentBudget?.id === previousBudgetId) {
        await switchBudget(fallback.id, { suppressToast: true, skipBudgetRefresh: true });
      }
    }
  } catch (e) {
    logger.warn('[budget-access] validateBudgetAccess error:', e);
  } finally {
    budgetAccessCheckInFlight = false;
  }
}

function startBudgetAccessWatchdog() {
  if (budgetAccessWatchdogTimer) return;
  // Run once quickly, then interval
  validateBudgetAccess({ reason: 'start' });
  budgetAccessWatchdogTimer = setInterval(() => {
    validateBudgetAccess({ reason: 'interval' });
  }, BUDGET_ACCESS_CHECK_INTERVAL_MS);
}

function stopBudgetAccessWatchdog() {
  if (budgetAccessWatchdogTimer) {
    clearInterval(budgetAccessWatchdogTimer);
    budgetAccessWatchdogTimer = null;
  }
}

// ============================================
// AUTHENTICATION
// ============================================

export async function initAuth() {
  await loadServices();
  
  // Check if this is a fresh page load (refresh) vs redirect from signup
  // If it's a refresh, clear any existing session to enforce "login on refresh" requirement
  const isRefresh = sessionStorage.getItem('supabase_auth_loaded') === 'true';
  if (isRefresh) {
    // This is a refresh - clear session to require login
    await authService.signOut();
    sessionStorage.removeItem('supabase_auth_loaded');
    if (window.location.pathname !== '/auth.html' && !window.location.pathname.includes('auth.html')) {
      window.location.href = '/auth.html';
    }
    return false;
  }
  
  // Mark that we've loaded (so next refresh will clear session)
  sessionStorage.setItem('supabase_auth_loaded', 'true');
  
  // Check for existing session
  const { session } = await authService.getSession();
  
  if (session) {
    currentUser = session.user;
    isAuthenticated = true;
    await loadUserData();
    
    // Setup inactivity timer (5 minutes = 300000ms)
    setupInactivityTimer();

    // Keep budget access in sync (boot quickly if removed from a budget)
    startBudgetAccessWatchdog();
    
    return true;
  } else {
    // Redirect to login if no session
    if (window.location.pathname !== '/auth.html' && !window.location.pathname.includes('auth.html')) {
      window.location.href = '/auth.html';
    }
    return false;
  }
}

// Inactivity timer - logs out after 5 minutes of no activity
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

function resetInactivityTimer() {
  // Opportunistically validate budget access on user activity (fast boot after removal).
  // Throttled in validateBudgetAccess().
  validateBudgetAccess({ reason: 'activity' });

  // Clear existing timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  // Set new timer
  inactivityTimer = setTimeout(async () => {
    logger.log('Inactivity timeout - logging out');
    if (typeof showToast === 'function') {
      showToast('Session expired due to inactivity. Please log in again.', 'Session Expired');
    }
    
    // Logout (will redirect to login page)
    await logout();
  }, INACTIVITY_TIMEOUT);
}

function setupInactivityTimer() {
  // Reset timer on any user activity
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  activityEvents.forEach(event => {
    document.addEventListener(event, resetInactivityTimer, { passive: true });
  });
  
  // Start the timer
  resetInactivityTimer();
}

export async function loadUserData() {
  if (!currentUser) return;

  try {
    const prevBudgetId = currentBudget?.id || localStorage.getItem('activeBudgetId');
    const prevBudgetName = currentBudget?.name || 'that budget';

    // Load user profile
    const { data: profile, error: profileError } = await profileService.getProfile(currentUser.id);
    if (profileError) {
      logger.error('Error loading profile:', profileError);
    } else if (profile) {
      // Update UI with profile info
      updateUserUI(profile);
    }

    // Load user budgets
    const { data: budgets, error: budgetError } = await budgetService.getUserBudgets(currentUser.id);
    
    if (budgetError) {
      logger.error('Error loading budgets:', budgetError);
      // Update selector to show error state
      userBudgets = [];
      updateBudgetSelector();
      if (typeof showToast === 'function') {
        showToast('Error loading budgets. Please refresh the page.', 'Error');
      }
      return;
    }

    if (budgets && budgets.length > 0) {
      userBudgets = budgets;
      updateBudgetSelector();
      
      // Respect previously selected budget if available
      const savedBudgetId = localStorage.getItem('activeBudgetId');
      const savedBudget = budgets.find(b => b.id === savedBudgetId);

      // If the previously active budget is no longer accessible, the user was removed (or budget deleted).
      // Show a clear message and clear the stored active budget so we don't keep trying to select it.
      const lostAccessToPrevBudget = !!prevBudgetId && !budgets.some(b => b.id === prevBudgetId);
      if (lostAccessToPrevBudget) {
        try {
          if (savedBudgetId === prevBudgetId) {
            localStorage.removeItem('activeBudgetId');
          }
        } catch {
          // no-op
        }
        // Avoid duplicate toast if the realtime membership handler already showed it
        let alreadyToasted = false;
        try {
          alreadyToasted = sessionStorage.getItem(`budgetRemovedToast:${prevBudgetId}`) === '1';
        } catch {
          // no-op
        }
        if (!alreadyToasted && typeof showToast === 'function') {
          showToast(`You were removed from ${prevBudgetName}.`, 'Access removed');
        }
      }
      
      if (savedBudget) {
        if (!currentBudget || currentBudget.id !== savedBudget.id) {
          await switchBudget(savedBudget.id);
        }
      } else {
        // Fallback: prefer personal, then first available
        const personalBudget = budgets.find(b => b.type === 'personal');
        if (personalBudget && (!currentBudget || currentBudget.id !== personalBudget.id)) {
          await switchBudget(personalBudget.id, { suppressToast: lostAccessToPrevBudget, skipBudgetRefresh: true });
        } else if (budgets.length > 0 && (!currentBudget || currentBudget.id !== budgets[0].id)) {
          await switchBudget(budgets[0].id, { suppressToast: lostAccessToPrevBudget, skipBudgetRefresh: true });
        }
      }
    } else {
      // No budgets found - maybe trigger didn't create one, create it now
      logger.warn('No budgets found for user. Creating personal budget...');
      userBudgets = [];
      updateBudgetSelector();
      
      // Try to create a personal budget
      const { data: newBudget, error: createError } = await budgetService.createBudget('Personal Budget', 'personal', currentUser.id);
      if (createError) {
        logger.error('Error creating personal budget:', createError);
        if (typeof showToast === 'function') {
          showToast('No budgets found. Please create one manually.', 'Info');
        }
      } else if (newBudget) {
        // Reload budgets after creating
        await loadUserData();
      }
    }

    // Check for localStorage migration
    if (migrationService && migrationService.hasLocalStorageData) {
      if (migrationService.hasLocalStorageData()) {
        showMigrationPrompt();
      }
    }
  } catch (error) {
    logger.error('Error in loadUserData:', error);
    userBudgets = [];
    updateBudgetSelector();
    if (typeof showToast === 'function') {
      showToast('Error loading user data. Please refresh the page.', 'Error');
    }
  }
}

export function updateUserUI(profile) {
  const profileInitial = document.getElementById('profileInitial');
  const profileName = document.getElementById('currentProfileName');
  const userEmail = document.getElementById('currentUserEmail');
  
  if (profileInitial) {
    profileInitial.textContent = (profile.display_name || profile.username || 'U').charAt(0).toUpperCase();
  }
  if (profileName) {
    profileName.textContent = profile.display_name || profile.username || 'User';
  }
  if (userEmail && currentUser) {
    userEmail.textContent = currentUser.email;
  }
}

export function updateBudgetSelector() {
  const budgetSelect = document.getElementById('budgetSelect');
  const budgetSelectorMenu = document.getElementById('budgetSelectorMenu');
  const budgetSelectorDivider = document.getElementById('budgetSelectorDivider');
  const createBudgetBtn = document.getElementById('createBudgetBtn');
  const joinBudgetBtn = document.getElementById('joinBudgetBtn');
  const manageBudgetsBtn = document.getElementById('manageBudgetsBtn');
  const budgetDivider = document.getElementById('budgetDivider');
  
  if (!budgetSelect) return;

  budgetSelect.innerHTML = '';
  
  // Show the budget selector in the dropdown
  if (budgetSelectorMenu) {
    budgetSelectorMenu.style.display = 'block';
  }
  if (budgetSelectorDivider) {
    budgetSelectorDivider.style.display = 'block';
  }
  
  // Show budget management buttons
  if (createBudgetBtn) {
    createBudgetBtn.style.display = 'inline-block';
  }
  if (joinBudgetBtn) {
    joinBudgetBtn.style.display = 'block';
  }
  if (manageBudgetsBtn) {
    manageBudgetsBtn.style.display = 'block';
  }
  if (budgetDivider) {
    budgetDivider.style.display = 'block';
  }
  
  if (userBudgets.length === 0) {
    budgetSelect.innerHTML = '<option value="">No budgets - Create one</option>';
    return;
  }

  userBudgets.forEach(budget => {
    const option = document.createElement('option');
    option.value = budget.id;
    const badge = budget.type === 'shared' ? ' 👥' : ' 👤';
    option.textContent = `${budget.name}${badge}`;
    if (currentBudget && budget.id === currentBudget.id) {
      option.selected = true;
    }
    budgetSelect.appendChild(option);
  });
}

export async function switchBudget(budgetId, options = {}) {
  logger.log('[switchBudget] start', { budgetId });

  // Refresh budgets before switching (prevents switching into budgets the user was removed from)
  // Skip when called from loadUserData() (it already refreshed budgets).
  if (!options.skipBudgetRefresh && currentUser) {
    try {
      const { data: budgets, error } = await budgetService.getUserBudgets(currentUser.id);
      if (!error && Array.isArray(budgets)) {
        userBudgets = budgets;
        updateBudgetSelector();
      }
    } catch (e) {
      logger.warn('[switchBudget] failed to refresh budgets before switching:', e);
    }
  }

  const budget = userBudgets.find(b => b.id === budgetId);
  if (!budget) {
    if (typeof showToast === 'function') {
      showToast('You no longer have access to that budget.', 'Access removed');
    }
    return;
  }

  // If already on this budget, skip redundant work
  if (currentBudget && currentBudget.id === budgetId) {
    updateBudgetSelector();
    // Ensure app state is pointed at the correct "budget profile" key
    try {
      stateManager.setActiveProfileId(budgetId);
    } catch {
      // no-op
    }
    // If data isn't loaded yet, force a reload once
    const activeData = (() => {
      try { return stateManager.getActiveData(); } catch { return null; }
    })();
    const hasAnyData = !!(activeData && (
      (activeData.transactions?.length) ||
      (activeData.categories?.length) ||
      (activeData.savingsGoals?.length) ||
      (activeData.debts?.length) ||
      (activeData.recurringTransactions?.length)
    ));
    if (!hasAnyData && typeof window.loadDataFromSupabase === 'function') {
      logger.log('[switchBudget] same budget but no local data; forcing reload');
      await window.loadDataFromSupabase();
    }
    if (typeof renderAll === 'function') {
      renderAll();
    }
    logger.log('[switchBudget] same budget handled');
    return;
  }

  // Set active budget immediately so renders and loaders use the new context
  try {
    stateManager.setActiveProfileId(budgetId);
  } catch {
    // no-op
  }

  currentBudget = budget;
  if (typeof window !== 'undefined') {
    window.currentBudget = currentBudget;
  }
  updateBudgetSelector();
  logger.log('[switchBudget] set currentBudget and selector', { currentBudget });
  
  // Store active budget in localStorage for persistence
  localStorage.setItem('activeBudgetId', budgetId);
  
  // Reload data from Supabase and setup realtime
  if (typeof window.loadDataFromSupabase === 'function') {
    logger.log('[switchBudget] loading data...');
    await window.loadDataFromSupabase();
    logger.log('[switchBudget] data loaded');
  }
  if (typeof window.setupRealtimeSubscriptions === 'function') {
    logger.log('[switchBudget] setup realtime subscriptions');
    window.setupRealtimeSubscriptions();
  }
  
  // Trigger app refresh
  if (typeof renderAll === 'function') {
    logger.log('[switchBudget] renderAll');
    renderAll();
  }
  
  // Show toast (optional)
  if (!options.suppressToast && typeof showToast === 'function') {
    showToast(`Switched to ${budget.name}`, 'Budget Changed');
  }
}

export async function createBudget(name, type = 'personal') {
  if (!currentUser) return null;

  const { data, error } = await budgetService.createBudget(name, type, currentUser.id);
  
  if (error) {
    if (typeof showToast === 'function') {
      showToast(`Error: ${error.message}`, 'Error');
    }
    return null;
  }

  // Reload budgets
  await loadUserData();
  
  // Switch to new budget
  if (data) {
    await switchBudget(data.id);
  }

  if (typeof showToast === 'function') {
    showToast(`${type === 'shared' ? 'Shared' : 'Personal'} budget created`, 'Success');
  }

  return data;
}

export async function logout(options = {}) {
  // Preserve a user-visible message for the auth page (do this before clearing storage).
  try {
    if (options?.message) {
      sessionStorage.setItem('authNotice', String(options.message));
    }
  } catch {
    // no-op
  }

  await loadServices();
  await authService.signOut();
  currentUser = null;
  currentBudget = null;
  userBudgets = [];
  isAuthenticated = false;
  
  // Clear inactivity timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  stopBudgetAccessWatchdog();
  
  // Clear any stored data
  localStorage.clear();
  sessionStorage.removeItem('supabase_auth_loaded');
  
  // Redirect to login
  window.location.href = '/auth.html';
}

// ============================================
// MIGRATION
// ============================================

function showMigrationPrompt() {
  if (localStorage.getItem('migrationPromptShown')) return;
  
  const shouldMigrate = confirm(
    'We found existing data in your browser. Would you like to import it into your account?\n\n' +
    'This will copy all your transactions, categories, goals, and other data to your personal budget.'
  );

  if (shouldMigrate) {
    startMigration();
  } else {
    localStorage.setItem('migrationPromptShown', 'true');
  }
}

async function startMigration() {
  await loadServices();
  
  if (!currentUser || !currentBudget) return;

  const progressCallback = (message) => {
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'Migration');
    } else if (typeof showToast === 'function') {
      showToast(message, 'Migration');
    }
  };

  try {
    const results = await migrationService.migrateToSupabase(
      currentUser.id,
      currentBudget.id,
      progressCallback
    );

    // Clear localStorage after successful migration
    migrationService.clearLocalStorage();
    localStorage.setItem('migrationPromptShown', 'true');

    // Show success message
    const summary = [
      `Categories: ${results.categories}`,
      `Transactions: ${results.transactions}`,
      `Savings Goals: ${results.savingsGoals}`,
      `Financial Goals: ${results.financialGoals}`,
      `Debts: ${results.debts}`,
      `Recurring: ${results.recurringTransactions}`
    ].join('\n');

    alert(`Migration complete!\n\n${summary}`);
    
    // Refresh app
    if (typeof renderAll === 'function') {
      renderAll();
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast(`Migration error: ${error.message}`, 'Error');
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  currentUser,
  currentBudget,
  userBudgets,
  isAuthenticated
  // All functions (initAuth, loadUserData, logout, switchBudget, createBudget) are already exported above as named exports
};

// Make functions available globally for event handlers
if (typeof window !== 'undefined') {
  window.supabaseAuth = {
    init: initAuth,
    logout,
    createBudget,
    switchBudget
  };
}

