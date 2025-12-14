# Plaid Sandbox Testing Tips

## Common Error: "Additional action required"

If you see this error when trying to connect a bank in sandbox mode, here's how to fix it:

### The Problem
This error appears when:
1. You're trying to connect to a real bank (not a test institution)
2. You're using incorrect test credentials
3. The test institution requires specific credentials

### The Solution

**Step 1: Select a Test Institution**
- When Plaid Link opens, **DO NOT** search for your real bank
- Instead, search for test institutions like:
  - "First Platypus Bank"
  - "Test Bank"
  - "Chase" (sandbox version)
  - "Bank of America" (sandbox version)
- Select any test institution from the results

**Step 2: Use Test Credentials**
- **Username:** `user_good`
- **Password:** `pass_good`
- These work with most test institutions in sandbox mode

**Step 3: Alternative Test Credentials**
If `user_good` / `pass_good` doesn't work, try:
- **Username:** `user_good`
- **Password:** `pass_good`
- Or check Plaid's documentation for institution-specific credentials

## Other Common Issues

### "Invalid credentials"
- Make sure you're in **Sandbox** mode (not Development or Production)
- Verify your API keys are for the Sandbox environment
- Check that your server is running and can reach Plaid's API

### Connection times out
- Check your internet connection
- Verify the server is running on `http://localhost:3000`
- Check browser console for CORS errors

### No transactions imported
- This is normal for some test institutions
- Try connecting to "First Platypus Bank" which has test transactions
- You can also manually add transactions via CSV import

## Recommended Test Institutions

For best results in sandbox mode, try these test institutions:
1. **First Platypus Bank** - Usually has test transactions
2. **Test Bank** - Generic test institution
3. **Chase (Sandbox)** - If available

## Need Help?

- Check Plaid's sandbox documentation: https://plaid.com/docs/sandbox/
- Verify your API keys are correct in the `.env` file
- Make sure your server is running: `npm start`
- Check the browser console (F12) for error messages



