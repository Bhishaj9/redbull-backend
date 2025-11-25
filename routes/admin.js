// routes/admin.js
const express = require('express');
const Withdraw = require('../models/Withdraw');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const Plan = require('../models/Plan');

const router = express.Router();

// Very basic auth using env ADMIN_PHONE & ADMIN_PASS; in production use proper auth
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Unauthorized' });
  const token = parts[1];
  if (token !== `admin:${process.env.ADMIN_PASS}`) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

// Run Payouts
router.post('/payouts', adminAuth, async (req, res) => {
  try {
    const users = await User.find({});
    let totalPaid = 0;
    let usersCount = 0;

    for (const user of users) {
      let userPaid = 0;
      let modified = false;

      if (!user.plans || user.plans.length === 0) continue;

      const now = new Date();
      const todayStr = now.toDateString();

      user.plans = user.plans.map(p => {
        // Check if expired
        if (p.expiryDate && new Date(p.expiryDate) < now) return p;

        // Check if already paid today
        const lastPay = p.lastPayout ? new Date(p.lastPayout).toDateString() : '';
        if (lastPay === todayStr) return p;

        // Pay
        userPaid += (p.daily || 0);
        p.lastPayout = now;
        modified = true;
        return p;
      });

      if (modified && userPaid > 0) {
        user.wallet = (user.wallet || 0) + userPaid;
        // MarkModified is needed for mixed types or arrays of objects sometimes in Mongoose
        user.markModified('plans');
        await user.save();
        totalPaid += userPaid;
        usersCount++;
      }
    }

    res.json({ message: `Payouts run successfully. Paid ₹${totalPaid} to ${usersCount} users.` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error running payouts' });
  }
});

// Add Plan
router.post('/plans', adminAuth, async (req, res) => {
  try {
    const { name, price, daily, days, type, timerHours, diamond } = req.body;
    const newPlan = await Plan.create({
      id: 'p' + Date.now(),
      name,
      price,
      daily,
      days: days || 999, // default if timer
      type: type || 'buy',
      timerHours,
      diamond: !!diamond,
      image: 'assets/images/sa.jpg' // default image
    });
    res.json({ message: 'Plan created', plan: newPlan });
  } catch (e) {
    res.status(500).json({ message: 'Server error creating plan' });
  }
});

// list users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const list = await User.find().sort({ createdAt: -1 }).limit(200);
    res.json({ list });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// block user
router.post('/users/:id/block', adminAuth, async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    u.blocked = !u.blocked; // Toggle block status
    await u.save();
    res.json({ message: u.blocked ? 'User blocked' : 'User unblocked', blocked: u.blocked });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
  console.log('DELETE /users/:id called with id:', req.params.id);
  try {
    const result = await User.findByIdAndDelete(req.params.id);
    console.log('Delete result:', result ? 'User deleted' : 'User not found');
    res.json({ message: 'User deleted' });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// list withdraws
router.get('/withdraws', adminAuth, async (req, res) => {
  const list = await Withdraw.find().sort({ createdAt: -1 }).limit(200);
  res.json({ list });
});

// process withdraw
router.post('/withdraws/:id/process', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'accept' or 'decline'
  const w = await Withdraw.findById(id);
  if (!w) return res.status(404).json({ message: 'Not found' });

  if (w.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

  if (action === 'accept') {
    w.status = 'processed';
    w.processedAt = new Date();
    await w.save();
    // Funds were already deducted upon request creation, so no need to deduct here.
    return res.json({ message: 'Withdraw processed' });
  } else {
    w.status = 'cancelled';
    w.processedAt = new Date();
    await w.save();

    // Refund the user since the request was declined
    const u = await User.findOne({ phone: w.phone });
    if (u) {
      u.wallet = (u.wallet || 0) + w.amount;
      await u.save();
    }
    return res.json({ message: 'Withdraw cancelled and refunded' });
  }
});

// list purchases
router.get('/purchases', adminAuth, async (req, res) => {
  const list = await Purchase.find().sort({ createdAt: -1 }).limit(200);
  res.json({ list });
});

// list recharges
const Recharge = require('../models/Recharge');
router.get('/recharges', adminAuth, async (req, res) => {
  try {
    const list = await Recharge.find().sort({ createdAt: -1 }).limit(100);
    res.json({ list });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// process recharge
router.post('/recharges/:id/process', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'decline'

  try {
    const r = await Recharge.findById(id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (r.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

    if (action === 'approve') {
      r.status = 'approved';
      r.processedAt = new Date();
      await r.save();

      // Credit user wallet
      const u = await User.findById(r.userId);
      if (u) {
        u.wallet = (u.wallet || 0) + r.amount;
        await u.save();
      }
      return res.json({ message: 'Recharge approved and wallet credited' });
    } else {
      r.status = 'declined';
      r.processedAt = new Date();
      await r.save();
      return res.json({ message: 'Recharge declined' });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
