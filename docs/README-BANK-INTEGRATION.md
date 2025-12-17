# Bank Integration Setup Guide

## Cheapest Option: Plaid (Free Development Tier)

Plaid offers **100 free live items** in development mode, perfect for personal use!

## Setup Steps

### 1. Get Free Plaid API Keys

1. Go to https://dashboard.plaid.com/signup
2. Sign up for a free account
3. Get your `CLIENT_ID` and `SECRET` from the dashboard
4. You'll be in "Sandbox" mode (free, unlimited testing)

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Environment Variables

Create a `.env` file (or set environment variables):

```
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_secret_here
PORT=3000
```

Or on Windows PowerShell:
```powershell
$env:PLAID_CLIENT_ID="your_client_id"
$env:PLAID_SECRET="your_secret"
```

### 4. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

### 5. Update Frontend

The dashboard will now have a "Connect Bank" button that uses Plaid Link to connect accounts.

## Pricing

- **Development/Sandbox**: FREE (unlimited testing)
- **Production**: ~$0.30-0.50 per account per month
- **Free Tier**: 100 live items (accounts) free

## How It Works

1. User clicks "Connect Bank" button
2. Plaid Link opens (secure bank login)
3. User connects their bank account
4. Backend fetches transactions via Plaid API
5. Transactions are imported into the dashboard

## Testing the Integration

When testing in **Sandbox mode**, follow these steps:

1. Click **"Connect Bank"** in your dashboard
2. In Plaid Link, **search for and select a test institution**:
   - Type "First Platypus Bank" or "Test Bank" in the search
   - Select any test institution from the results
3. Use these test credentials:
   - **Username:** `user_good`
   - **Password:** `pass_good`
4. Complete the connection flow

**Important:** You must select a test institution first! Don't try to connect to a real bank in sandbox mode.

**If you see "Additional action required" error:**
- Make sure you selected a **test institution** (like "First Platypus Bank")
- Verify you're using the exact credentials: `user_good` / `pass_good`
- Try selecting a different test institution if one doesn't work

## Security Notes

- Never commit `.env` file or API keys
- Plaid handles all bank authentication securely
- Access tokens are stored client-side (localStorage)
- Backend only acts as a proxy (doesn't store sensitive data)

## Alternative: TrueLayer (UK/EU Only - Free)

If you're in UK/EU/Australia, TrueLayer offers free Open Banking APIs:
- No per-transaction fees
- Free tier available
- Only works in specific regions

