const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const app = express();
const path = require('path');

app.use(cors());
app.use(express.json());

// Serve static files (CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// Serve the dashboard HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'DashBoard.html'));
});

// Plaid configuration
// Get these from https://dashboard.plaid.com/signup (FREE for development)
// Load environment variables from .env file
require('dotenv').config();

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Use 'sandbox' for free development
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || 'YOUR_CLIENT_ID',
      'PLAID-SECRET': process.env.PLAID_SECRET || 'YOUR_SECRET',
    },
  },
});

const client = new PlaidApi(configuration);

// Create Link token for frontend
app.post('/api/create_link_token', async (req, res) => {
  try {
    // Verify credentials are loaded
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    
    if (!clientId || !secret || clientId === 'YOUR_CLIENT_ID' || secret === 'YOUR_SECRET') {
      console.error('Plaid credentials not configured properly');
      return res.status(500).json({ 
        error: 'Plaid credentials not configured. Check your .env file.' 
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

// Exchange public token for access token
app.post('/api/exchange_token', async (req, res) => {
  try {
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
    const { access_token, start_date, end_date } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
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
    // Plaid: negative amounts = debits (expenses), positive = credits (income)
    const transactions = allTransactions.map(t => {
      // Plaid returns negative amounts for expenses (debits) and positive for income (credits)
      const isExpense = t.amount < 0;
      return {
        id: `plaid_${t.transaction_id}`,
        date: t.date,
        description: t.name || t.merchant_name || 'Unknown',
        amount: Math.abs(t.amount),
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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Verify credentials on startup
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  
  if (!clientId || !secret || clientId === 'YOUR_CLIENT_ID' || secret === 'YOUR_SECRET') {
    console.error('⚠️  WARNING: Plaid credentials not configured!');
    console.error('   Make sure your .env file contains:');
    console.error('   PLAID_CLIENT_ID=your_client_id');
    console.error('   PLAID_SECRET=your_secret');
  } else {
    console.log('✅ Plaid credentials loaded successfully');
    console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
  }
});

