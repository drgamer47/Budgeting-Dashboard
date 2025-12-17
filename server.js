// Load environment variables FIRST (before anything else)
// Try .env.local first, then fallback to .env
const fs = require('fs');
const path = require('path');

// Check if .env.local exists, if so load it, otherwise load .env
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  console.log('📄 Loading environment variables from .env.local');
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('📄 Loading environment variables from .env');
} else {
  console.warn('⚠️  No .env.local or .env file found');
}

const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();

app.use(cors());
app.use(express.json());

// Serve specific routes BEFORE static files
// Serve the dashboard HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'DashBoard.html'));
});

// Serve dashboard HTML file (also accessible via direct path)
app.get('/DashBoard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'DashBoard.html'));
});

// Serve auth page
app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'auth.html'));
});

// Serve reset password page
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'reset-password.html'));
});

// Serve privacy policy page
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'privacy.html'));
});
app.get('/privacy.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'privacy.html'));
});

// Serve static files (CSS, JS, etc.) - AFTER specific routes
// Skip HTML files from static serving (they're handled by routes above)
const staticMiddleware = express.static(path.join(__dirname));
app.use((req, res, next) => {
  // Skip static file serving for HTML files
  if (req.path.endsWith('.html')) {
    return next();
  }
  staticMiddleware(req, res, next);
});

// Serve Supabase configuration (anon key is safe to expose)
app.get('/api/supabase-config', (req, res) => {
  try {
    // Check for both VITE_ prefixed (for Vite apps) and non-prefixed versions
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase config missing:');
      console.error('   SUPABASE_URL:', supabaseUrl ? 'Found' : 'NOT FOUND');
      console.error('   SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Found' : 'NOT FOUND');
      console.error('   All env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
      
      return res.status(500).json({ 
        error: 'Supabase credentials not configured. Check your .env.local file.',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseAnonKey,
          envFileExists: fs.existsSync(envLocalPath) || fs.existsSync(envPath)
        }
      });
    }
    
    res.json({
      url: supabaseUrl,
      anonKey: supabaseAnonKey
    });
  } catch (error) {
    console.error('Error in /api/supabase-config:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Plaid configuration (optional - only if credentials are provided)
// Get these from https://dashboard.plaid.com/signup (FREE for development)
let client = null;
const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;
const plaidEnv = (process.env.PLAID_ENV || 'sandbox').toLowerCase(); // sandbox | development | production

function resolvePlaidBasePath(envName) {
  switch (envName) {
    case 'production':
      return PlaidEnvironments.production;
    case 'development':
      return PlaidEnvironments.development;
    case 'sandbox':
    default:
      return PlaidEnvironments.sandbox;
  }
}

if (plaidClientId && plaidSecret && plaidClientId !== 'YOUR_CLIENT_ID' && plaidSecret !== 'YOUR_SECRET') {
  try {
    const configuration = new Configuration({
      basePath: resolvePlaidBasePath(plaidEnv),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': plaidClientId,
          'PLAID-SECRET': plaidSecret,
        },
      },
    });
    client = new PlaidApi(configuration);
    console.log(`✅ Plaid client initialized (${plaidEnv})`);
  } catch (error) {
    console.error('⚠️  Error initializing Plaid client:', error.message);
  }
} else {
  console.log('ℹ️  Plaid credentials not configured - bank connection feature disabled');
}

// Create Link token for frontend
app.post('/api/create_link_token', async (req, res) => {
  try {
    // Check if Plaid is configured
    if (!client) {
      return res.status(503).json({ 
        error: 'Bank connection is not available',
        message: 'Plaid credentials are not configured. To enable bank connections, add PLAID_CLIENT_ID and PLAID_SECRET to your .env.local file.',
        details: 'Get free Plaid credentials at https://dashboard.plaid.com/signup'
      });
    }

    const request = {
      user: {
        client_user_id: req.body.userId || 'user_' + Date.now(),
      },
      client_name: 'Budget Dashboard',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    };

    // Optional: Plaid Transactions can require time to prepare data. Providing a webhook lets Plaid notify us
    // when the product is ready (avoids PRODUCT_NOT_READY loops).
    if (process.env.PLAID_WEBHOOK_URL) {
      request.webhook = process.env.PLAID_WEBHOOK_URL;
    }

    // Optional: apply a Link customization (often required for production Data Transparency Messaging)
    // Create/enable this in Plaid Dashboard and set PLAID_LINK_CUSTOMIZATION in Render.
    if (process.env.PLAID_LINK_CUSTOMIZATION) {
      request.link_customization_name = process.env.PLAID_LINK_CUSTOMIZATION;
    }

    console.log('Creating link token with request:', { ...request, user: { client_user_id: request.user.client_user_id } });
    const response = await client.linkTokenCreate(request);
    console.log('Link token created successfully');
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'Unknown error'
    });
  }
});

// Plaid webhook receiver (minimal)
// Configure PLAID_WEBHOOK_URL to point here, e.g. https://<your-domain>/api/plaid/webhook
app.post('/api/plaid/webhook', (req, res) => {
  try {
    const body = req.body || {};
    console.log('Plaid webhook received:', {
      webhook_type: body.webhook_type,
      webhook_code: body.webhook_code,
      item_id: body.item_id,
      environment: body.environment,
      request_id: body.request_id
    });
  } catch (e) {
    console.error('Error handling Plaid webhook:', e);
  }
  res.status(200).json({ ok: true });
});

