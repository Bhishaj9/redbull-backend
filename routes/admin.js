// routes/admin.js
const express = require('express');
const Withdraw = require('../models/Withdraw');
const Purchase = require('../models/Purchase');
const User = require('../models/User');

const router = express.Router();

// Very basic auth using env ADMIN_PHONE & ADMIN_PASS; in production use proper auth
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Unauthorized' });
  const token = parts[1]; // token = admin:<password> base64 or whatever simple scheme
  // For simplicity we accept "admin:password" base64: but here we just check header equals admin-basic string
  // Better approach: use JWT or separate admin user
  if (token !== `admin:${process.env.ADMIN_PASS}`) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

// list users
router.get('/users', adminAuth, async (req, res) => {
  const list = await User.find().sort({ createdAt: -1 }).limit(200);
  res.json({ list });
});

// list withdraws
router.get('/withdraws', adminAuth, async (req, res) => {
  const list = await Withdraw.find().sort({ createdAt: -1 }).limit(200);
  res.json({ list });
});

// process withdraw
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

// view purchases
router.get('/purchases', adminAuth, async (req, res) => {
  const list = await Purchase.find().sort({ createdAt: -1 }).limit(200);
  res.json({ list });
});

module.exports = router;
