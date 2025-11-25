// models/Recharge.js
const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    phone: { type: String, required: true },
    amount: { type: Number, required: true },
    utr: { type: String, required: true }, // Transaction ID / Reference Number
    method: { type: String, default: 'upi' },
    status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    note: { type: String }
});

module.exports = mongoose.model('Recharge', rechargeSchema);
