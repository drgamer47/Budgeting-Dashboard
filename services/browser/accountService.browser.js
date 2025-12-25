/**
 * Account Service (Browser)
 * Handles CRUD operations for accounts in the browser
 */

export class AccountServiceBrowser {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Get all accounts for a budget
   * @param {string} budgetId - Budget UUID
   * @returns {Promise<{data: Array, error: any}>}
   */
  async getAccounts(budgetId) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .select('*')
        .eq('budget_id', budgetId)
        .order('created_at', { ascending: true });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get a single account by ID
   * @param {string} accountId - Account UUID
   * @returns {Promise<{data: Object, error: any}>}
   */
  async getAccount(accountId) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Create a new account
   * @param {string} budgetId - Budget UUID
   * @param {Object} accountData - Account data
   * @param {string} accountData.name - Account name
   * @param {string} accountData.type - Account type (checking, savings, credit_card, investment)
   * @param {number} accountData.current_balance - Current balance
   * @param {number} [accountData.credit_limit] - Credit limit (required for credit cards)
   * @returns {Promise<{data: Object, error: any}>}
   */
  async createAccount(budgetId, accountData) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .insert([{
          budget_id: budgetId,
          name: accountData.name,
          type: accountData.type,
          current_balance: accountData.current_balance || 0,
          credit_limit: accountData.credit_limit || null
        }])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update an account
   * @param {string} accountId - Account UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<{data: Object, error: any}>}
   */
  async updateAccount(accountId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .update(updates)
        .eq('id', accountId)
        .select()
        .maybeSingle();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Delete an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<{error: any}>}
   */
  async deleteAccount(accountId) {
    try {
      const { error } = await this.supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);

      return { error };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Get accounts by type
   * @param {string} budgetId - Budget UUID
   * @param {string} type - Account type
   * @returns {Promise<{data: Array, error: any}>}
   */
  async getAccountsByType(budgetId, type) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .select('*')
        .eq('budget_id', budgetId)
        .eq('type', type)
        .order('created_at', { ascending: true });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get credit card accounts
   * @param {string} budgetId - Budget UUID
   * @returns {Promise<{data: Array, error: any}>}
   */
  async getCreditCardAccounts(budgetId) {
    return this.getAccountsByType(budgetId, 'credit_card');
  }

  /**
   * Calculate total assets (checking + savings + investment accounts)
   * @param {string} budgetId - Budget UUID
   * @returns {Promise<{total: number, error: any}>}
   */
  async calculateAssets(budgetId) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .select('current_balance')
        .eq('budget_id', budgetId)
        .in('type', ['checking', 'savings', 'investment']);

      if (error) return { total: 0, error };

      const total = data?.reduce((sum, acc) => sum + (parseFloat(acc.current_balance) || 0), 0) || 0;
      return { total, error: null };
    } catch (error) {
      return { total: 0, error };
    }
  }

  /**
   * Calculate total credit card debt
   * @param {string} budgetId - Budget UUID
   * @returns {Promise<{total: number, error: any}>}
   */
  async calculateCreditCardDebt(budgetId) {
    try {
      const { data, error } = await this.supabase
        .from('accounts')
        .select('current_balance')
        .eq('budget_id', budgetId)
        .eq('type', 'credit_card');

      if (error) return { total: 0, error };

      const total = data?.reduce((sum, acc) => sum + (parseFloat(acc.current_balance) || 0), 0) || 0;
      return { total, error: null };
    } catch (error) {
      return { total: 0, error };
    }
  }

  /**
   * Update account balance based on transaction
   * @param {string} accountId - Account UUID
   * @param {number} amount - Transaction amount
   * @param {string} type - Transaction type (income or expense)
   * @returns {Promise<{data: Object, error: any}>}
   */
  async adjustAccountBalance(accountId, amount, type) {
    try {
      // Get current balance
      const { data: account, error: fetchError } = await this.getAccount(accountId);
      if (fetchError) return { data: null, error: fetchError };

      // Calculate new balance
      // For income: increase balance
      // For expense: decrease balance
      const currentBalance = parseFloat(account.current_balance) || 0;
      const newBalance = type === 'income'
        ? currentBalance + amount
        : currentBalance - amount;

      // Update balance
      return await this.updateAccount(accountId, { current_balance: newBalance });
    } catch (error) {
      return { data: null, error };
    }
  }
}
