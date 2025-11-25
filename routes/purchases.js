// routes/purchases.js
const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Plan = require('../models/Plan');
const Purchase = require('../models/Purchase');
const Recharge = require('../models/Recharge');

const router = express.Router();

// Auth Middleware
function auth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

/**
 * POST /api/purchases/recharge-request
 * body: { amount, utr }
 * requires auth
 */
router.post('/recharge-request', auth, async (req, res) => {
  try {
    const { amount, utr } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    if (!utr) return res.status(400).json({ message: 'UTR / Transaction ID is required' });

    const user = await User.findOne({ phone: req.user.phone });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const recharge = await Recharge.create({
      userId: user._id,
      phone: user.phone,
      amount: Number(amount),
      utr: utr,
      status: 'pending'
    });

    res.json({ message: 'Recharge request submitted', recharge });
  } catch (err) {
    console.error("Recharge request error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/purchases/buy-plan
 * body: { planId }
 * requires auth
 * Wallet deduction logic
 */
router.post('/buy-plan', auth, async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'Plan ID required' });

    const user = await User.findOne({ phone: req.user.phone });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const plan = await Plan.findOne({ id: planId });
    if (!plan) return res.status(400).json({ message: 'Invalid plan' });

    if (user.wallet < plan.price) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Deduct wallet
    user.wallet -= plan.price;

    // Add plan
    const planRecord = {
      ...plan.toObject(),
      purchaseDate: new Date(),
      expiryDate: new Date(Date.now() + (plan.days * 24 * 60 * 60 * 1000)),
      purchaseId: "purch_" + Date.now()
    };
    user.plans.push(planRecord);

    // Record purchase
    const purchase = await Purchase.create({
      userPhone: user.phone,
      user: user._id,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      amount: plan.price * 100, // just for record keeping
      status: 'completed',
      paymentId: 'wallet_' + Date.now()
    });

    user.purchases = user.purchases || [];
    user.purchases.push({
      id: purchase.paymentId,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      type: 'plan',
      createdAt: new Date()
    });

    await user.save();

    res.json({ message: 'Plan purchased successfully', wallet: user.wallet });

  } catch (err) {
    console.error("Buy plan error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
