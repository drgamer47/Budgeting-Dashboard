/**
 * Main Application Entry Point
 * Initializes all modules and sets up the application
 */

import { stateManager } from './state-management.js';
import { logger } from './logger.js';
import { showToast } from './utils.js';
import { RESIZE_DEBOUNCE, BUDGET_WARNINGS_DELAY } from './constants.js';

// Import feature modules
import { initTransactions } from './transactions.js';
import { initCategories } from './categories.js';
import { initGoals } from './goals.js';
import { initDebts } from './debts.js';
import { initRecurring } from './recurring.js';

// Import UI modules
import { initRenderers, renderAll, updateMonthYearSelectors, renderProfileSelector } from './ui-renderers.js';
import { initHandlers, initTheme, initTabs, checkBudgetWarnings, getSettings } from './ui-handlers.js';
import { initNotifications } from './notifications.js';

// Import Supabase integration
import * as supabaseIntegration from '../services/supabase-integration.js';

// External dependencies
let useSupabase = false;
let currentUser = null;
let currentBudget = null;
let userBudgets = [];
let transactionService = null;
let categoryService = null;
let goalService = null;
let debtService = null;
let recurringService = null;
let realtimeService = null;
let loadDataFromSupabase = null;
let setupRealtimeSubscriptions = null;

/**
 * Initialize the application
 * Sets up all modules, initializes Supabase integration, and renders the UI
 * @returns {Promise<void>}
 * @throws {Error} If initialization fails critically
 */
export async function initApp() {
  try {
    logger.log('Initializing application...');
    
    // State manager is already initialized (constructor handles it)
    // Try to initialize Supabase first
    const supabaseActive = await initSupabaseIntegration();
    
    if (!supabaseActive) {
      // Fallback to localStorage mode
      logger.log('Using localStorage mode');
      stateManager.setUseSupabase(false);
      stateManager.loadState();
    } else {
      // Supabase is active - data will be loaded by initSupabaseIntegration
      logger.log('Using Supabase mode - data loaded from cloud');
    }
    
    // Initialize UI
    const settings = getSettings();
    initTheme();
    initNotifications();
    initTabs();
    
    // Initialize month/year selectors
    updateMonthYearSelectors();
    
    // Initialize renderers
    initRenderers();
    
    // Initialize feature modules with dependencies
    await initializeFeatureModules();
    
    // Initialize handlers
    initHandlers({
      useSupabase,
      currentUser,
      currentBudget,
      loadDataFromSupabase,
      transactionService,
      goalService,
      debtService,
      recurringService,
      categoryService,
      onUpdate: (updateFn) => {
        // Update dependencies when they change
        if (typeof updateFn === 'function') {
          updateFn();
        }
      }
    });

    // Load initial data from Supabase before first render
    if (useSupabase && currentBudget && loadDataFromSupabase) {
      await loadDataFromSupabase();
    }
    
    // Setup budget management handlers (if Supabase is active)
    if (useSupabase) {
      await setupBudgetManagement();
      
      // Setup real-time subscriptions if we have a budget
      if (currentBudget && setupRealtimeSubscriptions) {
        await setupRealtimeSubscriptions();
      }
    }
    
    // Render the UI after data is loaded
    renderAll();
    
    // Handle window resize for transaction layout (table vs cards)
    let transactionLayoutTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(transactionLayoutTimeout);
      transactionLayoutTimeout = setTimeout(async () => {
        // Re-render transactions table on resize
        const { renderTransactionsTable } = await import('./transactions.js');
        renderTransactionsTable();
      }, RESIZE_DEBOUNCE);
    });
    
    // Check budget warnings after a short delay
    setTimeout(checkBudgetWarnings, BUDGET_WARNINGS_DELAY);
    
    logger.log('Application initialized successfully');
  } catch (error) {
    logger.error('Error initializing application:', error);
    showToast('Error initializing application. Please refresh the page.', 'Error');
  }
}

/**
 * Initialize Supabase integration
 * Loads Supabase services and sets up authentication
 * @returns {Promise<boolean>} True if Supabase is active, false otherwise
 */