// Exchange public token for access token
app.post('/api/exchange_token', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ 
        error: 'Bank connection is not available',
        message: 'Plaid credentials are not configured.'
      });
    }
    
    const { public_token } = req.body;
    const response = await client.itemPublicTokenExchange({
      public_token: public_token,
    });

    res.json({
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions
app.post('/api/transactions', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ 
        error: 'Bank connection is not available',
        message: 'Plaid credentials are not configured.'
      });
    }
    
    console.log('Received transaction request:', {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      access_token: req.body?.access_token ? '***' : 'MISSING',
      start_date: req.body?.start_date,
      end_date: req.body?.end_date
    });
    
    const { access_token, start_date, end_date, account_ids } = req.body;

    if (!access_token) {
      console.error('Missing access_token in request body');
      return res.status(400).json({ 
        error: 'access_token is required',
        received: {
          hasBody: !!req.body,
          bodyKeys: req.body ? Object.keys(req.body) : []
        }
      });
    }

    // Validate and set dates
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || '2020-01-01';

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    console.log(`Fetching transactions from ${startDate} to ${endDate}`);

    // Plaid transactionsGet requires specific format
    const request = {
      access_token: access_token,
      start_date: startDate,
      end_date: endDate,
      options: {
        count: 500,
        offset: 0,
      },
    };

    // Optional account filter (lets us exclude savings accounts from transaction imports)
    if (Array.isArray(account_ids) && account_ids.length > 0) {
      request.options.account_ids = account_ids;
      console.log(`Filtering transactions to ${account_ids.length} account(s)`);
    }

    let response;
    try {
      response = await client.transactionsGet(request);
    } catch (plaidError) {
      console.error('Plaid API error:', plaidError);
      const errorDetails = plaidError.response?.data || plaidError.message;
      console.error('Plaid error details:', JSON.stringify(errorDetails, null, 2));
      
      // Return the actual Plaid error
      return res.status(plaidError.response?.status || 400).json({
        error: errorDetails?.error_message || errorDetails?.error_code || plaidError.message,
        details: errorDetails
      });
    }

    // Handle pagination if needed
    let allTransactions = response.data.transactions || [];
    let totalTransactions = response.data.total_transactions || 0;

    console.log(`Received ${allTransactions.length} of ${totalTransactions} total transactions`);

    // Fetch remaining transactions if there are more
    while (allTransactions.length < totalTransactions && allTransactions.length < 1000) {
      const paginatedRequest = {
        ...request,
        options: {
          count: 500,
          offset: allTransactions.length,
        },
      };
      if (request.options.account_ids) {
        paginatedRequest.options.account_ids = request.options.account_ids;
      }
      
      try {
        const paginatedResponse = await client.transactionsGet(paginatedRequest);
        const newTransactions = paginatedResponse.data.transactions || [];
        allTransactions = allTransactions.concat(newTransactions);
        console.log(`Fetched ${allTransactions.length} of ${totalTransactions} transactions`);
      } catch (paginatedError) {
        console.error('Error fetching paginated transactions:', paginatedError);
        break; // Stop pagination on error
      }
    }

    console.log(`Total transactions from Plaid: ${allTransactions.length}`);

    // Transform Plaid transactions to our format
    // Plaid Transactions: amounts are typically positive for money out (debits) and negative for money in (credits).
    const transactions = allTransactions.map(t => {
      const amt = Number(t.amount);
      // In practice, most spending is returned as positive amounts.
      const isExpense = amt > 0;
      return {
        id: `plaid_${t.transaction_id}`,
        date: t.date,
        description: t.name || t.merchant_name || 'Unknown',
        amount: Math.abs(amt),
        type: isExpense ? 'expense' : 'income',
        categoryId: 'other', // Default, user can recategorize
        note: t.category ? t.category.join(', ') : '',
        plaid_id: t.transaction_id,
        account_id: t.account_id,
      };
    });

    console.log(`Transformed ${transactions.length} transactions`);
    res.json({ transactions });
  } catch (error) {
    console.error('Unexpected error fetching transactions:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      details: error.stack
    });
  }
});

// Get accounts
app.post('/api/accounts', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ 
        error: 'Bank connection is not available',
        message: 'Plaid credentials are not configured.'
      });
    }
    
    const { access_token } = req.body;
    const response = await client.accountsGet({
      access_token: access_token,
    });

    res.json({ accounts: response.data.accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind to LAN for same-WiFi access
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`LAN access: http://<your-ipv4>:${PORT}/DashBoard.html`);
  
  // Verify Supabase credentials on startup
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️  WARNING: Supabase credentials not configured!');
    console.error('   Make sure your .env.local file contains:');
    console.error('   SUPABASE_URL=your_project_url (or VITE_SUPABASE_URL)');
    console.error('   SUPABASE_ANON_KEY=your_anon_key (or VITE_SUPABASE_ANON_KEY)');
  } else {
    console.log('✅ Supabase credentials loaded successfully');
    console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
    console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
  }
  
  // Verify Plaid credentials on startup
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  
  if (!clientId || !secret || clientId === 'YOUR_CLIENT_ID' || secret === 'YOUR_SECRET') {
    console.error('⚠️  WARNING: Plaid credentials not configured!');
    console.error('   Make sure your .env.local file contains:');
    console.error('   PLAID_CLIENT_ID=your_client_id');
    console.error('   PLAID_SECRET=your_secret');
  } else {
    console.log('✅ Plaid credentials loaded successfully');
    console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
  }
});

