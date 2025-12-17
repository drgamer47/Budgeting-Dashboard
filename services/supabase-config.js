// Supabase Configuration
// Get these values from your Supabase project settings:
// https://app.supabase.com/project/_/settings/api

import { logger } from '../js/logger.js';

// For browser: Load from CDN or use module import
let createClient;
let supabase;

// Try to load Supabase from CDN if module import fails
if (typeof window !== 'undefined' && window.supabase) {
  // Already loaded via CDN
  supabase = window.supabase;
} else {
  // Use environment variables or direct configuration
  // In production, these should come from environment variables
  // For now, users need to replace these values
  const supabaseUrl = window.SUPABASE_URL || 'YOUR_SUPABASE_URL';
  const supabaseAnonKey = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
  
  // Dynamic import for ES modules
  // Note: import() is always available in modules, but we check if we're in a module context
  try {
    import('@supabase/supabase-js').then(({ createClient: createClientFn }) => {
      createClient = createClientFn;
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });
      
      if (typeof window !== 'undefined') {
        window.supabase = supabase;
      }
    }).catch(err => {
      logger.warn('Supabase module not available. Please configure Supabase or use CDN.');
    });
  } catch (e) {
    // Not in a module context, skip dynamic import
    logger.warn('Dynamic import not available. Using CDN fallback.');
  }
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { supabase };
}