async function initSupabaseIntegration() {
  try {
    const result = await supabaseIntegration.initAuth();
    if (!result) {
      return false;
    }
    
    // Get Supabase state from the integration module
    // These are exported as module-level variables that get updated during initAuth/loadUserData
    currentUser = supabaseIntegration.currentUser || null;
    currentBudget = supabaseIntegration.currentBudget || null;
    userBudgets = supabaseIntegration.userBudgets || [];
    useSupabase = true; // If initAuth succeeded, Supabase is active
    
    // Set stateManager to use Supabase mode
    stateManager.setUseSupabase(true);
    
    // Load services
    const services = await import('../services/supabase-browser.js');
    transactionService = services.transactionService || null;
    categoryService = services.categoryService || null;
    goalService = services.goalService || null;
    debtService = services.debtService || null;
    recurringService = services.recurringService || null;
    realtimeService = services.realtimeService || null;
    
    // Create loadDataFromSupabase wrapper that uses stateManager
    loadDataFromSupabase = createLoadDataFromSupabase();
    setupRealtimeSubscriptions = createSetupRealtimeSubscriptions();

    // Expose to window for supabase-integration.js (budget switching) to call
    if (typeof window !== 'undefined') {
      window.loadDataFromSupabase = loadDataFromSupabase;
      window.setupRealtimeSubscriptions = setupRealtimeSubscriptions;
    }
    
    return true;
  } catch (error) {
    logger.error('Error initializing Supabase:', error);
    return false;
  }
}

/**
 * Initialize all feature modules with dependency injection
 * Sets up transactions, categories, goals, debts, and recurring modules
 * @returns {Promise<void>}
 */
async function initializeFeatureModules() {
  // Initialize transactions
  initTransactions({
    transactionService,
    currentBudget,
    currentUser,
    useSupabase,
    loadDataFromSupabase,
    renderAll,
    onUpdate: () => {
      currentBudget = getCurrentBudgetSync();
      useSupabase = getUseSupabaseSync();
    }
  });
  
  // Initialize categories
  initCategories({
    categoryService,
    currentBudget,
    useSupabase,
    loadDataFromSupabase,
    renderAll,
    onUpdate: () => {
      currentBudget = getCurrentBudgetSync();
      useSupabase = getUseSupabaseSync();
    }
  });
  
  // Initialize goals
  initGoals({
    goalService,
    currentBudget,
    useSupabase,
    loadDataFromSupabase,
    renderAll,
    transactionService,
    onUpdate: () => {
      currentBudget = getCurrentBudgetSync();
      useSupabase = getUseSupabaseSync();
    }
  });
  
  // Initialize debts
  initDebts({
    debtService,
    currentBudget,
    useSupabase,
    loadDataFromSupabase,
    renderAll,
    onUpdate: () => {
      currentBudget = getCurrentBudgetSync();
      useSupabase = getUseSupabaseSync();
    }
  });
  
  // Initialize recurring
  initRecurring({
    recurringService,
    currentBudget,
    useSupabase,
    loadDataFromSupabase,
    renderAll,
    onUpdate: () => {
      currentBudget = getCurrentBudgetSync();
      useSupabase = getUseSupabaseSync();
    }
  });
}

/**
 * Setup budget management handlers (Supabase only)
 * Registers event listeners for budget selector, creation, settings, and joining
 * @returns {Promise<void>}
 */
