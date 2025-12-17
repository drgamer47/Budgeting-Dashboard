/**
 * Migration Utility
 * Migrates data from localStorage to Supabase
 */

import { 
  budgetService, 
  categoryService, 
  transactionService,
  goalService,
  debtService,
  recurringService
} from './supabase-service.js';

export const migrationService = {
  /**
   * Check if localStorage has data to migrate
   */
  hasLocalStorageData() {
    const raw = localStorage.getItem("budgetDashboardState_v2_profiles");
    if (!raw) return false;
    
    try {
      const state = JSON.parse(raw);
      const activeData = state.dataByProfile?.[state.activeProfileId];
      return activeData && (
        activeData.transactions?.length > 0 ||
        activeData.categories?.length > 0 ||
        activeData.savingsGoals?.length > 0 ||
        activeData.financialGoals?.length > 0 ||
        activeData.debts?.length > 0 ||
        activeData.recurringTransactions?.length > 0
      );
    } catch (e) {
      return false;
    }
  },

  /**
   * Get localStorage data
   */
  getLocalStorageData() {
    const raw = localStorage.getItem("budgetDashboardState_v2_profiles");
    if (!raw) return null;
    
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  /**
   * Migrate all data from localStorage to Supabase
   */
  async migrateToSupabase(userId, budgetId, onProgress) {
    const state = this.getLocalStorageData();
    if (!state) {
      throw new Error('No localStorage data found');
    }

    const activeData = state.dataByProfile?.[state.activeProfileId];
    if (!activeData) {
      throw new Error('No active profile data found');
    }

    const results = {
      categories: 0,
      transactions: 0,
      savingsGoals: 0,
      financialGoals: 0,
      debts: 0,
      recurringTransactions: 0,
      errors: []
    };

    try {
      // 1. Migrate categories
      if (onProgress) onProgress('Migrating categories...');
      if (activeData.categories && activeData.categories.length > 0) {
        for (const cat of activeData.categories) {
          try {
            await categoryService.createCategory(budgetId, {
              name: cat.name,
              color: cat.color,
              monthly_budget: cat.monthlyBudget || 0
            });
            results.categories++;
          } catch (error) {
            results.errors.push(`Category "${cat.name}": ${error.message}`);
          }
        }
      }

      // 2. Get category mapping (old IDs to new UUIDs)
      if (onProgress) onProgress('Mapping categories...');
      const { data: categories } = await categoryService.getCategories(budgetId);
      const categoryMap = {};
      if (categories) {
        activeData.categories?.forEach(oldCat => {
          const newCat = categories.find(c => c.name === oldCat.name);
          if (newCat) {
            categoryMap[oldCat.id] = newCat.id;
          }
        });
      }

      // 3. Migrate transactions
      if (onProgress) onProgress('Migrating transactions...');
      if (activeData.transactions && activeData.transactions.length > 0) {
        const transactionsToMigrate = activeData.transactions.map(tx => ({
          date: tx.date,
          amount: parseFloat(tx.amount),
          description: tx.description,
          type: tx.type,
          category_id: categoryMap[tx.categoryId] || null,
          merchant: tx.merchant || null,
          notes: tx.note || null,
          plaid_id: tx.plaid_id || null,
          account_id: tx.account_id || null
        }));

        // Batch insert in chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < transactionsToMigrate.length; i += chunkSize) {
          const chunk = transactionsToMigrate.slice(i, i + chunkSize);
          try {
            await transactionService.bulkCreateTransactions(budgetId, userId, chunk);
            results.transactions += chunk.length;
          } catch (error) {
            results.errors.push(`Transactions batch ${i / chunkSize + 1}: ${error.message}`);
          }
        }
      }

      // 4. Migrate savings goals
      if (onProgress) onProgress('Migrating savings goals...');
      if (activeData.savingsGoals && activeData.savingsGoals.length > 0) {
        for (const goal of activeData.savingsGoals) {
          try {
            await goalService.createSavingsGoal(budgetId, {
              name: goal.name,
              target: parseFloat(goal.target),
              current: parseFloat(goal.current || 0)
            });
            results.savingsGoals++;
          } catch (error) {
            results.errors.push(`Savings goal "${goal.name}": ${error.message}`);
          }
        }
      }

      // 5. Migrate financial goals
      if (onProgress) onProgress('Migrating financial goals...');
      if (activeData.financialGoals && activeData.financialGoals.length > 0) {
        for (const goal of activeData.financialGoals) {
          try {
            await goalService.createFinancialGoal(budgetId, {
              name: goal.name,
              type: goal.type || 'savings',
              target: parseFloat(goal.target),
              current: parseFloat(goal.current || 0),
              target_date: goal.targetDate || null
            });
            results.financialGoals++;
          } catch (error) {
            results.errors.push(`Financial goal "${goal.name}": ${error.message}`);
          }
        }
      }

      // 6. Migrate debts
      if (onProgress) onProgress('Migrating debts...');
      if (activeData.debts && activeData.debts.length > 0) {
        for (const debt of activeData.debts) {
          try {
            await debtService.createDebt(budgetId, {
              name: debt.name,
              current_balance: parseFloat(debt.currentBalance),
              original_balance: parseFloat(debt.originalBalance || debt.currentBalance),
              interest_rate: parseFloat(debt.interestRate || 0),
              min_payment: parseFloat(debt.minPayment || 0),
              target_date: debt.targetDate || null
            });
            results.debts++;
          } catch (error) {
            results.errors.push(`Debt "${debt.name}": ${error.message}`);
          }
        }
      }

      // 7. Migrate recurring transactions
      if (onProgress) onProgress('Migrating recurring transactions...');
      if (activeData.recurringTransactions && activeData.recurringTransactions.length > 0) {
        for (const recurring of activeData.recurringTransactions) {
          try {
            await recurringService.createRecurringTransaction(budgetId, {
              description: recurring.description,
              amount: parseFloat(recurring.amount),
              type: recurring.type,
              category_id: categoryMap[recurring.categoryId] || null,
              frequency: recurring.frequency || 'monthly',
              next_date: recurring.nextDate
            });
            results.recurringTransactions++;
          } catch (error) {
            results.errors.push(`Recurring transaction "${recurring.description}": ${error.message}`);
          }
        }
      }

      if (onProgress) onProgress('Migration complete!');
      return results;

    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
  },

  /**
   * Clear localStorage after successful migration
   */
  clearLocalStorage() {
    localStorage.removeItem("budgetDashboardState_v2_profiles");
    localStorage.removeItem("budgetDashboardSettings");
    localStorage.removeItem("budgetDashboardTheme");
    localStorage.removeItem("budgetDashboardActiveTab");
  }
};

