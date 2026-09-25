// Payment Routes - Stripe Integration
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_...');
const admin = require('firebase-admin');

// Create payment intent
router.post('/create-payment-intent', async (req, res) => {
  const { amount, diamonds, packageType, userId, userEmail, currency = 'USD' } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: {
        userId,
        packageType,
        diamonds
      },
      receipt_email: userEmail
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Webhook for payment success
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { userId, diamonds } = paymentIntent.metadata;

      // Update user diamonds
      await admin.firestore().collection('users').doc(userId).update({
        diamonds: admin.firestore.FieldValue.increment(parseInt(diamonds))
      });

      // Record transaction
      await admin.firestore().collection('transactions').add({
        userId,
        type: 'diamond_purchase',
        amount: paymentIntent.amount / 100,
        diamonds: parseInt(diamonds),
        paymentIntentId: paymentIntent.id,
        status: 'completed',
        timestamp: new Date(),
        currency: paymentIntent.currency
      });
    }

    res.json({received: true});
  } catch (error) {
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

module.exports = router;