async function setupBudgetManagement() {
  if (!useSupabase) return;
  
  try {
    // Budget selector
    const budgetSelect = document.getElementById('budgetSelect');
    if (budgetSelect) {
      budgetSelect.addEventListener('change', async (e) => {
        const budgetId = e.target.value;
        if (budgetId && budgetId !== currentBudget?.id) {
          await supabaseIntegration.switchBudget(budgetId);
          // Update local variables from integration module
          currentBudget = supabaseIntegration.currentBudget || null;
          // switchBudget() already reloads and renders; keep this handler lightweight
          renderAll();
        }

        // Remove focus highlight + close dropdown after selecting a budget
        try {
          if (typeof budgetSelect.blur === 'function') {
            budgetSelect.blur();
          }
          const profileMenu = document.querySelector('.profile-menu');
          if (profileMenu) {
            profileMenu.classList.remove('active');
          }
        } catch {
          // no-op
        }
      });
    }
    
    // Create budget button
    const createBudgetBtn = document.getElementById('createBudgetBtn');
    if (createBudgetBtn) {
      createBudgetBtn.addEventListener('click', () => {
        const modal = document.getElementById('budgetModal');
        if (modal) {
          modal.classList.add('show');
          const nameInput = document.getElementById('budgetNameInput');
          const typeInput = document.getElementById('budgetTypeInput');
          if (nameInput) nameInput.value = '';
          if (typeInput) typeInput.value = 'personal';
        }
        // Close the profile dropdown after opening modal
        const profileMenu = document.querySelector('.profile-menu');
        if (profileMenu) profileMenu.classList.remove('active');
      });
    }
    
    // Save budget button (in create budget modal)
    const saveBudgetBtn = document.getElementById('saveBudgetBtn');
    if (saveBudgetBtn) {
      saveBudgetBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('budgetNameInput');
        const typeInput = document.getElementById('budgetTypeInput');
        const modal = document.getElementById('budgetModal');
        
        if (!nameInput || !typeInput) return;
        
        const name = nameInput.value.trim();
        const type = typeInput.value;
        
        if (!name) {
          showToast('Please enter a budget name', 'Error');
          return;
        }
        
        try {
          await supabaseIntegration.createBudget(name, type);
          await supabaseIntegration.loadUserData();
          await supabaseIntegration.updateBudgetSelector();
          renderAll();
          if (modal) {
            modal.classList.remove('show');
          }
          showToast('Budget created', 'Success');
        } catch (error) {
          logger.error('Error creating budget:', error);
          showToast('Error creating budget', 'Error');
        }
      });
    }
    
    // Cancel budget button (in create budget modal)
    const cancelBudgetBtn = document.getElementById('cancelBudgetBtn');
    if (cancelBudgetBtn) {
      cancelBudgetBtn.addEventListener('click', () => {
        const modal = document.getElementById('budgetModal');
        if (modal) {
          modal.classList.remove('show');
        }
      });
    }
    
    // Budget settings button
    const budgetSettingsBtn = document.getElementById('budgetSettingsBtn');
    if (budgetSettingsBtn) {
      budgetSettingsBtn.addEventListener('click', async () => {
        const handlers = await import('./ui-handlers.js');
        await handlers.openBudgetSettings();
      });
    }
    
    // Manage budgets button
    const manageBudgetsBtn = document.getElementById('manageBudgetsBtn');
    if (manageBudgetsBtn) {
      manageBudgetsBtn.addEventListener('click', async () => {
        const handlers = await import('./ui-handlers.js');
        await handlers.openManageBudgets();
      });
    }
    
    // Close manage budgets modal button
    const closeManageBudgetsBtn = document.getElementById('closeManageBudgetsBtn');
    if (closeManageBudgetsBtn) {
      closeManageBudgetsBtn.addEventListener('click', () => {
        const modal = document.getElementById('manageBudgetsModal');
        if (modal) {
          modal.classList.remove('show');
        }
      });
    }
    
    // Join budget button
    const joinBudgetBtn = document.getElementById('joinBudgetBtn');
    if (joinBudgetBtn) {
      joinBudgetBtn.addEventListener('click', () => {
        const modal = document.getElementById('joinBudgetModal');
        if (modal) {
          modal.classList.add('show');
        }
      });
    }
    
    // Join budget form
    const joinBudgetForm = document.getElementById('joinBudgetForm');
    if (joinBudgetForm) {
      joinBudgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const handlers = await import('./ui-handlers.js');
        await handlers.joinBudgetWithCode();
      });
    }
    
    // Join budget submit button
    const joinBudgetSubmitBtn = document.getElementById('joinBudgetSubmitBtn');
    if (joinBudgetSubmitBtn) {
      joinBudgetSubmitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const handlers = await import('./ui-handlers.js');
        await handlers.joinBudgetWithCode();
      });
    }
    
    // Cancel join budget button
    const cancelJoinBudgetBtn = document.getElementById('cancelJoinBudgetBtn');
    if (cancelJoinBudgetBtn) {
      cancelJoinBudgetBtn.addEventListener('click', () => {
        const modal = document.getElementById('joinBudgetModal');
        if (modal) {
          modal.classList.remove('show');
        }
        const codeInput = document.getElementById('inviteCodeInput');
        if (codeInput) {
          codeInput.value = '';
        }
      });
    }
    
    // Create budget from manage modal button
    const createBudgetFromManageBtn = document.getElementById('createBudgetFromManageBtn');
    if (createBudgetFromManageBtn) {
      createBudgetFromManageBtn.addEventListener('click', async () => {
        const name = prompt('Enter budget name:');
        if (!name) return;
        
        const type = confirm('Is this a shared budget?') ? 'shared' : 'personal';
        
        try {
          await supabaseIntegration.createBudget(name, type);
          await supabaseIntegration.loadUserData();
          await supabaseIntegration.updateBudgetSelector();
          
          // Reload the manage budgets modal
          const handlers = await import('./ui-handlers.js');
          await handlers.openManageBudgets();
          
          showToast('Budget created', 'Success');
        } catch (error) {
          logger.error('Error creating budget:', error);
          showToast('Error creating budget', 'Error');
        }
      });
    }
    
    // Update budget selector
    await supabaseIntegration.updateBudgetSelector();
  } catch (error) {
    logger.error('Error setting up budget management:', error);
  }
}

