# Supabase Setup Guide for Budget Dashboard

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "Start your project" or "New Project"
3. Sign up or log in with GitHub
4. Create a new organization (if needed)
5. Create a new project:
   - **Name**: Budget Dashboard (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is sufficient

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Set Up Environment Variables

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PORT=3000
```

**Note**: For production, you'll need to set these as environment variables on your hosting platform.

## Step 4: Install Dependencies

```bash
npm install
```

This will install `@supabase/supabase-js` along with other dependencies.

## Step 5: Create Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `database-schema.sql`
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for all tables, policies, and triggers to be created

## Step 6: Verify Schema Creation

1. Go to **Table Editor** in Supabase dashboard
2. You should see these tables:
   - profiles
   - budgets
   - budget_members
   - budget_invites
   - categories
   - transactions
   - savings_goals
   - financial_goals
   - debts
   - recurring_transactions

## Step 7: Configure Authentication

1. Go to **Authentication** → **Settings** in Supabase dashboard
2. Enable **Email** provider (should be enabled by default)
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize confirmation and password reset emails if desired

## Step 8: Test the Setup

1. Start your server: `npm start`
2. Open `http://localhost:3000/auth.html`
3. Try creating an account
4. Check Supabase dashboard → **Authentication** → **Users** to see your new user
5. Check **Table Editor** → **profiles** to see your profile
6. Check **Table Editor** → **budgets** to see your personal budget

## Step 9: Update Supabase Config

Edit `supabase-config.js` and replace the placeholder values:

```javascript
const supabaseUrl = 'YOUR_ACTUAL_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_ACTUAL_ANON_KEY';
```

Or use environment variables (recommended for production).

## Step 10: Enable Realtime (for Shared Budgets)

1. Go to **Database** → **Replication** in Supabase dashboard
2. Enable replication for these tables:
   - transactions
   - categories
   - savings_goals
   - financial_goals
   - debts
   - recurring_transactions
   - budget_members

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env` file has correct values
- Make sure you're using the **anon/public** key, not the service_role key
- Restart your server after changing `.env`

### "Row Level Security" errors
- Make sure you ran the entire `database-schema.sql` file
- Check that RLS policies were created in **Authentication** → **Policies**

### "Table does not exist" errors
- Verify all tables were created in **Table Editor**
- Re-run the schema SQL if tables are missing

### Authentication not working
- Check **Authentication** → **Settings** → **URL Configuration**
- Add your localhost URL to allowed redirect URLs
- For production, add your production domain

## Next Steps

After setup is complete:
1. Test user registration and login
2. Test data migration from localStorage (if you have existing data)
3. Test creating a shared budget
4. Test real-time sync between multiple users

## Production Deployment

When deploying to production (Vercel, Netlify, etc.):

1. Set environment variables in your hosting platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `PLAID_CLIENT_ID`
   - `PLAID_SECRET`

2. Update Supabase **Authentication** → **Settings** → **URL Configuration**:
   - Add your production domain to Site URL
   - Add your production domain to Redirect URLs

3. Update CORS settings if needed (Supabase handles this automatically for most cases)

## Free Tier Limits

Supabase free tier includes:
- ✅ 50,000 monthly active users
- ✅ 500 MB database storage
- ✅ 2 GB bandwidth
- ✅ Unlimited API requests
- ✅ Real-time subscriptions

This is more than enough for personal/family budget tracking!

