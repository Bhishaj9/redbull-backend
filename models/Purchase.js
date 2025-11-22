// models/Purchase.js
const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  userPhone: { type: String, required: false }, // optional if you use auth instead
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // optional: link to User if you have auth
  planId: { type: String, required: false },
  planName: { type: String, required: false },
  // price (keep for display) — in rupees (e.g., 499)
  price: { type: Number, required: false },

  // amount: store the amount actually sent to Razorpay in smallest currency unit (paise)
  amount: { type: Number, required: true }, // e.g., 49900 for ₹499

  // Razorpay fields
  razorpay_order_id: { type: String },
  paymentId: { type: String },              // your existing paymentId - will store razorpay_payment_id
  razorpay_signature: { type: String },

  // status controlled: created|pending|completed|failed
  status: { type: String, enum: ['created','pending','completed','failed'], default: 'created' },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Purchase', purchaseSchema);
