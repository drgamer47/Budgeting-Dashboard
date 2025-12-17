# Project Structure

This document describes the organized folder structure of the Budget Dashboard application.

## 📁 Directory Structure

```
Budgeting/
├── pages/              # HTML pages
│   ├── DashBoard.html
│   ├── auth.html
│   └── reset-password.html
│
├── js/                 # Frontend JavaScript modules
│   ├── app.js          # Main application entry point
│   ├── constants.js    # Configuration constants
│   ├── logger.js       # Logging utility
│   ├── utils.js        # Utility functions
│   ├── state-management.js  # State manager
│   ├── transactions.js      # Transaction management
│   ├── categories.js         # Category management
│   ├── goals.js              # Goals management
│   ├── debts.js              # Debt tracking
│   ├── recurring.js          # Recurring transactions
│   ├── ui-renderers.js       # DOM rendering
│   └── ui-handlers.js        # Event handlers
│
├── styles/             # CSS stylesheets
│   └── styles.css
│
├── services/           # Backend service modules
│   ├── supabase-integration.js
│   ├── supabase-browser.js
│   ├── supabase-service.js
│   ├── supabase-config.js
│   └── migration-utility.js
│
├── sql/                # SQL scripts
│   ├── database-schema.sql
│   ├── [various fix scripts]
│   └── README.md
│
├── docs/               # Documentation
│   ├── TESTING.md
│   ├── REFACTORING-GUIDE.md
│   ├── SETUP-SUPABASE.md
│   └── [other .md files]
│
├── config/             # Configuration files
│   └── SECURE-CREDENTIALS.txt
│
├── data/               # Test data and sample files
│   └── test-transactions.csv
│
├── backup/             # Backup files
│   └── script.js.legacy.backup
│
├── server.js           # Express server (main entry point)
├── package.json        # Node.js dependencies
└── package-lock.json   # Locked dependency versions
```

## 📝 File Paths Reference

### HTML Pages
- Dashboard: `pages/DashBoard.html`
- Authentication: `pages/auth.html`
- Password Reset: `pages/reset-password.html`

### JavaScript Modules
- Main App: `js/app.js`
- Feature Modules: `js/[feature].js`
- UI Modules: `js/ui-[module].js`

### Services
- Supabase Integration: `services/supabase-integration.js`
- Supabase Browser: `services/supabase-browser.js`
- Supabase Service: `services/supabase-service.js`
- Migration Utility: `services/migration-utility.js`

### Static Assets
- Styles: `styles/styles.css`
- Test Data: `data/test-transactions.csv`

### Documentation
- All `.md` files are in `docs/`
- SQL scripts documentation: `sql/README.md`

## 🔗 Import Paths

### From HTML to JS
```html
<script type="module" src="js/app.js"></script>
```

### From JS Modules
```javascript
// Import from same directory
import { stateManager } from './state-management.js';

// Import from services
import * as supabaseIntegration from '../services/supabase-integration.js';

// Import from constants/utils
import { formatMoney } from './utils.js';
import { DEFAULT_CATEGORIES } from './constants.js';
```

### Server Routes
The `server.js` file serves:
- `/` → `pages/DashBoard.html`
- `/auth.html` → `pages/auth.html`
- `/reset-password` → `pages/reset-password.html`
- Static files from root (for backward compatibility)

## 📦 Organization Principles

1. **Separation of Concerns**: Each folder has a specific purpose
2. **Modularity**: Related files are grouped together
3. **Maintainability**: Easy to find and modify files
4. **Scalability**: Structure supports future growth
5. **Clarity**: Clear naming conventions

## 🔄 Migration Notes

- HTML files moved from root to `pages/`
- CSS moved from root to `styles/`
- Service files moved from root to `services/`
- Documentation moved from root to `docs/`
- SQL scripts already in `sql/` folder
- `server.js` updated to serve from new paths

