// server.js
const path = require('path');
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');
const limiter = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth');
const planRoutes = require('./routes/plans');
const purchaseRoutes = require('./routes/purchases');
const withdrawRoutes = require('./routes/withdraws');
const adminRoutes = require('./routes/admin');

const Plan = require('./models/Plan');

const app = express();
const PORT = process.env.PORT || 4000;

// --------------------------------------------------
// PARSERS
// --------------------------------------------------
app.use(express.json());
app.use(cookieParser());
app.use(limiter);

// --------------------------------------------------
// CORS — allow credentials for cookie
// --------------------------------------------------
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // allow all origins in development
  },
  credentials: true
}));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// --------------------------------------------------
// SERVE FRONTEND (THE STEP YOU REQUESTED)
// --------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------------------------------------------
// CONNECT DATABASE
// --------------------------------------------------
connectDB(process.env.MONGO_URI).catch(err => {
  console.error('DB connect failed', err);
  process.exit(1);
});

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/withdraws', withdrawRoutes);
app.use('/api/admin', adminRoutes);

// --------------------------------------------------
// HEALTH
// --------------------------------------------------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --------------------------------------------------
// SEED PLANS
// --------------------------------------------------
async function seedPlans() {
  const count = await Plan.countDocuments();
  if (count === 0) {
    const plans = [
      { id: "p1", name: "Plan 1", price: 520, daily: 120, days: 47, image: "assets/images/sa.jpg", type: "buy" },
      { id: "p2", name: "Plan 2", price: 960, daily: 210, days: 85, image: "assets/images/re.jpg", type: "buy" },
      { id: "p3", name: "Plan 3", price: 1860, daily: 420, days: 120, image: "assets/images/ga.jpg", type: "buy" },
      { id: "p4", name: "Plan 4", price: 4980, daily: 1458, days: 160, image: "assets/images/ma.jpg", type: "timer", timerHours: 90 },
      { id: "p5", name: "Plan 5", price: 13670, daily: 4560, days: 95, image: "assets/images/sa.jpg", type: "timer", timerHours: 115 },
      { id: "p6", name: "Plan 6", price: 28660, daily: 10615, days: 140, image: "assets/images/re.jpg", type: "timer", timerHours: 135 },
      { id: "p7", name: "Plan 7", price: 47800, daily: 19920, days: 130, image: "assets/images/ga.jpg", type: "buy" },
      { id: "p8", name: "Diamond Plan", price: 97000, daily: 38333, days: 110, image: "assets/images/ma.jpg", type: "timer", timerHours: 50, diamond: true }
    ];

    await Plan.insertMany(plans);
    console.log('Plans seeded');
  }
}
seedPlans();

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});