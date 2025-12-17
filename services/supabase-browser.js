/**
 * Supabase Browser-Compatible Service Module
 * Works with CDN-loaded Supabase client
 * Use this instead of supabase-service.js if you're not using a build tool
 */

import { logger } from '../js/logger.js';

// Get Supabase client from window (loaded via CDN)
function getSupabase() {
  if (typeof window === 'undefined' || !window.supabase) {
    throw new Error('Supabase not initialized. Make sure Supabase CDN is loaded and configured.');
  }
  return window.supabase;
}

// ============================================
// AUTHENTICATION
// ============================================

export const authService = {
  async signUp(email, password, metadata = {}) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  },

  async signIn(email, password) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  async signOut() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async resetPassword(email) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { data, error };
  },

  async getSession() {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  async getUser() {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  onAuthStateChange(callback) {
    const supabase = getSupabase();
    return supabase.auth.onAuthStateChange(callback);
  }
};

// ============================================
// PROFILES
// ============================================

export const profileService = {
  async getProfile(userId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateProfile(userId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  }
};

// ============================================
// BUDGETS
// ============================================

export const budgetService = {
  async getUserBudgets(userId) {
    const supabase = getSupabase();
    
    // Start with simple query - just get budgets
    const { data: ownedBudgets, error: ownedError } = await supabase
      .from('budgets')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    
    if (ownedError) {
      logger.error('Error loading owned budgets:', ownedError);
      return { data: null, error: ownedError };
    }
    
    // Get budgets where user is a member
    const { data: memberRows, error: memberError } = await supabase
      .from('budget_members')
      .select('budget_id')
      .eq('user_id', userId);
    
    let memberBudgetIds = [];
    if (!memberError && memberRows) {
      memberBudgetIds = memberRows.map(row => row.budget_id);
    }
    
    // Get the actual budget records for member budgets
    let memberBudgets = [];
    if (memberBudgetIds.length > 0) {
      const { data: memberBudgetData, error: memberBudgetError } = await supabase
        .from('budgets')
        .select('*')
        .in('id', memberBudgetIds)
        .order('created_at', { ascending: false });
      
      if (!memberBudgetError && memberBudgetData) {
        memberBudgets = memberBudgetData;
      }
    }
    
    // Combine and deduplicate budgets
    const allBudgets = [...(ownedBudgets || [])];
    const budgetIds = new Set((ownedBudgets || []).map(b => b.id));
    
    memberBudgets.forEach(budget => {
      if (!budgetIds.has(budget.id)) {
        allBudgets.push(budget);
        budgetIds.add(budget.id);
      }
    });
    
    // Sort by created_at
    allBudgets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return { data: allBudgets, error: null };
  },

  async getBudget(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budgets')
      .select(`
        *,
        owner:profiles!budgets_owner_id_fkey(id, display_name, avatar_url),
        members:budget_members(
          role,
          user:profiles!budget_members_user_id_fkey(id, display_name, avatar_url)
        )
      `)
      .eq('id', budgetId)
      .single();
    return { data, error };
  },

  async createBudget(name, type = 'personal', ownerId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        name,
        type,
        owner_id: ownerId
      })
      .select()
      .single();
    return { data, error };
  },

  async updateBudget(budgetId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', budgetId)
      .select()
      .single();
    return { data, error };
  },

  async deleteBudget(budgetId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId);
    return { error };
  },

  async getBudgetMembers(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budget_members')
      .select('*')
      .eq('budget_id', budgetId)
      .order('joined_at', { ascending: true });
    if (error || !data) return { data, error };

    const userIds = [...new Set(data.map(m => m.user_id).filter(Boolean))];
    if (userIds.length === 0) return { data, error: null };

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, username')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const enriched = data.map(m => ({ ...m, user: profileMap.get(m.user_id) || null }));
    return { data: enriched, error: null };
  },

  async addMember(budgetId, userId, role = 'member') {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budget_members')
      .insert({
        budget_id: budgetId,
        user_id: userId,
        role
      })
      .select()
      .single();
    return { data, error };
  },

  async removeMember(budgetId, userId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('budget_members')
      .delete()
      .eq('budget_id', budgetId)
      .eq('user_id', userId);
    return { error };
  },

  async updateMemberRole(budgetId, userId, role) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budget_members')
      .update({ role })
      .eq('budget_id', budgetId)
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  }
};

