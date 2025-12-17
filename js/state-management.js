/**
 * State Management
 * Centralized state manager with getters/setters and event emission
 */

import { DEFAULT_CATEGORIES, DEFAULT_PROFILE, STORAGE_KEYS } from './constants.js';
import { logger } from './logger.js';
import { deepClone } from './utils.js';

/**
 * State Manager Class
 * Manages application state with validation and event emission
 */
class StateManager {
  constructor() {
    this.state = {
      profiles: [DEFAULT_PROFILE],
      activeProfileId: DEFAULT_PROFILE.id,
      dataByProfile: {
        [DEFAULT_PROFILE.id]: {
          categories: deepClone(DEFAULT_CATEGORIES),
          transactions: [],
          savingsGoals: [],
          lastImportBatchIds: [],
          recurringTransactions: [],
          debts: [],
          financialGoals: []
        }
      }
    };
    
    this.listeners = new Map(); // Event listeners
    this.useSupabase = false; // Toggle between localStorage and Supabase
    this.realtimeChannels = new Map(); // Realtime subscription channels
  }

  /**
   * Subscribe to state changes
   * @param {string} event - Event name (e.g., 'stateChange', 'profileSwitch')
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          logger.error('Error in state change listener:', e);
        }
      });
    }
  }

  /**
   * Get current state (read-only copy)
   * @returns {Object} State object
   */
  getState() {
    return deepClone(this.state);
  }

  /**
   * Set entire state (use with caution)
   * @param {Object} newState - New state object
   */
  setState(newState) {
    this.state = newState;
    this.saveState();
    this.emit('stateChange', this.getState());
  }

  /**
   * Get active profile ID
   * @returns {string} Profile ID
   */
  getActiveProfileId() {
    return this.state.activeProfileId;
  }

  /**
   * Get active profile data
   * @returns {Object} Profile data
   */
  getActiveData() {
    const key = this.getActiveProfileId();
    const data = this.state.dataByProfile[key];
    if (data) return data;
    
    // Fallback safe empty structure
    return {
      categories: [],
      transactions: [],
      savingsGoals: [],
      lastImportBatchIds: [],
      recurringTransactions: [],
      debts: [],
      financialGoals: []
    };
  }

  /**
   * Set active data for current profile
   * @param {Object} data - Data to set
   */
  setActiveData(data) {
    const key = this.getActiveProfileId();
    this.state.dataByProfile[key] = { ...this.getActiveData(), ...data };
    this.saveState();
    this.emit('stateChange', this.getState());
  }

  /**
   * Switch to a different profile
   * @param {string} profileId - Profile ID to switch to
   */
  switchProfile(profileId) {
    if (!this.state.profiles.find(p => p.id === profileId)) {
      logger.warn(`Profile ${profileId} not found`);
      return;
    }
    this.state.activeProfileId = profileId;
    this.saveState();
    this.emit('profileSwitch', { profileId, data: this.getActiveData() });
    this.emit('stateChange', this.getState());
  }

  /**
   * Update a profile's display name (localStorage mode)
   * @param {string} profileId - Profile ID
   * @param {string} newName - New profile name
   * @returns {boolean} True if updated
   */
  updateProfileName(profileId, newName) {
    const name = (newName || '').trim();
    if (!name) return false;

    const profile = this.state.profiles.find(p => p.id === profileId);
    if (!profile) return false;

    profile.name = name;
    this.saveState();
    this.emit('profileUpdated', { profileId, name });
    this.emit('stateChange', this.getState());
    return true;
  }

  /**
   * Create a new profile
   * @param {string} name - Profile name
   * @returns {Object} New profile object
   */
  createNewProfile(name = "New Profile") {
    const id = `p_${Date.now()}`;
    const profile = { id, name };
    this.state.profiles.push(profile);
    this.state.dataByProfile[id] = {
      categories: deepClone(DEFAULT_CATEGORIES),
      transactions: [],
      savingsGoals: [],
      lastImportBatchIds: [],
      recurringTransactions: [],
      debts: [],
      financialGoals: []
    };
    this.saveState();
    this.emit('profileCreated', profile);
    this.emit('stateChange', this.getState());
    return profile;
  }

