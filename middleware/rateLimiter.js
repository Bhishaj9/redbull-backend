// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 80, // limit each IP
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = limiter;
