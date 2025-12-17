# Configuring Test Emails in Supabase

## Quick Fix for "Email not confirmed" Error

**To enable auto-signin for test emails, you MUST disable email confirmation:**

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Scroll to **Email Auth** section
3. **Disable "Confirm email"** toggle
4. Save changes

After this, test emails (`test@testmail.com`, `test2@testmail.com`) will auto-sign in after signup!

---

## Problem
Supabase blocks `@example.com` emails by default because they're considered invalid test domains.
Also, Supabase requires email confirmation by default, which prevents auto-signin.

## Solution Options

### Option 1: Use Alternative Test Emails (Easiest)
Use these test emails instead:
- `test@testmail.com`
- `test2@testmail.com`

These will work with the auto-signin feature for debugging.

### Option 2: Configure Supabase to Allow @example.com (Recommended for Development)

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll down to **Email Auth** section
4. Look for **Email Domain Restrictions** or **Allowed Email Domains**
5. Add `example.com` to the allowed domains list
6. Save changes

**Note:** This setting might not be available in all Supabase projects. If you don't see this option, use Option 1.

### Option 3: Disable Email Confirmation (For Development Only) ⭐ RECOMMENDED FOR TESTING

**This is the easiest solution for debugging!**

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Scroll down to **Email Auth** section
3. Find **"Confirm email"** toggle
4. **Disable** it (turn it off)
5. Save changes

This allows all users to sign in immediately after signup without email verification.

**Warning:** Only do this in development! Never disable email confirmation in production.

**After disabling:**
- Test emails will auto-sign in after signup
- No "Email not confirmed" errors
- Perfect for debugging and testing

### Option 4: Use Supabase Admin API (Advanced)

If you need to use `@example.com` emails, you can use the Supabase Admin API to create users programmatically, bypassing email validation. This requires server-side code.

## Current Implementation

The app is configured to auto-sign in these test emails:
- `test@testmail.com`
- `test2@testmail.com`

If you try to use `@example.com`, you'll see a helpful error message suggesting to use the alternative emails.

## Testing

After configuring, test by:
1. Signing up with `test@testmail.com`
2. You should be automatically signed in and redirected to the dashboard
3. No email verification required

