# Quick Start Guide - Supabase Integration

## 🚀 Get Started in 5 Minutes

### Step 1: Create Supabase Project (2 min)
1. Go to https://supabase.com and sign up
2. Click "New Project"
3. Fill in:
   - **Name**: Budget Dashboard
   - **Database Password**: (save this!)
   - **Region**: Choose closest
4. Wait ~2 minutes for project to initialize

### Step 2: Get API Keys (1 min)
1. In Supabase dashboard → **Settings** → **API**
2. Copy **Project URL**
3. Copy **anon public** key

### Step 3: Create Database (1 min)
1. Go to **SQL Editor** in Supabase
2. Click **New Query**
3. Open `database-schema.sql` file
4. Copy entire contents and paste
5. Click **Run** (Ctrl+Enter)
6. Wait for "Success" message

### Step 4: Configure App (1 min)
1. Open `DashBoard.html`
2. Find the script section near the bottom
3. Replace these lines:
   ```javascript
   window.SUPABASE_URL = 'YOUR_SUPABASE_URL';
   window.SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
4. With your actual values:
   ```javascript
   window.SUPABASE_URL = 'https://xxxxx.supabase.co';
   window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
   ```

### Step 5: Test It! (1 min)
1. Run: `npm start`
2. Open: http://localhost:3000/auth.html
3. Create an account
4. Sign in
5. You should see your dashboard!

## ✅ What's Working

- ✅ User authentication (sign up, sign in, logout)
- ✅ Automatic personal budget creation
- ✅ Database schema with RLS policies
- ✅ Service layer for all operations
- ✅ Migration utility for existing data
- ✅ Budget selector UI
- ✅ Budget creation UI

## 🔄 What Needs Integration

The foundation is complete! To fully activate:

1. **Update transaction functions** in `script.js` to use Supabase
2. **Add real-time sync** for shared budgets
3. **Complete budget management** UI handlers
4. **Test with multiple users**

See `IMPLEMENTATION-GUIDE.md` for step-by-step integration.

## 🆘 Troubleshooting

**"Invalid API key"**
- Check you copied the **anon/public** key (not service_role)
- Make sure there are no extra spaces

**"Table does not exist"**
- Re-run `database-schema.sql` in SQL Editor
- Check Table Editor to verify tables exist

**"Authentication not working"**
- Check Supabase → Authentication → Settings
- Verify email provider is enabled

**"Can't import module"**
- The app uses CDN fallback, should work automatically
- Check browser console for errors

## 📚 Next Steps

1. Test authentication flow
2. Create a shared budget
3. Test data migration (if you have existing data)
4. See `IMPLEMENTATION-GUIDE.md` for full integration

## 💡 Tips

- **Free tier is generous**: 50K users, 500MB database
- **RLS is automatic**: All data is secured by default
- **Real-time is free**: Perfect for shared budgets
- **Migration is optional**: Existing users can continue with localStorage

Happy budgeting! 💰

