/**
 * Constants and Configuration
 * All magic numbers, strings, and configuration values
 */

// Budget Types
export const BUDGET_TYPES = {
  PERSONAL: 'personal',
  SHARED: 'shared'
};

// Transaction Types
export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense'
};

// Recurring Frequencies
export const RECURRING_FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

// Selection Mode Types
export const SELECTION_MODES = {
  EDIT: 'edit',
  DELETE: 'delete'
};

// Sort Directions
export const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc'
};

// Long Press Configuration
export const LONG_PRESS_DURATION = 600; // milliseconds
export const LONG_PRESS_MOVE_THRESHOLD = 10; // pixels

// Inactivity Timeout (5 minutes)
export const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // milliseconds

// API Configuration
export const API_BASE_URL = 'http://localhost:3000/api';

// Default Categories
export const DEFAULT_CATEGORIES = [
  { id: "rent", name: "Rent", color: "#f87171", monthlyBudget: 1200 },
  { id: "groceries", name: "Groceries", color: "#4ade80", monthlyBudget: 300 },
  { id: "transport", name: "Transport", color: "#60a5fa", monthlyBudget: 150 },
  { id: "fun", name: "Fun", color: "#c084fc", monthlyBudget: 200 },
  { id: "bills", name: "Bills", color: "#facc15", monthlyBudget: 250 },
  { id: "other", name: "Other", color: "#94a3b8", monthlyBudget: 0 }
];

// LocalStorage Keys
export const STORAGE_KEYS = {
  STATE: 'budgetDashboardState_v2_profiles',
  SETTINGS: 'budgetDashboardSettings',
  THEME: 'budgetDashboardTheme',
  ACTIVE_TAB: 'budgetDashboardActiveTab',
  SUPABASE_AUTH_LOADED: 'supabase_auth_loaded'
};

// Default Settings
export const DEFAULT_SETTINGS = {
  budgetAlertsEnabled: true,
  budgetAlertThreshold: 80,
  currencySymbol: '$',
  dateFormat: 'YYYY-MM-DD'
};

// Date Formats
export const DATE_FORMATS = {
  YYYY_MM_DD: 'YYYY-MM-DD',
  MM_DD_YYYY: 'MM/DD/YYYY',
  DD_MM_YYYY: 'DD/MM/YYYY'
};

// Mobile Breakpoint
export const MOBILE_BREAKPOINT = 768; // pixels

// Resize Debounce Time
export const RESIZE_DEBOUNCE = 250; // milliseconds

// Chart Resize Debounce
export const CHART_RESIZE_DEBOUNCE = 300; // milliseconds

// Budget Warnings Delay
export const BUDGET_WARNINGS_DELAY = 1000; // milliseconds

// Default Profile
export const DEFAULT_PROFILE = {
  id: 'p_default',
  name: 'Default'
};

// Table Sort Defaults
export const DEFAULT_SORT_COLUMN = 'date';
export const DEFAULT_SORT_DIRECTION = 'desc';

// Chart Colors
export const CHART_COLORS = {
  SANKEY_NODE: 'rgba(96, 165, 250, 0.7)',
  SANKEY_LINK: 'rgba(96, 165, 250, 0.4)',
  CALENDAR_HEATMAP_GREEN_BASE: 250,
  CALENDAR_HEATMAP_GREEN_RANGE: 190
};

// API Server Port
export const API_SERVER_PORT = 3000;

// Toast Message Types
export const TOAST_TYPES = {
  ERROR: 'Error',
  SUCCESS: 'Success',
  WARNING: 'Warning',
  INFO: 'Info',
  PROCESSING: 'Processing',
  CONNECTION_ERROR: 'Connection Error',
  BANK_CONNECTED: 'Bank Connected'
};

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 2000, // milliseconds
  TOAST_DURATION: 8000 // milliseconds for long messages
};

// Transaction History
export const TRANSACTION_HISTORY_DAYS = 30; // Days to fetch from bank

// Bill Reminders
export const BILL_REMINDER_DAYS = 7; // Show bills within this many days
export const BILL_REMINDER_URGENT_DAYS = 3; // Mark as urgent within this many days

// Invite Code Configuration
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_EXPIRATION_DAYS = 7;

// Chart Configuration
export const CHART_CONFIG = {
  YEAR_RANGE: 5, // Years before/after current year for year selector
  MONTHS_TO_SHOW: 5, // Last N months (shows 6 total: 5 + current)
  PLOTLY_RESIZE_DELAY: 200, // milliseconds
  PLOTLY_RESIZE_DELAY_MOBILE: 100 // milliseconds
};

// CSV Import Configuration
export const CSV_CONFIG = {
  MIN_COLUMNS: 3 // Minimum columns required for valid CSV row
};

// Percentage Thresholds
export const PERCENTAGE_THRESHOLDS = {
  CATEGORY_SPENDING_CHANGE: 20, // % change to trigger insight
  TOTAL_SPENDING_CHANGE: 10, // % change to trigger insight
  BUDGET_WARNING: 90, // % of budget used to show warning
  BUDGET_EXCEEDED: 100 // % of budget used to show exceeded
};