/**
 * Get current budget synchronously (for callbacks)
 * @returns {Object|null} Current budget object or null
 */
function getCurrentBudgetSync() {
  return currentBudget;
}

/**
 * Get Supabase usage flag synchronously (for callbacks)
 * @returns {boolean} True if using Supabase, false otherwise
 */
function getUseSupabaseSync() {
  return useSupabase;
}

/**
 * Get current budget asynchronously (for direct calls)
 * Updates from integration module if available
 * @returns {Promise<Object|null>} Current budget object or null
 */
async function getCurrentBudget() {
  try {
    if (supabaseIntegration.currentBudget) {
      currentBudget = supabaseIntegration.currentBudget;
    }
    return currentBudget;
  } catch {
    return currentBudget;
  }
}

/**
 * Get Supabase usage flag asynchronously (for direct calls)
 * @returns {Promise<boolean>} True if using Supabase, false otherwise
 */
async function getUseSupabase() {
  try {
    return useSupabase;
  } catch {
    return useSupabase;
  }
}

/**
 * Create loadDataFromSupabase function that uses stateManager
 */
function createLoadDataFromSupabase() {
  let loadSeq = 0;
  // Avoid repeatedly trying to seed default categories (can spam 409 conflicts if categories already exist
  // but aren't visible yet due to timing / permissions).
  const defaultCategoriesSeedAttempted = new Set();
  return async function loadDataFromSupabase() {
    const seq = ++loadSeq;
    // Prefer integration module's budget (it updates on budget switches)
    const budgetContext = supabaseIntegration.currentBudget || currentBudget;
    if (!currentUser || !budgetContext) {
      logger.log('Skipping Supabase load:', { hasBudget: !!budgetContext, hasUser: !!currentUser });
      return;
    }

    const budgetId = budgetContext.id;
    const isStillCurrent = () => {
      const latestBudgetId = (supabaseIntegration.currentBudget || currentBudget)?.id;
      return seq === loadSeq && latestBudgetId === budgetId;
    };
    
    logger.log('[loadDataFromSupabase] start for budget:', budgetContext.id, budgetContext.name || '');
    
    try {
      // Load transactions
      const { data: transactions, error: txError } = await transactionService.getTransactions(budgetContext.id);
      if (!isStillCurrent()) return;
      if (txError) {
        logger.error('Error loading transactions:', txError);
      } else {
        logger.log('Loaded transactions from Supabase:', transactions?.length || 0);
      }
      
      // Load categories
      const { data: categories, error: catError } = await categoryService.getCategories(budgetContext.id);
      if (!isStillCurrent()) return;
      if (catError) logger.error('Error loading categories:', catError);
      
      // Load savings goals
      const { data: savingsGoals, error: sgError } = await goalService.getSavingsGoals(budgetContext.id);
      if (!isStillCurrent()) return;
      if (sgError) logger.error('Error loading savings goals:', sgError);
      
      // Load financial goals
      const { data: financialGoals, error: fgError } = await goalService.getFinancialGoals(budgetContext.id);
      if (!isStillCurrent()) return;
      if (fgError) logger.error('Error loading financial goals:', fgError);
      
      // Load debts
      const { data: debts, error: debtError } = await debtService.getDebts(budgetContext.id);
      if (!isStillCurrent()) return;
      if (debtError) logger.error('Error loading debts:', debtError);
      
      // Load recurring transactions
      const { data: recurringTransactions, error: recError } = await recurringService.getRecurringTransactions(budgetContext.id);
      if (!isStillCurrent()) return;
      if (recError) logger.error('Error loading recurring transactions:', recError);
      
      const otherCategoryId =
        (categories || []).find(c => (c?.name || '').toLowerCase() === 'other')?.id ||
        (categories || []).find(c => (c?.name || '').toLowerCase().includes('other'))?.id ||
        null;

      // Transform Supabase data to match localStorage format
      const transformedTransactions = (transactions || []).map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: parseFloat(t.amount),
        type: t.type,
        categoryId: t.category_id || t.category?.id || t.categories?.id || otherCategoryId || null,
        merchant: t.merchant || undefined,
        note: t.notes || undefined,
        userId: t.user_id,
        user: t.user
      }));
      
      let transformedCategories = (categories || []).map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        monthlyBudget: parseFloat(c.monthly_budget || 0)
      }));
      
      // If no categories exist, create default ones
      const shouldSeedDefaults =
        !catError &&
        Array.isArray(categories) &&
        categories.length === 0 &&
        categoryService &&
        !defaultCategoriesSeedAttempted.has(budgetContext.id);

      if (shouldSeedDefaults) {
        defaultCategoriesSeedAttempted.add(budgetContext.id);
        logger.log('No categories found, creating default categories...');
        const { DEFAULT_CATEGORIES } = await import('./constants.js');
        if (!isStillCurrent()) return;
        
        let sawConflict = false;
        for (const cat of DEFAULT_CATEGORIES) {
          try {
            const { data: newCat, error } = await categoryService.createCategory(budgetContext.id, {
              name: cat.name,
              color: cat.color,
              monthly_budget: cat.monthlyBudget || 0
            });
            if (error) {
              const isConflict = error.code === '23505' || 
                               error.code === 'PGRST204' || 
                               error.status === 409 ||
                               error.message?.includes('duplicate') ||
                               error.message?.includes('unique') ||
                               error.message?.includes('already exists');
              if (isConflict) {
                sawConflict = true;
              }
              if (!isConflict) {
                logger.warn('Error creating category:', cat.name, error);
              }
            }
          } catch (err) {
            const isConflict = err.code === '23505' || 
                             err.code === 'PGRST204' ||
                             err.status === 409 ||
                             err.message?.includes('duplicate') ||
                             err.message?.includes('unique');
            if (isConflict) {
              sawConflict = true;
            }
            if (!isConflict) {
              logger.error('Error creating default category:', err);
            }
          }
        }
        
        // Reload categories from Supabase
        const { data: reloadedCategories, error: reloadError } = await categoryService.getCategories(budgetContext.id);
        if (!isStillCurrent()) return;
        if (!reloadError && reloadedCategories && reloadedCategories.length > 0) {
          transformedCategories = reloadedCategories.map(c => ({
            id: c.id,
            name: c.name,
            color: c.color,
            monthlyBudget: parseFloat(c.monthly_budget || 0)
          }));
          logger.log('Loaded', transformedCategories.length, 'categories from Supabase after creation');
        } else {
          logger.warn('Failed to reload categories after creation:', reloadError);
          // If we hit conflicts but still see 0 categories, it usually means the rows exist but aren't visible
          // due to permissions/RLS. Avoid retry loops and keep UI usable with defaults.
          if (sawConflict) {
            logger.warn('Default category seed saw conflicts but categories are still not visible. This usually indicates RLS/permissions are preventing SELECT on categories for this budget.');
          }
        }
      }
      
      const transformedSavingsGoals = (savingsGoals || []).map(g => ({
        id: g.id,
        name: g.name,
        target: parseFloat(g.target),
        current: parseFloat(g.current || 0)
      }));
      
      const transformedFinancialGoals = (financialGoals || []).map(g => ({
        id: g.id,
        name: g.name,
        type: g.type,
        target: parseFloat(g.target),
        current: parseFloat(g.current || 0),
        targetDate: g.target_date || undefined
      }));
      
      const transformedDebts = (debts || []).map(d => ({
        id: d.id,
        name: d.name,
        currentBalance: parseFloat(d.current_balance),
        originalBalance: parseFloat(d.original_balance || d.current_balance),
        interestRate: parseFloat(d.interest_rate || 0),
        minPayment: parseFloat(d.min_payment || 0),
        targetDate: d.target_date || undefined
      }));
      
      const transformedRecurring = (recurringTransactions || []).map(r => ({
        id: r.id,
        description: r.description,
        amount: parseFloat(r.amount),
        type: r.type,
        categoryId: r.category_id || r.category?.id || 'other',
        frequency: r.frequency,
        nextDate: r.next_date
      }));
      
      // Update state with Supabase data
      const budgetDataKey = budgetContext.id;
      logger.log('Updating state with Supabase data:', {
        transactions: transformedTransactions.length,
        categories: transformedCategories.length,
        savingsGoals: transformedSavingsGoals.length
      });

      // IMPORTANT: switch active profile to the budget key BEFORE setting data,
      // otherwise we write to the wrong profile and then switch to an empty one.
      if (!isStillCurrent()) return;
      stateManager.setActiveProfileId(budgetDataKey);

      const { DEFAULT_CATEGORIES } = await import('./constants.js');
      if (!isStillCurrent()) return;
      stateManager.setActiveData({
        categories:
          transformedCategories.length > 0
            ? transformedCategories
            : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
        transactions: transformedTransactions,
        savingsGoals: transformedSavingsGoals,
        financialGoals: transformedFinancialGoals,
        debts: transformedDebts,
        recurringTransactions: transformedRecurring,
        lastImportBatchIds: []
      });
      
      logger.log('[loadDataFromSupabase] State updated for budget', budgetDataKey, 'transactions:', stateManager.getActiveData().transactions.length);
      
      // Render UI after data is loaded
      renderAll();
      
      logger.log('[loadDataFromSupabase] complete for budget:', budgetDataKey);
    } catch (error) {
      logger.error('[loadDataFromSupabase] Error loading data from Supabase:', error);
      throw error;
    }
  };
}

