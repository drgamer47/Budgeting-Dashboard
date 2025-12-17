# Budget Dashboard - Supabase Integration

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

1. Create account at https://supabase.com
2. Create a new project
3. Go to **SQL Editor** and run `database-schema.sql`
4. Go to **Settings** → **API** and copy:
   - Project URL
   - anon/public key

### 3. Configure Environment

Create `.env` file:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
PLAID_CLIENT_ID=your_plaid_id
PLAID_SECRET=your_plaid_secret
PORT=3000
```

### 4. Update Config

Edit `supabase-config.js` with your Supabase URL and key, or use environment variables.

### 5. Start Server
```bash
npm start
```

### 6. Access App
- **Login/Signup**: http://localhost:3000/auth.html
- **Dashboard**: http://localhost:3000/DashBoard.html

## Features Implemented

✅ **Authentication System**
- Sign up with email/password
- Sign in
- Password reset
- Session management
- Automatic profile creation

✅ **Database Schema**
- Complete PostgreSQL schema
- Row Level Security (RLS) policies
- Automatic triggers
- Indexes for performance

✅ **Service Layer**
- All CRUD operations for:
  - Budgets (personal & shared)
  - Transactions
  - Categories
  - Goals (savings & financial)
  - Debts
  - Recurring transactions
  - Budget members
  - Invites

✅ **UI Components**
- Budget selector dropdown
- Create budget modal
- Join budget modal
- Manage budgets page
- Budget settings (for shared budgets)
- Logout button

✅ **Migration Utility**
- Detects existing localStorage data
- Prompts user to migrate
- Batch imports all data
- Preserves relationships

## Next Steps for Full Integration

The foundation is complete. To fully integrate:

1. **Update `script.js` data operations** to use Supabase services instead of localStorage
2. **Add real-time subscriptions** for shared budgets
3. **Implement user attribution** on transactions
4. **Add budget management UI** handlers
5. **Test end-to-end** with multiple users

See `IMPLEMENTATION-GUIDE.md` for detailed integration steps.

## File Overview

- `supabase-config.js` - Supabase client setup
- `supabase-service.js` - All database operations
- `supabase-integration.js` - Auth & budget management
- `migration-utility.js` - localStorage → Supabase migration
- `database-schema.sql` - Complete database schema
- `auth.html` - Login/signup page
- `SETUP-SUPABASE.md` - Detailed setup instructions
- `IMPLEMENTATION-GUIDE.md` - Integration guide

## Architecture

```
User → auth.html → Supabase Auth
                ↓
         DashBoard.html
                ↓
    supabase-integration.js (auth check)
                ↓
    supabase-service.js (data operations)
                ↓
         Supabase Database
```

## Security

- ✅ Row Level Security (RLS) on all tables
- ✅ Users can only access their own data
- ✅ Shared budget access controlled by membership
- ✅ Invite codes with expiration
- ✅ Secure password handling via Supabase Auth

## Cost

**Free tier includes:**
- 50,000 monthly active users
- 500 MB database
- 2 GB bandwidth
- Unlimited API requests
- Real-time subscriptions

Perfect for personal/family use! 🎉

