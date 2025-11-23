// routes/withdraws.js
const express = require('express');
const auth = require('../middleware/auth');
const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const router = express.Router();

router.post('/request', auth(true), async (req, res) => {
  const { amount, withdrawPass } = req.body;
  const user = await User.findOne({ phone: req.user.phone });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!withdrawPass || withdrawPass !== (user.withdrawPass || '')) return res.status(400).json({ message: 'Invalid withdrawal password' });
  if (amount < 130) return res.status(400).json({ message: 'Minimum withdrawal is ₹130' });
  if (amount > user.wallet) return res.status(400).json({ message: 'Insufficient funds' });

  // We create a withdraw request, admin will process later
  const w = new Withdraw({ phone: user.phone, amount, status: 'pending' });
  await w.save();

  // Deduct from wallet immediately to prevent double-spending
  user.wallet -= amount;
  await user.save();

  res.json({ message: 'Withdraw request created', id: w._id });
});

router.get('/my', auth(true), async (req, res) => {
  const withdraws = await Withdraw.find({ phone: req.user.phone }).sort({ createdAt: -1 });
  res.json({ withdraws });
});

module.exports = router;