/**
 * Create setupRealtimeSubscriptions function
 * Sets up real-time subscriptions for shared budgets
 * @returns {Function} Function that sets up real-time subscriptions
 */
function createSetupRealtimeSubscriptions() {
  /**
   * Setup real-time subscriptions for shared budgets
   * Subscribes to transactions, members, categories, goals, debts, and recurring updates
   * @returns {void}
   */
  return function setupRealtimeSubscriptions() {
    // Always subscribe to the current user's membership changes so we can detect removals
    // even when the user is not currently viewing a shared budget.
    if (useSupabase && realtimeService && currentUser?.id) {
      const existing = stateManager.getRealtimeChannels()?.my_membership;
      if (existing) {
        realtimeService.unsubscribe(existing);
        stateManager.removeRealtimeChannel('my_membership');
      }

      const myMembershipChannel = realtimeService.subscribeToMyMembership(currentUser.id, async (payload) => {
        try {
          const { eventType, old: oldRecord } = payload || {};
          // Only care about removals of THIS user
          if (eventType === 'DELETE' && oldRecord?.user_id === currentUser.id) {
            const removedBudgetId = oldRecord.budget_id;
            const budgetName =
              (supabaseIntegration.userBudgets || []).find(b => b.id === removedBudgetId)?.name ||
              (supabaseIntegration.currentBudget?.id === removedBudgetId ? supabaseIntegration.currentBudget?.name : null) ||
              'that budget';

            // Mark so loadUserData doesn't double-toast for the same budget
            try {
              sessionStorage.setItem(`budgetRemovedToast:${removedBudgetId}`, '1');
            } catch {
              // no-op
            }

            // Boot user from the budget (do NOT log out). We refresh budgets and, if they were currently
            // viewing the removed budget, they'll be auto-switched away by loadUserData().
            showToast(`You were removed from ${budgetName}.`, 'Access removed');

            // If the removed budget was the "activeBudgetId", clear it so we don't keep trying to select it.
            try {
              const activeBudgetId = localStorage.getItem('activeBudgetId');
              if (activeBudgetId === removedBudgetId) {
                localStorage.removeItem('activeBudgetId');
              }
            } catch {
              // no-op
            }
          }

          // Refresh budgets + UI on any membership change for this user
          await supabaseIntegration.loadUserData();
          renderAll();
        } catch (e) {
          logger.warn('[realtime] my_membership handler error:', e);
        }
      });

      stateManager.setRealtimeChannel('my_membership', myMembershipChannel);
    }

    // Prefer integration module's budget (it updates on budget switches / joins)
    // Keep local `currentBudget` in sync to avoid subscribing to stale budgets.
    const budgetContext =
      supabaseIntegration.currentBudget ||
      currentBudget ||
      (typeof window !== 'undefined' ? window.currentBudget : null);
    if (budgetContext && (!currentBudget || currentBudget.id !== budgetContext.id)) {
      currentBudget = budgetContext;
    }
    if (!useSupabase || !budgetContext || budgetContext.type !== 'shared') {
      // Unsubscribe from any existing budget-scoped channels (keep my_membership)
      if (realtimeService) {
        const channels = stateManager.getRealtimeChannels();
        Object.entries(channels).forEach(([name, channel]) => {
          if (!channel) return;
          if (name === 'my_membership') return;
          realtimeService.unsubscribe(channel);
        });
        stateManager.removeRealtimeChannel('transactions');
        stateManager.removeRealtimeChannel('members');
        stateManager.removeRealtimeChannel('categories');
        stateManager.removeRealtimeChannel('goals');
        stateManager.removeRealtimeChannel('debts');
        stateManager.removeRealtimeChannel('recurring');
      }
      logger.log('[realtime] unsubscribed (not shared or no budget)');
      return;
    }
    
    // Unsubscribe from previous budget's channels
    if (realtimeService) {
      const channels = stateManager.getRealtimeChannels();
      Object.entries(channels).forEach(([name, channel]) => {
        if (!channel) return;
        if (name === 'my_membership') return;
        realtimeService.unsubscribe(channel);
      });
      stateManager.removeRealtimeChannel('transactions');
      stateManager.removeRealtimeChannel('members');
      stateManager.removeRealtimeChannel('categories');
      stateManager.removeRealtimeChannel('goals');
      stateManager.removeRealtimeChannel('debts');
      stateManager.removeRealtimeChannel('recurring');
    }
    
    logger.log('[realtime] subscribing for budget', budgetContext.id);
    
    // Subscribe to transactions
    if (realtimeService) {
      const txChannel = realtimeService.subscribeToTransactions(budgetContext.id, (payload) => {
        handleRealtimeUpdate('transactions', payload);
      });
      stateManager.setRealtimeChannel('transactions', txChannel);

      // Members (for shared budgets)
      const membersChannel = realtimeService.subscribeToMembers(budgetContext.id, (payload) => {
        handleRealtimeUpdate('members', payload);
      });
      stateManager.setRealtimeChannel('members', membersChannel);
      
      const categoriesChannel = realtimeService.subscribeToCategories(budgetContext.id, (payload) => {
        handleRealtimeUpdate('categories', payload);
      });
      stateManager.setRealtimeChannel('categories', categoriesChannel);
      
      const goalsChannel = realtimeService.subscribeToSavingsGoals(budgetContext.id, (payload) => {
        handleRealtimeUpdate('goals', payload);
      });
      stateManager.setRealtimeChannel('goals', goalsChannel);
      
      const debtsChannel = realtimeService.subscribeToDebts(budgetContext.id, (payload) => {
        handleRealtimeUpdate('debts', payload);
      });
      stateManager.setRealtimeChannel('debts', debtsChannel);
      
      const recurringChannel = realtimeService.subscribeToRecurringTransactions(budgetContext.id, (payload) => {
        handleRealtimeUpdate('recurring', payload);
      });
      stateManager.setRealtimeChannel('recurring', recurringChannel);
    }
    
    logger.log('[setupRealtimeSubscriptions] Subscriptions set up');
  };
}

