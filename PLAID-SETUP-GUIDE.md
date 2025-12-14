# Step-by-Step Guide: Getting Your Plaid Client ID and Secret

## Step 1: Sign Up for Plaid

1. Go to **https://dashboard.plaid.com/signup**
2. Click **"Sign up"** or **"Get started"**
3. Fill out the signup form:
   - Email address
   - Password
   - Company name (can be your name or "Budget Dashboard")
   - Select **"Business or developer"** → **"I want to build a product on Plaid's APIs"**
4. Verify your email address

## Step 2: Access the Dashboard

1. After signing up, you'll be redirected to the Plaid Dashboard
2. If you need to log in later, go to **https://dashboard.plaid.com/login**

## Step 3: Navigate to API Keys

1. In the Plaid Dashboard, look for:
   - **"Team Settings"** or **"Settings"** in the left sidebar, OR
   - **"Keys"** or **"API Keys"** in the navigation menu, OR
   - A **"Keys"** tab at the top of the dashboard

2. Click on **"Keys"** or **"API Keys"**

## Step 4: Find Your Credentials

You should see two important values:

1. **Client ID** (also called "Client ID" or "Plaid Client ID")
   - This is a long string of characters
   - Example format: `7T4YSXD5HVL3JMZLAADXC7RMZQ`

2. **Secret** (also called "Secret Key" or "Plaid Secret")
   - This is also a long string of characters
   - Example format: `secret-sandbox-abc123...`
   - **Important:** You may need to click a "Show" or "Reveal" button to see it

## Step 5: Check Your Environment

Make sure you're looking at the **Sandbox** environment (for testing):
- Look for a dropdown or toggle that says "Sandbox" vs "Development" vs "Production"
- For testing, use **Sandbox** (it's free and unlimited)
- Each environment has different keys, so make sure you're copying the right ones

## Step 6: Copy Your Credentials

1. **Copy the Client ID** - Click the copy icon or select and copy the text
2. **Copy the Secret** - Click the copy icon or select and copy the text
3. **Important:** Keep these secure! Never share them publicly.

## Step 7: Add to Your Project

### Option A: Create a `.env` file (Recommended)

1. In your project root folder (`C:\Users\Macray\Desktop\Budgeting`), create a new file called `.env`
2. Add these lines (replace with your actual values):

```
PLAID_CLIENT_ID=your_actual_client_id_here
PLAID_SECRET=your_actual_secret_here
PORT=3000
```

3. Save the file

### Option B: Set Environment Variables (Windows PowerShell)

Open PowerShell in your project folder and run:

```powershell
$env:PLAID_CLIENT_ID="your_actual_client_id_here"
$env:PLAID_SECRET="your_actual_secret_here"
```

**Note:** This only works for the current PowerShell session. You'll need to set them again if you close PowerShell.

## Step 8: Verify Setup

1. Make sure you've installed dependencies:
   ```bash
   npm install
   ```

2. Start your server:
   ```bash
   npm start
   ```

3. If the server starts without errors, your credentials are working!

## Troubleshooting

### Can't find the Keys section?
- Look for **"Settings"** → **"Team Settings"** → **"Keys"**
- Or check the top navigation bar for **"Keys"** or **"API Keys"**
- Some dashboards have it under **"Configuration"** or **"Credentials"**

### Secret is hidden?
- Look for a **"Show"** or **"Reveal"** button next to the secret
- You may need to click it to see the full secret key

### Wrong environment?
- Make sure you're in **Sandbox** mode for testing
- Each environment (Sandbox, Development, Production) has different keys
- The keys are environment-specific, so use the Sandbox keys for testing

### Server won't start?
- Check that your `.env` file is in the project root folder
- Verify the file is named exactly `.env` (not `.env.txt`)
- Make sure there are no extra spaces or quotes around the values
- Check that `dotenv` is installed: `npm install dotenv`

## Next Steps

Once you have your credentials set up:
1. Start the server: `npm start`
2. Open `DashBoard.html` in your browser
3. Click **"Connect Bank"**
4. Use test credentials: `user_good` / `pass_good`
5. Transactions should import automatically!

