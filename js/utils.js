/**
 * Utility Functions
 * Common helper functions used throughout the application
 */

import { DEFAULT_SETTINGS, DATE_FORMATS, MOBILE_BREAKPOINT } from './constants.js';
import { logger } from './logger.js';

// Get settings from localStorage or use defaults
function getSettings() {
  try {
    const saved = localStorage.getItem('budgetDashboardSettings');
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    logger.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Format a number as currency
 * @param {number} n - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatMoney(n) {
  const settings = getSettings();
  const symbol = settings?.currencySymbol || '$';
  return symbol + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a date string according to user's preferred format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Parse YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr; // Return as-is if not in expected format
  
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  const settings = getSettings();
  const format = settings?.dateFormat || DATE_FORMATS.YYYY_MM_DD;
  
  switch (format) {
    case DATE_FORMATS.MM_DD_YYYY:
      return `${month}/${day}/${year}`;
    case DATE_FORMATS.DD_MM_YYYY:
      return `${day}/${month}/${year}`;
    case DATE_FORMATS.YYYY_MM_DD:
    default:
      return dateStr;
  }
}

/**
 * Get current month in ISO format (YYYY-MM)
 * @param {Date} dateObj - Date object (defaults to current date)
 * @returns {string} Month in YYYY-MM format
 */
export function currentMonthISO(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Validate UUID string
 * @param {string} str - String to validate
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} title - Optional title
 */
export function showToast(message, title = "") {
  const box = document.getElementById("toastContainer");
  if (!box) {
    logger.warn('Toast container not found');
    return;
  }
  
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = (title ? title + ": " : "") + message;
  box.appendChild(el);
  setTimeout(() => {
    el.style.opacity = 0;
    setTimeout(() => {
      if (box.contains(el)) {
        box.removeChild(el);
      }
    }, 500);
  }, 3000);
}

/**
 * Check if device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobileDevice() {
  return window.innerWidth <= MOBILE_BREAKPOINT || 
         'ontouchstart' in window || 
         navigator.maxTouchPoints > 0 ||
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Trigger haptic feedback if available
 */
export function triggerHapticFeedback() {
  // Try to trigger haptic feedback if available
  if (navigator.vibrate) {
    navigator.vibrate(50); // Short vibration
  }
  
  // iOS haptic feedback (if available)
  if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS 13+ requires permission, but we can try
    try {
      if (window.TapticEngine) {
        window.TapticEngine.impact({ style: 'medium' });
      }
    } catch (e) {
      // Ignore if not available
    }
  }
}

/**
 * Debounce function - delays execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