/**
 * Handle real-time updates from Supabase
 * Processes real-time events and updates state/UI accordingly
 * @param {string} type - Event type ('transactions', 'members', 'categories', 'goals', 'debts', 'recurring')
 * @param {Object} payload - Event payload with event type and data
 * @param {string} payload.eventType - Event type ('INSERT', 'UPDATE', 'DELETE')
 * @param {Object} payload.new - New record data (for INSERT/UPDATE)
 * @param {Object} payload.old - Old record data (for UPDATE/DELETE)
 * @returns {void}
 */
function handleRealtimeUpdate(type, payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;
  logger.log('[realtime]', type, eventType, { newRecord, oldRecord });

  // Debounced "source of truth" refresh to keep joins/derived fields correct,
  // while still allowing instant UI updates from realtime payloads.
  let refreshTimerId = handleRealtimeUpdate._refreshTimerId;
  const scheduleRefresh = () => {
    if (!loadDataFromSupabase) return;
    if (refreshTimerId) clearTimeout(refreshTimerId);
    refreshTimerId = setTimeout(() => {
      loadDataFromSupabase().then(() => renderAll());
    }, 250);
    handleRealtimeUpdate._refreshTimerId = refreshTimerId;
  };

  const toLocalTx = (record) => {
    if (!record) return null;
    // Supabase realtime payloads include raw table columns (no joins)
    return {
      id: record.id,
      date: record.date,
      description: record.description,
      amount: parseFloat(record.amount),
      type: record.type,
      categoryId: record.category_id || 'other',
      merchant: record.merchant || undefined,
      note: record.notes || undefined,
      userId: record.user_id
    };
  };
  
  if (type === 'transactions') {
    // Fast-path: update local state immediately so UI updates instantly
    try {
      const data = stateManager.getActiveData();
      const existing = Array.isArray(data.transactions) ? data.transactions : [];
      let next = existing.slice();

      if (eventType === 'INSERT') {
        const local = toLocalTx(newRecord);
        if (local?.id) {
          const idx = next.findIndex(t => t.id === local.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...local };
          else next.unshift(local);
          stateManager.setActiveData({ transactions: next });
          renderAll();
        }
      } else if (eventType === 'UPDATE') {
        const local = toLocalTx(newRecord);
        if (local?.id) {
          const idx = next.findIndex(t => t.id === local.id);
          if (idx >= 0) {
            next[idx] = { ...next[idx], ...local };
            stateManager.setActiveData({ transactions: next });
            renderAll();
          }
        }
      } else if (eventType === 'DELETE') {
        const deletedId = oldRecord?.id || newRecord?.id;
        if (deletedId) {
          const filtered = next.filter(t => t.id !== deletedId);
          if (filtered.length !== next.length) {
            stateManager.setActiveData({ transactions: filtered });
            renderAll();
          }
        }
      }
    } catch (e) {
      logger.warn('[realtime] failed to apply transaction fast-path update:', e);
    }

    if (eventType === 'INSERT') {
      const user = newRecord.user || {};
      const userName = user.display_name || user.username || 'Someone';
      showToast(`${userName} added a transaction`, 'Update');
      scheduleRefresh();
    } else if (eventType === 'UPDATE') {
      showToast('Transaction updated', 'Update');
      scheduleRefresh();
    } else if (eventType === 'DELETE') {
      showToast('Transaction deleted', 'Update');
      scheduleRefresh();
    }
  } else if (type === 'members') {
    if (eventType === 'INSERT') {
      showToast('A new member joined this budget', 'Update');
    } else if (eventType === 'DELETE') {
      showToast('A member was removed from this budget', 'Update');
    } else if (eventType === 'UPDATE') {
      showToast('Budget member updated', 'Update');
    }
    // Reload members & budgets so all clients see the change
    scheduleRefresh();
    supabaseIntegration.loadUserData();
  } else if (type === 'categories') {
    showToast('Categories updated', 'Update');
    scheduleRefresh();
  } else if (type === 'goals') {
    showToast('Goals updated', 'Update');
    scheduleRefresh();
  } else if (type === 'debts') {
    showToast('Debts updated', 'Update');
    scheduleRefresh();
  } else if (type === 'recurring') {
    showToast('Recurring transactions updated', 'Update');
    scheduleRefresh();
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });
} else {
  initApp();
}