// ============================================
// BUDGET INVITES
// ============================================

export const inviteService = {
  generateInviteCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  },

  async createInvite(budgetId, createdBy, expiresInDays = 7) {
    const supabase = getSupabase();
    const inviteCode = this.generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const { data, error } = await supabase
      .from('budget_invites')
      .insert({
        budget_id: budgetId,
        invite_code: inviteCode,
        created_by: createdBy,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();
    return { data, error };
  },

  async getInvite(inviteCode) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budget_invites')
      .select(`
        *,
        budget:budgets(*)
      `)
      .eq('invite_code', inviteCode)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();
    return { data, error };
  },

  async useInvite(inviteCode, userId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budget_invites')
      .update({
        used_at: new Date().toISOString(),
        used_by: userId
      })
      .eq('invite_code', inviteCode)
      .select()
      .single();
    return { data, error };
  },

  async getBudgetInvites(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('budget_invites')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });
    return { data, error };
  }
};

// ============================================
// CATEGORIES
// ============================================

export const categoryService = {
  async getCategories(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('budget_id', budgetId)
      .order('name', { ascending: true });
    return { data, error };
  },

  async createCategory(budgetId, category) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('categories')
      .insert({
        budget_id: budgetId,
        ...category
      })
      .select()
      .single();
    return { data, error };
  },

  async updateCategory(categoryId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();
    return { data, error };
  },

  async deleteCategory(categoryId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    return { error };
  }
};

// ============================================
// TRANSACTIONS
// ============================================

export const transactionService = {
  async getTransactions(budgetId, filters = {}) {
    const supabase = getSupabase();
    // Start with simple query - avoid foreign key relationship issues
    let query = supabase
      .from('transactions')
      .select(`
        *,
        categories(*)
      `)
      .eq('budget_id', budgetId);

    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters.search) {
      query = query.ilike('description', `%${filters.search}%`);
    }

    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    
    // If we have transactions and need user info (for shared budgets), load it separately
    if (data && !error && data.length > 0) {
      // Get unique user IDs
      const userIds = [...new Set(data.map(t => t.user_id).filter(Boolean))];
      
      if (userIds.length > 0) {
        // Load user profiles
        const { data: users } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        // Map users to transactions
        if (users) {
          const userMap = new Map(users.map(u => [u.id, u]));
          data.forEach(transaction => {
            if (transaction.user_id && userMap.has(transaction.user_id)) {
              transaction.user = userMap.get(transaction.user_id);
            }
          });
        }
      }
    }
    
    return { data, error };
  },

  async createTransaction(budgetId, userId, transaction) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        budget_id: budgetId,
        user_id: userId,
        ...transaction
      })
      .select(`
        *,
        categories(*)
      `)
      // Avoid 406/PGRST116 when RLS (or timing) results in 0 visible rows
      .maybeSingle();
    
    // If we need user info, load it separately
    if (data && !error && userId) {
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', userId)
        .single();
      
      if (userData) {
        data.user = userData;
      }
    }
    
    return { data, error };
  },

  async updateTransaction(transactionId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select(`
        *,
        categories(*)
      `)
      // Avoid 406/PGRST116 when the updated row isn't visible (RLS) or no rows matched
      .maybeSingle();
    return { data, error };
  },

  async deleteTransaction(transactionId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);
    return { error };
  },

  async bulkCreateTransactions(budgetId, userId, transactions) {
    const supabase = getSupabase();
    const transactionsWithBudget = transactions.map(t => ({
      budget_id: budgetId,
      user_id: userId,
      ...t
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionsWithBudget)
      .select(`
        *,
        categories(*)
      `);
    return { data, error };
  }
};

// ============================================
// GOALS
// ============================================

export const goalService = {
  async getSavingsGoals(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createSavingsGoal(budgetId, goal) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        budget_id: budgetId,
        ...goal
      })
      .select()
      .single();
    return { data, error };
  },

  async updateSavingsGoal(goalId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', goalId)
      .select()
      .single();
    return { data, error };
  },

  async deleteSavingsGoal(goalId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', goalId);
    return { error };
  },

  async getFinancialGoals(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createFinancialGoal(budgetId, goal) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('financial_goals')
      .insert({
        budget_id: budgetId,
        ...goal
      })
      .select()
      .single();
    return { data, error };
  },

  async updateFinancialGoal(goalId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('financial_goals')
      .update(updates)
      .eq('id', goalId)
      .select()
      .single();
    return { data, error };
  },

  async deleteFinancialGoal(goalId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('financial_goals')
      .delete()
      .eq('id', goalId);
    return { error };
  }
};

