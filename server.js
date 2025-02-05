const express = require('express');
const stripe = require('stripe')('sk_test_your_stripe_key');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
let db;
async function connectDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  db = client.db('ecommerce');
  console.log('Connected to MongoDB');
}

// Products data
const products = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `Digital Product ${i + 1}`,
  price: (Math.random() * 50 + 9.99).toFixed(2)
}));

// Stripe Payment
app.post('/create-checkout-session', async (req, res) => {
  try {
    const product = products.find(p => p.id === req.body.productId);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:4242/success',
      cancel_url: 'http://localhost:4242/cancel',
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Payment Verification
app.post('/verify-manual-payment', async (req, res) => {
  try {
    const { transactionId, email, productId } = req.body;
    
    // Store in MongoDB
    await db.collection('transactions').insertOne({
      productId,
      transactionId,
      email,
      status: 'pending',
      timestamp: new Date()
    });

    // Simulate verification (5 seconds delay)
    setTimeout(async () => {
      await db.collection('transactions').updateOne(
        { transactionId },
        { $set: { status: 'verified' } }
      );
      sendDeliveryEmail(email, productId); // Email will be logged
    }, 5000);

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false });
  }
});

// Email Simulation (You'll see these in terminal)
function sendDeliveryEmail(email, productId) {
  const product = products.find(p => p.id === productId);
  console.log('\n=== EMAIL SENT ===');
  console.log(`To: ${email}`);
  console.log(`Subject: Your purchase of ${product.name} is ready!`);
  console.log(`Download link: http://localhost:4242/download/${productId}`);
  console.log('==================\n');
}

// Start Server
connectDB().then(() => {
  app.listen(4242, () => {
    console.log('Server running: http://localhost:4242');
    console.log('User emails will appear in:');
    console.log('1. Terminal (simulated emails)');
    console.log('2. MongoDB "transactions" collection');
  });
});