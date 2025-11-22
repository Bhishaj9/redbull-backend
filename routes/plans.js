// routes/plans.js
const express = require('express');
const Plan = require('../models/Plan');
const router = express.Router();

// get all plans
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find({});
    // if empty, optional: seed from config (we'll keep frontend plans static - but return the list)
    res.json({ plans });
  } catch(e){
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
