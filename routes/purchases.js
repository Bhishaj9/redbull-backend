// routes/purchases.js
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Plan = require('../models/Plan');
const Purchase = require('../models/Purchase'); // path may be different in your project

const router = express.Router();

// TEMP DEBUG auth middleware — prints whether cookie/token is present and verification result
function auth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  console.log('SERVER LOG: auth middleware token present?', !!token);

  if (!token) {
    console.log('SERVER LOG: auth -> no token; request.headers:', JSON.stringify(req.headers, null, 2));
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    console.log('SERVER LOG: auth -> token valid for user=', data && (data.phone || data.id));
    next();
  } catch (e) {
    console.error('SERVER LOG: auth verify failed:', e && e.message);
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

const razor = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * POST /api/purchases/create-order
 * body: { planId }
 * requires auth
 * returns: { key, amount, orderId, purchaseId }
 */
router.post('/create-order', auth, async (req, res) => {
  // ===== DEBUG LOGS (added) =====
  console.log('--- create-order called ---');
  console.log('body:', req.body);
  console.log('cookies:', req.cookies);
  // ===== end debug logs =====

  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'planId required' });

    const plan = await Plan.findOne({ id: planId });
    if (!plan) return res.status(400).json({ message: 'Invalid plan' });

    // amount in paise
    const amountPaise = Math.round((plan.price || 0) * 100);

    // create razorpay order
    const order = await razor.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: "rb_" + Date.now(),
      payment_capture: 1
    });

    console.log("create-order OK -> order.id=", order && order.id, "amount(paise)=", amountPaise, "user=", req.user && (req.user.phone || req.user.id));
    console.log("full razorpay order object:", JSON.stringify(order, null, 2));

    // Persist Purchase document (status created)
    const purchaseDoc = await Purchase.create({
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency || 'INR',
      receipt: order.receipt || null,
      status: 'created',
      metadata: { planId },
      createdBy: req.user && (req.user.id || req.user.phone) || null
    });

    // Save pending order on User so we can map verify -> plan
    await User.findOneAndUpdate(
      { phone: req.user.phone }, // adjust selector if your JWT stores user id instead of phone
      {
        $push: {
          pendingOrders: {
            orderId: order.id,
            planId: planId,
            amount: amountPaise, // paise
            createdAt: new Date()
          }
        }
      },
      { new: true, upsert: false }
    );

    return res.json({
      key: process.env.RAZORPAY_KEY_ID,
      amount: amountPaise,
      orderId: order.id,
      purchaseId: purchaseDoc._id
    });

  } catch (err) {
    console.error("create-order error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/purchases/verify
 * body: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 * requires auth
 * returns: { verified: true, purchase }
 */
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment parameters' });
    }

    // compute expected signature
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.warn('verify: signature mismatch for order', razorpay_order_id);
      // mark purchase as failed_signature if purchase exists
      await Purchase.findOneAndUpdate({ orderId: razorpay_order_id }, { status: 'failed_signature' });
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Check if already paid to prevent double-crediting
    const existingPurchase = await Purchase.findOne({ orderId: razorpay_order_id });
    if (existingPurchase && existingPurchase.status === 'paid') {
      console.log('verify: order already paid', razorpay_order_id);
      return res.json({ verified: true, message: 'Already processed' });
    }

    // signature valid - update purchase record
    const purchase = await Purchase.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paidAt: new Date()
      },
      { new: true }
    );

    // find the user and the pending order entry
    const user = await User.findOne({ phone: req.user.phone });
    if (!user) {
      console.error('verify: user not found for', req.user && req.user.phone);
      return res.status(404).json({ message: 'User not found' });
    }

    const pending = (user.pendingOrders || []).find(po => po.orderId === razorpay_order_id);
    if (!pending) {
      console.warn('verify: pending order not found on user for orderId', razorpay_order_id);
      // still OK: we already updated Purchase, return verified true but warn
    }

    // Determine plan details
    const planId = pending ? pending.planId : (purchase && purchase.metadata && purchase.metadata.planId);
    const plan = planId ? await Plan.findOne({ id: planId }) : null;
    const price = pending ? (pending.amount || 0) / 100 : (purchase ? (purchase.amount || 0) / 100 : 0);

    // Build the purchase record to push into user's purchases array
    const purchaseRecord = {
      id: "purch_" + Date.now() + "_" + Math.floor(Math.random() * 900 + 100),
      planId: planId || null,
      planName: plan ? plan.name : (planId || 'unknown'),
      price,
      razorpay: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature
      },
      createdAt: new Date()
    };

    // Update user: remove pendingOrders entry and push to purchases
    await User.findOneAndUpdate(
      { phone: req.user.phone },
      {
        $pull: { pendingOrders: { orderId: razorpay_order_id } },
        $push: { purchases: purchaseRecord }
      }
    );

    // If we also created/updated Purchase model above, attach userRef or userId if needed
    if (purchase) {
      await Purchase.findByIdAndUpdate(purchase._id, { userRef: user._id, purchaseRecordSnapshot: purchaseRecord });
    }

    // Credit plan to user
    if (plan) {
      const planRecord = {
        ...plan.toObject(),
        purchaseDate: new Date(),
        expiryDate: new Date(Date.now() + (plan.days * 24 * 60 * 60 * 1000)),
        purchaseId: purchase._id
      };

      await User.findByIdAndUpdate(user._id, {
        $push: { plans: planRecord }
      });
      console.log(`Plan ${plan.name} credited to user ${user.phone}`);
    } else {
      console.warn('Plan not found for crediting, planId:', planId);
    }

    return res.json({ verified: true, purchase: purchaseRecord, purchaseDoc: purchase || null });

  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
