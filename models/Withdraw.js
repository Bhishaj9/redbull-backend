// models/Withdraw.js
const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  phone: String,
  amount: Number,
  status: { type: String, default: 'pending' }, // pending | processed | cancelled
  createdAt: { type: Date, default: Date.now },
  processedAt: Date,
  note: String
});

module.exports = mongoose.model('Withdraw', withdrawSchema);
