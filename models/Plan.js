// models/Plan.js
const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  id: String,
  name: String,
  price: Number,
  daily: Number,
  days: Number,
  image: String,
  type: String,
  timerHours: Number,
  diamond: Boolean
});

module.exports = mongoose.model('Plan', planSchema);