  /**
   * Save state to localStorage (if not using Supabase)
   */
  saveState() {
    if (this.useSupabase) {
      logger.debug('Skipping localStorage save - using Supabase');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(this.state));
    } catch (e) {
      logger.error('Failed to save state:', e);
    }
  }

  /**
   * Load state from localStorage (if not using Supabase)
   */
  loadState() {
    if (this.useSupabase) {
      logger.debug('Skipping localStorage load - using Supabase');
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATE);
      if (!raw) {
        this.saveState();
        return;
      }

      this.state = JSON.parse(raw);

      // Ensure structural integrity
      if (!this.state.dataByProfile) this.state.dataByProfile = {};
      if (!this.state.profiles) {
        this.state.profiles = [DEFAULT_PROFILE];
      }
      if (!this.state.activeProfileId) {
        this.state.activeProfileId = this.state.profiles[0].id;
      }

      // Ensure each profile has all sections
      for (let p of this.state.profiles) {
        if (!this.state.dataByProfile[p.id]) {
          this.state.dataByProfile[p.id] = {
            categories: deepClone(DEFAULT_CATEGORIES),
            transactions: [],
            savingsGoals: [],
            lastImportBatchIds: [],
            recurringTransactions: [],
            debts: [],
            financialGoals: []
          };
        }
      }

      this.emit('stateChange', this.getState());
    } catch (e) {
      logger.error("State load failed, resetting:", e);
      this.state = {
        profiles: [DEFAULT_PROFILE],
        activeProfileId: DEFAULT_PROFILE.id,
        dataByProfile: {
          [DEFAULT_PROFILE.id]: {
            categories: deepClone(DEFAULT_CATEGORIES),
            transactions: [],
            savingsGoals: [],
            lastImportBatchIds: [],
            recurringTransactions: [],
            debts: [],
            financialGoals: []
          }
        }
      };
      this.saveState();
    }
  }

  /**
   * Set Supabase mode
   * @param {boolean} enabled - Whether to use Supabase
   */
  setUseSupabase(enabled) {
    this.useSupabase = enabled;
  }

  /**
   * Get Supabase mode
   * @returns {boolean} Whether using Supabase
   */
  getUseSupabase() {
    return this.useSupabase;
  }

  /**
   * Set active profile ID (for Supabase budget switching)
   * @param {string} profileId - Profile ID to set as active
   */
  setActiveProfileId(profileId) {
    this.state.activeProfileId = profileId;
    // Ensure profile data exists
    if (!this.state.dataByProfile[profileId]) {
      this.state.dataByProfile[profileId] = {
        categories: deepClone(DEFAULT_CATEGORIES),
        transactions: [],
        savingsGoals: [],
        lastImportBatchIds: [],
        recurringTransactions: [],
        debts: [],
        financialGoals: []
      };
    }
    this.saveState();
    this.emit('profileSwitch', { profileId, data: this.getActiveData() });
    this.emit('stateChange', this.getState());
  }

  /**
   * Get all realtime channels
   * @returns {Object} Object with channel names as keys and channel objects as values
   */
  getRealtimeChannels() {
    return Object.fromEntries(this.realtimeChannels);
  }

  /**
   * Set a realtime channel
   * @param {string} name - Channel name (e.g., 'transactions', 'members')
   * @param {Object} channel - Channel object from Supabase
   */
  setRealtimeChannel(name, channel) {
    this.realtimeChannels.set(name, channel);
  }

  /**
   * Remove a realtime channel
   * @param {string} name - Channel name to remove
   */
  removeRealtimeChannel(name) {
    this.realtimeChannels.delete(name);
  }
}

// Export singleton instance
export const stateManager = new StateManager();

// Export class for testing
export { StateManager };

