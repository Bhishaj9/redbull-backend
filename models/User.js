// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  pass: { type: String, required: true },
  withdrawPass: { type: String, default: '' },
  wallet: { type: Number, default: 0 },
  plans: { type: Array, default: [] },
  team: { type: [String], default: [] }, // phone numbers of referees
  inviteCode: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
