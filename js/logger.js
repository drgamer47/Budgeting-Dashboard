/**
 * Logging Utility
 * Replaces console filtering with proper logging levels
 */

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// Suppress list for known harmless errors
const SUPPRESSED_PATTERNS = [
  'betterstackdata.com',
  'ERR_BLOCKED_BY_ADBLOCKER',
  'sentry.javascript',
  'sentry_version',
  'A listener indicated an asynchronous response'
];

// Check if error should be suppressed
function shouldSuppress(message) {
  if (typeof message !== 'string') {
    message = String(message);
  }
  return SUPPRESSED_PATTERNS.some(pattern => message.includes(pattern));
}

// Logger class
class Logger {
  constructor() {
    this.enabled = true;
    this.suppressHarmlessErrors = true; // Can be disabled via environment variable
  }

  error(...args) {
    if (!this.enabled) return;
    
    const message = args.join(' ');
    if (this.suppressHarmlessErrors && shouldSuppress(message)) {
      return; // Suppress harmless errors
    }
    
    console.error(...args);
  }

  warn(...args) {
    if (!this.enabled) return;
    
    const message = args.join(' ');
    if (this.suppressHarmlessErrors && shouldSuppress(message)) {
      return; // Suppress harmless warnings
    }
    
    console.warn(...args);
  }

  info(...args) {
    if (!this.enabled) return;
    console.info(...args);
  }

  debug(...args) {
    if (!this.enabled) return;
    console.debug(...args);
  }

  log(...args) {
    if (!this.enabled) return;
    console.log(...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };

