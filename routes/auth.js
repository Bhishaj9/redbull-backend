// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

/**
 * Cookie options helper
 * - Use COOKIE_DOMAIN only when explicitly provided (recommended for prod)
 * - For local development do NOT set domain (browser expects exact host)
 * - secure = true only in production (HTTPS)
 */
function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: Boolean(isProd),                  // true in production (HTTPS), false on localhost
    sameSite: isProd ? 'None' : 'Lax',        // 'None' in prod if using cross-site cookies, Lax for local dev
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  // Only attach domain if COOKIE_DOMAIN env var is set (useful for production).
  // Do NOT set domain to '127.0.0.1' for local dev, it breaks cookies when accessing via 'localhost'.
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  return cookieOptions;
}

/******************
 * REGISTER ROUTE
 ******************/
router.post('/register', [
  body('phone').isLength({ min: 6 }),
  body('pass').isLength({ min: 6 })
], async (req, res) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(400).json({ errors: err.array() });

  const { phone, pass, invite } = req.body;

  try {
    let existing = await User.findOne({ phone });
    if (existing) return res.status(400).json({ message: 'User exists' });

    const hashedPass = await bcrypt.hash(pass, 10);

    const user = new User({
      phone,
      pass: hashedPass,
      withdrawPass: '',
      wallet: 50,
      inviteCode: invite || Math.random().toString(36).slice(2, 9)
    });

    if (invite) {
      const ref = await User.findOne({ inviteCode: invite });
      if (ref) {
        ref.wallet = (ref.wallet || 0) + (0.25 * user.wallet);
        ref.team = ref.team || [];
        ref.team.push(user.phone);
        await ref.save();
      }
    }

    await user.save();

    const token = jwt.sign(
      { phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions());
    console.log('register -> cookie set for user=', user.phone);

    return res.json({
      message: 'Registered',
      user: { phone: user.phone, wallet: user.wallet },
      token // optional; cookie is the important part
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

/******************
 * LOGIN ROUTE
 ******************/
router.post('/login', [
  body('phone').exists(),
  body('pass').exists()
], async (req, res) => {
  try {
    const { phone, pass } = req.body;

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(pass, user.pass);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie using helper (no domain for local dev unless COOKIE_DOMAIN is set)
    res.cookie('token', token, getCookieOptions());
    console.log('login -> cookie set for user=', user.phone);

    return res.json({
      message: 'Logged in',
      user: { phone: user.phone, wallet: user.wallet },
      token // optional; cookie is what client should use
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

/******************
 * LOGOUT ROUTE
 ******************/
router.post('/logout', (req, res) => {
  // Clearing cookie using same path and domain rules (only include domain if COOKIE_DOMAIN set)
  const opts = { path: '/' };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie('token', opts);
  return res.json({ message: 'Logged out' });
});

/******************
 * ME ROUTE
 ******************/
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.json({ user: null });

    const data = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ phone: data.phone }, '-pass');

    return res.json({ user });
  } catch (e) {
    console.error('me route error:', e && e.message);
    return res.json({ user: null });
  }
});

/******************
 * TEAM ROUTE
 ******************/
router.get('/team', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const data = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ phone: data.phone });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Fetch details for direct referrals (Level 1)
    // user.team contains phone numbers
    const level1Users = await User.find({ phone: { $in: user.team } }, 'phone createdAt');

    const level1Members = level1Users.map(u => ({
      id: u.phone, // masking or showing full phone? let's show full for now as per mock
      joined: u.createdAt
    }));

    // Current schema only supports 1 level easily.
    // Level 2/3 would require recursive lookups which we'll skip for now to keep it simple/fast.

    const teamData = {
      level1: { size: level1Members.length, members: level1Members },
      level2: { size: 0, members: [] },
      level3: { size: 0, members: [] }
    };

    return res.json({ team: teamData, inviteCode: user.inviteCode });
  } catch (e) {
    console.error('team route error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