// ============================================
// DEBTS
// ============================================

export const debtService = {
  async getDebts(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createDebt(budgetId, debt) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('debts')
      .insert({
        budget_id: budgetId,
        ...debt
      })
      .select()
      .single();
    return { data, error };
  },

  async updateDebt(debtId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('debts')
      .update(updates)
      .eq('id', debtId)
      .select()
      .single();
    return { data, error };
  },

  async deleteDebt(debtId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', debtId);
    return { error };
  }
};

// ============================================
// RECURRING TRANSACTIONS
// ============================================

export const recurringService = {
  async getRecurringTransactions(budgetId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select(`*`)
      .eq('budget_id', budgetId)
      .order('next_date', { ascending: true });
    return { data, error };
  },

  async createRecurringTransaction(budgetId, transaction) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert({
        budget_id: budgetId,
        ...transaction
      })
      .select(`*`)
      .single();
    return { data, error };
  },

  async updateRecurringTransaction(transactionId, updates) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(updates)
      .eq('id', transactionId)
      .select(`*`)
      .single();
    return { data, error };
  },

  async deleteRecurringTransaction(transactionId) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('id', transactionId);
    return { error };
  }
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export const realtimeService = {
  /**
   * Subscribe to membership changes for the current user across ALL budgets.
   * This ensures we notice removals even when the user is not currently viewing that shared budget.
   */
  subscribeToMyMembership(userId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`my-membership:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budget_members',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  },

  subscribeToTransactions(budgetId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`transactions:${budgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .subscribe();
  },

  subscribeToMembers(budgetId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`members:${budgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budget_members',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .subscribe();
  },

  subscribeToCategories(budgetId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`categories:${budgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .subscribe();
  },

  /**
   * Subscribe to goals (savings_goals + financial_goals)
   * Note: Kept as the canonical implementation.
   */
  subscribeToGoals(budgetId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`goals:${budgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_goals',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_goals',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .subscribe();
  },

  /**
   * Backward-compatible alias: older app code calls subscribeToSavingsGoals().
   * We subscribe to both savings and financial goals for consistency.
   */
  subscribeToSavingsGoals(budgetId, callback) {
    return this.subscribeToGoals(budgetId, callback);
  },

  /**
   * Subscribe to debts
   */
  subscribeToDebts(budgetId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`debts:${budgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .subscribe();
  },

  /**
   * Subscribe to recurring transactions
   */
  subscribeToRecurringTransactions(budgetId, callback) {
    const supabase = getSupabase();
    return supabase
      .channel(`recurring:${budgetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recurring_transactions',
          filter: `budget_id=eq.${budgetId}`
        },
        callback
      )
      .subscribe();
  },

  unsubscribe(channel) {
    const supabase = getSupabase();
    return supabase.removeChannel(channel);
  }
};

