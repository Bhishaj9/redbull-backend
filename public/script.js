// script.js - merged and cleaned (Redbull)
// Authentication + users stored in localStorage + plans + dashboard items
// Merged versions: kept all features, removed duplicates, preserved behavior.

const STORAGE = {
  USERS: "lp_users_v1",
  SESSION: "lp_session_v1",
  DASHBOARD: "lp_dashboard_items_v1"
};

// Auto-detect API base:
// - If frontend is served from a different port than the backend (common when using Live Server),
//   point to backend at http://localhost:4000 so API calls reach the Express server.
// - Otherwise keep relative API_BASE so same-origin works when serving frontend from backend.
const API_BASE = (function () {
  try {
    const host = location.hostname;
    const port = location.port || "";
    // If you're serving frontend from Live Server (example port 5500/5501), default to backend on 4000
    if ((host === "127.0.0.1" || host === "localhost") && port && port !== "4000") {
      return "http://localhost:4000";
    }
  } catch (e) {}
  return ""; // relative by default
})();

// Ensure admin credentials exist (username & password)
try {
  if (!localStorage.getItem('adminCreds')) {
    localStorage.setItem('adminCreds', JSON.stringify({ user: 'admin', pass: 'Redbull@123' }));
  }
} catch (e) {
  // ignore in case localStorage blocked
}

/* ---------- Withdraw requests storage ---------- */
const WITHDRAW_KEY = "lp_withdraw_requests_v1";
function readWithdrawRequests() { return JSON.parse(localStorage.getItem(WITHDRAW_KEY) || "[]"); }
function writeWithdrawRequests(list) { localStorage.setItem(WITHDRAW_KEY, JSON.stringify(list)); }

/* ---------- Persistent plan timers storage ---------- */
const PLAN_TIMERS_KEY = "lp_plan_timers_v1"; // stores deadlines for plan-specific timers
function readPlanTimers() { return JSON.parse(localStorage.getItem(PLAN_TIMERS_KEY) || "{}"); }
function writePlanTimers(obj) { localStorage.setItem(PLAN_TIMERS_KEY, JSON.stringify(obj)); }

/* ---------- Basic localStorage helpers ---------- */
function readUsers() { return JSON.parse(localStorage.getItem(STORAGE.USERS) || "[]"); }
function writeUsers(u) { localStorage.setItem(STORAGE.USERS, JSON.stringify(u)); }

function setSession(phone) { localStorage.setItem(STORAGE.SESSION, JSON.stringify({ phone })); }
function clearSession() { localStorage.removeItem(STORAGE.SESSION) }
function getSession() { return JSON.parse(localStorage.getItem(STORAGE.SESSION) || "null"); }

function findUser(phone) { return readUsers().find(u => u.phone === phone); }

/* ---------- ADMIN SYNC HELPERS ---------- */
function recordPurchaseToAdmin(userId, planId, price) {
  const purchases = JSON.parse(localStorage.getItem('purchases') || '[]');
  purchases.push({
    id: "p-" + Date.now() + "-" + Math.floor(Math.random() * 900 + 100),
    userId: userId,
    planId: planId,
    price: Number(price),
    createdAt: new Date().toISOString(),
    status: 'pending'
  });
  localStorage.setItem('purchases', JSON.stringify(purchases));
  try { localStorage.setItem('adminNewPurchase', Date.now().toString()); } catch (e) { }
}

function mirrorWithdrawToAdmin(localReq) {
  const adminWithdrawals = JSON.parse(localStorage.getItem('withdrawals') || '[]');
  if (!adminWithdrawals.find(w => w.id === localReq.id)) {
    adminWithdrawals.unshift({
      id: localReq.id,
      userId: localReq.phone,
      amount: Number(localReq.amount),
      createdAt: new Date(localReq.createdAt).toISOString(),
      status: 'requested'
    });
    localStorage.setItem('withdrawals', JSON.stringify(adminWithdrawals));
    try { localStorage.setItem('adminNewWithdraw', Date.now().toString()); } catch (e) { }
  }
}

/* ---------- NETWORK HELPERS (minimal, safe) ---------- */
async function tryRegisterBackend({ phone, pass, invite }) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, pass, invite })
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function tryLoginBackend({ phone, pass }) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, pass })
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Legacy backend call kept (used as best-effort fallback)
async function tryBuyBackend({ planId, price }) {
  try {
    const res = await fetch(`${API_BASE}/api/purchases/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planId, price })
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/* ---------- NEW: create-order + verify for Razorpay (Step 9) ---------- */
async function tryCreateOrder({ planId, price }) {
  try {
    const res = await fetch(`${API_BASE}/api/purchases/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planId, price })
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function tryVerifyPayment(razorpayResponse) {
  try {
    const res = await fetch(`${API_BASE}/api/purchases/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(razorpayResponse)
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err };
  }
}

/* ---------- USER REGISTER / LOGIN ---------- */
document.addEventListener("click", (e) => {

  if (e.target && e.target.id === "registerBtn") {
    const phoneEl = document.getElementById("regPhone");
    const passEl = document.getElementById("regPass");
    const pass2El = document.getElementById("regPass2");
    const withdrawEl = document.getElementById("regWithdraw");
    const inviteEl = document.getElementById("regInvite");

    const phone = phoneEl ? phoneEl.value.trim() : "";
    const pass = passEl ? passEl.value : "";
    const pass2 = pass2El ? pass2El.value : "";
    const withdraw = withdrawEl ? withdrawEl.value : "";
    const invite = inviteEl ? (inviteEl.value.trim() || "f6c05036") : "f6c05036";

    if (!phone || !pass) { return alert("Enter phone and password"); }
    if (pass !== pass2) { return alert("Passwords do not match"); }
    if (findUser(phone)) { return alert("User already exists"); }

    // Try backend register first. If backend works, use it. Otherwise fallback to localStorage method.
    (async () => {
      const backend = await tryRegisterBackend({ phone, pass, invite });
      if (backend && backend.ok) {
        try {
          setSession(phone);
        } catch (e) { }
        alert("Registered via backend. Redirecting to Home.");
        window.location.href = "home.html";
        return;
      } else {
        try {
          const users = readUsers();
          const newUser = {
            phone,
            pass,
            withdrawPass: withdraw,
            wallet: 0,
            plans: [],
            team: [],
            inviteCode: invite
          };
          users.push(newUser);
          writeUsers(users);
          setSession(phone);
          alert("Registered (local fallback). Redirecting to Home.");
          window.location.href = "home.html";
        } catch (err) {
          console.error("Register fallback failed", err);
          alert("Registration failed.");
        }
      }
    })();
  }

  if (e.target && e.target.id === "loginBtn") {
    const phoneEl = document.getElementById("loginPhone");
    const passEl = document.getElementById("loginPass");
    const phone = phoneEl ? phoneEl.value.trim() : "";
    const pass = passEl ? passEl.value : "";

    if (!phone || !pass) return alert("Enter phone and password");

    // Try backend login first. If backend works, redirect. Otherwise fallback to local check.
    (async () => {
      const backend = await tryLoginBackend({ phone, pass });
      if (backend && backend.ok) {
        try { setSession(phone); } catch (e) { }
        alert("Login successful (backend). Redirecting...");
        window.location.href = "home.html";
        return;
      } else {
        const user = findUser(phone);
        if (!user || user.pass !== pass) return alert("Invalid credentials");
        setSession(phone);
        window.location.href = "home.html";
      }
    })();
  }
});

/* ---------- Header, wallet, profile updates ---------- */
function pageInit() {
  const session = getSession();
  const phone = session ? session.phone : null;
  const user = phone ? findUser(phone) : null;

  document.querySelectorAll("[id^=walletDisplay]").forEach(el => {
    el.textContent = "Wallet: ₹" + (user ? Number((user.wallet || 0).toFixed(2)) : "0");
  });

  const profilePhone = document.getElementById("profilePhone");
  if (profilePhone) {
    if (user) {
      profilePhone.textContent = "Phone: " + user.phone;
      const balEl = document.getElementById("profileBalance");
      if (balEl) balEl.textContent = "Balance: ₹" + Number((user.wallet || 0).toFixed(2));
    } else {
      profilePhone.textContent = "Not logged in";
      const balEl = document.getElementById("profileBalance");
      if (balEl) balEl.textContent = "";
    }
  }

  const inviteInput = document.getElementById("inviteLink");
  if (inviteInput) {
    const code = user ? (user.inviteCode || "f6c05036") : "f6c05036";
    try {
      inviteInput.value = location.origin + "/?invite=" + code;
    } catch (e) {
      inviteInput.value = "/?invite=" + code;
    }
  }

  const teamList = document.getElementById("teamList");
  if (teamList) {
    if (!user) teamList.textContent = "Login to see your team.";
    else teamList.innerHTML = user.team && user.team.length ? user.team.map(t => `<div>${t}</div>`).join("") : "You have no referrals.";
  }
}

/* ---------- Buy plan helper (records admin purchase) ---------- */
function performLocalPurchase(userObj, price, name = "Redbull Plan", daily = 120, days = 180) {
  const users = readUsers();
  const uIndex = users.findIndex(x => x.phone === userObj.phone);
  if (uIndex === -1) return alert("User not found");

  let u = users[uIndex];
  u.wallet = Number(((u.wallet || 0) - Number(price)).toFixed(2));
  if (u.wallet < 0) u.wallet = 0;

  const now = Date.now();
  u.plans = u.plans || [];
  u.plans.push({
    name,
    price,
    daily,
    days,
    start: now,
    lastCredited: now,
    totalCredited: 0
  });

  users[uIndex] = u;
  writeUsers(users);

  try {
    recordPurchaseToAdmin(u.phone, name, price);
  } catch (e) { }

  (async () => {
    try {
      const cfg = PLANS_CONFIG.find(p => p.name === name || p.id === name);
      const planId = cfg ? (cfg.id || cfg.name) : (name || "client-purchase");
      const backend = await tryBuyBackend({ planId, price });
      if (backend && backend.ok) {
        console.log("Backend purchase recorded:", backend.data);
      } else {
        console.warn("Backend purchase failed or unavailable", backend);
      }
    } catch (en) { console.warn("Purchase backend request error", en); }
  })();

  alert(`${name} purchased for ₹${price}.`);
  try { pageInit(); } catch (e) { }
}

// ----- REPLACED: buyPlanByPrice (drop-in) -----
// This function calls /api/purchases/create-order then opens Razorpay, then calls /api/purchases/verify.
// Falls back to performLocalPurchase if backend/popup fails.
function buyPlanByPrice(price, name = "Redbull Plan", daily = 120, days = 180) {
  const session = getSession();
  if (!session) return alert("Please login first");

  const users = readUsers();
  const u = users.find(x => x.phone === session.phone);
  if (!u) return alert("User not found");

  if ((u.wallet || 0) < price) return alert("Insufficient balance. Please recharge.");

  (async () => {
    try {
      // find planId from your PLANS_CONFIG if possible, otherwise fallback to name
      const cfg = PLANS_CONFIG.find(p => p.name === name || p.price === price || p.id === name);
      const planId = cfg ? (cfg.id || cfg.name) : ("client-purchase");

      // Call backend to create Razorpay order
      const orderResp = await tryCreateOrder({ planId, price });

      // If backend returned a successful response with required fields
      if (orderResp && orderResp.ok && orderResp.data) {
        const { key, orderId, amount } = orderResp.data;

        // Safety check - backend may respond differently; fall back if missing required fields
        if (!key || !orderId || !amount) {
          console.warn("create-order missing fields, falling back to local purchase", orderResp);
          performLocalPurchase(u, price, name, daily, days);
          return;
        }

        // Build Razorpay options
        const options = {
          key,                 // server-provided key id (test or prod)
          amount,              // amount in paise from server
          order_id: orderId,   // razorpay order id
          name: "Redbull",
          description: name,
          handler: async function (razorpayResponse) {
            // razorpayResponse contains razorpay_payment_id, razorpay_order_id, razorpay_signature
            const verify = await tryVerifyPayment(razorpayResponse);
            if (verify && verify.ok && verify.data && (verify.data.verified === true || verify.data.verified === undefined && verify.data.success)) {
              // Verified by backend: proceed with your local purchase flow / UI update
              performLocalPurchase(u, price, name, daily, days);
              console.log("Payment verified and purchase completed:", verify.data);
            } else if (verify && verify.ok && verify.data && (verify.data.verified === false || verify.data.success === false)) {
              console.error("Payment verification failed (backend returned failure):", verify);
              alert("Payment verification failed. If money was deducted, contact admin.");
            } else {
              // Backend did not respond or returned non-ok; show warning and fallback
              console.error("Payment verification unavailable or failed:", verify);
              alert("Payment processed but verification failed. If money was deducted, contact admin.");
            }
          },
          modal: {
            ondismiss: function () { console.log('Payment popup closed'); }
          }
        };

        // Open Razorpay popup
        try {
          const rzp = new Razorpay(options);
          rzp.open();
        } catch (err) {
          console.error("Razorpay open failed", err);
          alert("Payment popup failed to open. Falling back to local purchase.");
          performLocalPurchase(u, price, name, daily, days);
        }
        return;
      } else {
        console.warn("create-order failed or backend unavailable", orderResp);
        // Backend not available — fallback to local purchase so user's action still completes
        performLocalPurchase(u, price, name, daily, days);
        return;
      }
    } catch (e) {
      console.error("Error in purchase flow, falling back to local", e);
      performLocalPurchase(u, price, name, daily, days);
    }
  })();
}

/* ---------- Plans data ---------- */
const PLANS_CONFIG = [
  { id: "p1", name: "Plan 1", price: 520, daily: 120, days: 47, image: "assets/images/sa.jpg", type: "buy" },
  { id: "p2", name: "Plan 2", price: 960, daily: 210, days: 85, image: "assets/images/re.jpg", type: "buy" },
  { id: "p3", name: "Plan 3", price: 1860, daily: 420, days: 120, image: "assets/images/ga.jpg", type: "buy" },
  { id: "p4", name: "Plan 4", price: 4980, daily: 1458, days: 160, image: "assets/images/ma.jpg", type: "timer", timerHours: 90 },
  { id: "p5", name: "Plan 5", price: 13670, daily: 4560, days: 95, image: "assets/images/sa.jpg", type: "timer", timerHours: 115 },
  { id: "p6", name: "Plan 6", price: 28660, daily: 10615, days: 140, image: "assets/images/re.jpg", type: "timer", timerHours: 135 },
  { id: "p7", name: "Plan 7", price: 47800, daily: 19920, days: 130, image: "assets/images/ga.jpg", type: "buy" },
  { id: "p8", name: "Diamond Plan", price: 97000, daily: 38333, days: 110, image: "assets/images/ma.jpg", type: "timer", timerHours: 50, diamond: true }
];

/* ---------- Plans population ---------- */
function populatePlansList() {
  const plansList = document.getElementById("plansList");
  if (!plansList) return;
  plansList.innerHTML = ''; // clear

  const timers = readPlanTimers();

  PLANS_CONFIG.forEach((p) => {
    const card = document.createElement("article");
    card.className = "plan-card";
    card.setAttribute("data-plan-id", p.id);

    const header = document.createElement("div");
    header.className = "plan-header";
    header.innerHTML = `<h3 class="plan-heading">${p.name}${p.diamond ? ' <span title="Diamond">💎</span>' : ''}</h3>`;
    card.appendChild(header);

    const imgWrap = document.createElement("div");
    imgWrap.className = "plan-image-wrap";
    const img = document.createElement("img");
    img.className = "plan-image";
    img.alt = p.name + " image";
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = p.image;
    img.onerror = function () { this.onerror = null; this.src = 'assets/images/sa.jpg'; };
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

    const info = document.createElement("div");
    info.className = "plan-info";

    const totalProfit = p.daily * p.days;
    const diamondMark = p.diamond ? ' <span title="Diamond">💎</span>' : '';

    info.innerHTML = `
      <div class="plan-grid">
        <div class="price-box"><div class="price-value">₹ ${p.price}${diamondMark}</div><div class="price-label">Price</div></div>
        <div class="price-box"><div class="price-value">₹ ${p.daily}</div><div class="price-label">Daily profit</div></div>
        <div class="price-box"><div class="price-value">${p.days}</div><div class="price-label">Days</div></div>
        <div class="price-box"><div class="price-value">₹ ${totalProfit}</div><div class="price-label">Total profit</div></div>
      </div>
    `;

    card.appendChild(info);

    const buyRow = document.createElement("div");
    buyRow.className = "plan-buy-row";

    const actionContainer = document.createElement("div");
    actionContainer.style.width = "100%";

    if (p.type === "buy") {
      const btn = document.createElement("button");
      btn.className = "plan-buy";
      btn.textContent = "🛒 Buy now";
      btn.addEventListener("click", () => buyPlanByPrice(p.price, p.name, p.daily, p.days));
      actionContainer.appendChild(btn);
    } else if (p.type === "timer") {
      let deadline = timers[p.id];
      if (!deadline) {
        deadline = Date.now() + (p.timerHours || 24) * 3600000;
        const newTimers = readPlanTimers();
        newTimers[p.id] = deadline;
        writePlanTimers(newTimers);
      }

      const countdownEl = document.createElement("div");
      countdownEl.className = "plan-timer";
      countdownEl.style.display = 'flex';
      countdownEl.style.justifyContent = 'center';
      countdownEl.style.alignItems = 'center';
      countdownEl.style.gap = '10px';
      countdownEl.style.padding = '8px 0';

      const label = document.createElement("div");
      label.className = "plan-timer-label";
      label.style.fontWeight = '700';
      label.style.color = 'var(--accent)';
      label.textContent = 'Unlocks in:';

      const timeText = document.createElement("div");
      timeText.className = "plan-timer-time";
      timeText.style.fontSize = '16px';
      timeText.style.fontWeight = '700';
      timeText.textContent = '';

      countdownEl.appendChild(label);
      countdownEl.appendChild(timeText);
      actionContainer.appendChild(countdownEl);

      startCountdown(p.id, deadline, countdownEl, () => {
        actionContainer.innerHTML = "";
        const buyBtn = document.createElement("button");
        buyBtn.className = "plan-buy";
        buyBtn.textContent = "🛒 Buy now";
        buyBtn.addEventListener("click", () => buyPlanByPrice(p.price, p.name, p.daily, p.days));
        actionContainer.appendChild(buyBtn);

        const t = readPlanTimers();
        delete t[p.id];
        writePlanTimers(t);
      });
    }

    buyRow.appendChild(actionContainer);
    card.appendChild(buyRow);

    plansList.appendChild(card);
  });
}

/* ---------- Countdown utilities ---------- */
const ACTIVE_COUNTDOWNS = {};
function startCountdown(planId, deadline, containerEl, onFinish) {
  if (ACTIVE_COUNTDOWNS[planId]) clearInterval(ACTIVE_COUNTDOWNS[planId]);

  function tick() {
    const now = Date.now();
    let diff = deadline - now;
    if (diff <= 0) {
      if (ACTIVE_COUNTDOWNS[planId]) clearInterval(ACTIVE_COUNTDOWNS[planId]);
      delete ACTIVE_COUNTDOWNS[planId];
      if (typeof onFinish === "function") onFinish();
      return;
    }
    const hrs = Math.floor(diff / 3600000);
    diff -= hrs * 3600000;
    const mins = Math.floor(diff / 60000);
    diff -= mins * 60000;
    const secs = Math.floor(diff / 1000);

    const hh = String(hrs).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');

    const timeEl = containerEl.querySelector('.plan-timer-time');
    if (timeEl) timeEl.textContent = `${hh}:${mm}:${ss}`;
  }

  tick();
  ACTIVE_COUNTDOWNS[planId] = setInterval(tick, 1000);
}

/* ---------- Recharge & Withdraw logic ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const rechargeBtn = document.getElementById("rechargeBtn");
  if (rechargeBtn) {
    rechargeBtn.addEventListener("click", () => {
      const amount = parseFloat(document.getElementById("rechargeAmount").value || 0);
      if (!amount || amount <= 0) return alert("Enter valid amount");
      const session = getSession(); if (!session) return alert("Login first");
      const users = readUsers(); const u = users.find(x => x.phone === session.phone);
      u.wallet = Number(((u.wallet || 0) + amount).toFixed(2));
      writeUsers(users);
      alert("Recharge successful. ₹" + amount + " added to wallet.");
      pageInit();
    });
  }

  const withdrawBtn = document.getElementById("withdrawBtn");
  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", () => {
      const amount = parseFloat(document.getElementById("withdrawAmount").value || 0);
      const pass = document.getElementById("withdrawPass").value || "";
      const session = getSession(); if (!session) return alert("Login first");

      const users = readUsers();
      const u = users.find(x => x.phone === session.phone);
      if (!u) return alert("User not found");
      if (!pass || pass !== (u.withdrawPass || "")) return alert("Invalid withdrawal password");
      if (amount <= 0 || amount > (u.wallet || 0)) return alert("Invalid amount");

      const reqs = readWithdrawRequests();
      const id = "wr-" + Date.now() + "-" + Math.floor(Math.random() * 900 + 100);
      const req = {
        id,
        phone: u.phone,
        amount,
        status: "pending",
        createdAt: Date.now(),
        processedAt: null,
        processedBy: null,
        note: ""
      };
      reqs.unshift(req);
      writeWithdrawRequests(reqs);
      try { mirrorWithdrawToAdmin(req); } catch (e) { }
      alert("Withdrawal request placed for ₹" + amount + ". It will be processed by admin.");
      const waEl = document.getElementById("withdrawAmount");
      const wpEl = document.getElementById("withdrawPass");
      if (waEl) waEl.value = "";
      if (wpEl) wpEl.value = "";
      pageInit();
    });
  }

  const logout = document.getElementById("logoutBtn");
  if (logout) {
    logout.addEventListener("click", () => {
      clearSession();
      alert("Logged out");
      window.location.href = "index.html";
    });
  }

  const copyInvite = document.getElementById("copyInvite");
  if (copyInvite) {
    copyInvite.addEventListener("click", () => {
      const el = document.getElementById("inviteLink");
      if (!el) return;
      try {
        if (el.select) { el.select(); document.execCommand('copy'); }
        else if (navigator.clipboard) { navigator.clipboard.writeText(el.value); }
      } catch (e) { }
      alert("Invite link copied");
    });
  }

  pageInit();
  populatePlansList();
  setupDashboardScroll && setupDashboardScroll();
  setupAddItem && setupAddItem();

  const timers = readPlanTimers();
  const cards = document.querySelectorAll('.plan-card[data-plan-id]');
  cards.forEach(card => {
    const pid = card.getAttribute('data-plan-id');
    if (!pid) return;
    const countdownEl = card.querySelector('.plan-timer');
    if (countdownEl && timers[pid]) {
      startCountdown(pid, timers[pid], countdownEl, () => {
        const action = card.querySelector('.plan-buy-row > div');
        if (action) {
          action.innerHTML = '';
          const cfg = PLANS_CONFIG.find(x => x.id === pid);
          const buyBtn = document.createElement('button');
          buyBtn.className = 'plan-buy';
          buyBtn.textContent = '🛒 Buy now';
          if (cfg) buyBtn.addEventListener('click', () => buyPlanByPrice(cfg.price, cfg.name, cfg.daily, cfg.days));
          action.appendChild(buyBtn);
        }
        const t = readPlanTimers(); delete t[pid]; writePlanTimers(t);
      });
    }
  });

  autoCreditPlanEarnings();

  syncAdminWithdrawResponses();
  setInterval(syncAdminWithdrawResponses, 15000);
});

/* ---------- Dashboard items (infinite scroll + add item) ---------- */
const defaultDashboardItems = (() => {
  const arr = [];
  const baseImgs = ['assets/images/sa.jpg', 'assets/images/re.jpg', 'assets/images/ga.jpg', 'assets/images/ma.jpg'];
  for (let i = 1; i <= 16; i++) {
    arr.push({
      id: "item-" + i,
      title: "Featured Plan " + i,
      desc: "Quick plan description for plan " + i,
      price: 480 + (i - 1) * 10,
      image: baseImgs[i % baseImgs.length] || 'assets/images/sa.jpg'
    });
  }
  return arr;
})();

function readDashboard() { return JSON.parse(localStorage.getItem(STORAGE.DASHBOARD) || "null") || defaultDashboardItems; }
function writeDashboard(list) { localStorage.setItem(STORAGE.DASHBOARD, JSON.stringify(list)); }

const DASH_PAGE_SIZE = 6;
let dashIndex = 0;

function renderDashItem(item) {
  const el = document.createElement("div");
  el.className = "dash-item";

  const img = document.createElement("img");
  img.className = "dash-thumb";
  img.alt = item.title;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = item.image || 'assets/images/sa.jpg';
  img.onerror = function () { this.onerror = null; this.src = 'assets/images/sa.jpg'; };

  const body = document.createElement("div");
  body.className = "dash-body";
  body.innerHTML = `
    <div class="dash-title">${item.title}</div>
    <div class="dash-desc">${item.desc}</div>
    <div class="dash-meta"><div class="dash-price">₹ ${item.price}</div></div>
  `;

  el.appendChild(img);
  el.appendChild(body);
  return el;
}

function loadMoreDashboardItems() {
  const listEl = document.getElementById("dashboardList");
  const loading = document.getElementById("loadingIndicator");
  const allItems = readDashboard();
  if (!listEl || dashIndex >= allItems.length) return;

  if (loading) loading.hidden = false;
  setTimeout(() => {
    const slice = allItems.slice(dashIndex, dashIndex + DASH_PAGE_SIZE);
    slice.forEach(item => listEl.appendChild(renderDashItem(item)));
    dashIndex += slice.length;
    if (loading) loading.hidden = true;
  }, 300);
}

function setupDashboardScroll() {
  const listEl = document.getElementById("dashboardList");
  if (!listEl) return;
  listEl.innerHTML = "";
  dashIndex = 0;
  loadMoreDashboardItems();

  listEl.addEventListener('scroll', () => {
    const thresholdPx = 160;
    if (listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < thresholdPx) {
      loadMoreDashboardItems();
    }
  });
}

/* Add new item from form to top of list & storage */
function setupAddItem() {
  const addBtn = document.getElementById("addItemBtn");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => {
    const title = document.getElementById("newItemTitle").value.trim();
    const price = parseFloat(document.getElementById("newItemPrice").value || 0);
    const image = document.getElementById("newItemImage").value.trim() || "assets/images/sa.jpg";

    if (!title) return alert("Enter title");
    if (!price || price <= 0) return alert("Enter valid price");

    const items = readDashboard();
    const newItem = {
      id: "item-" + Date.now(),
      title,
      desc: "User added item",
      price,
      image
    };
    items.unshift(newItem);
    writeDashboard(items);

    const listEl = document.getElementById("dashboardList");
    if (listEl) {
      listEl.innerHTML = "";
      dashIndex = 0;
      loadMoreDashboardItems();
      setTimeout(() => { listEl.scrollTop = 0; }, 80);
    }

    document.getElementById("newItemTitle").value = "";
    document.getElementById("newItemPrice").value = "";
    document.getElementById("newItemImage").value = "";

    alert("Item added to dashboard.");
  });
}

/* ---------- Minimal implementations for referenced helpers ---------- */

// Auto-credit plan earnings periodically for logged-in users (simple safe implementation)
function autoCreditPlanEarnings() {
  try {
    const users = readUsers();
    const nowTs = Date.now();
    let changed = false;

    users.forEach(u => {
      if (!u.plans || !u.plans.length) return;
      u.plans.forEach(plan => {
        const last = plan.lastCredited || plan.start || nowTs;
        const daysPassed = Math.floor((nowTs - last) / (24 * 3600 * 1000));
        if (daysPassed > 0 && plan.totalCredited < plan.daily * plan.days) {
          const creditAmount = plan.daily * Math.min(daysPassed, Math.max(0, plan.days - (plan.totalCredited / plan.daily || 0)));
          plan.totalCredited = (plan.totalCredited || 0) + creditAmount;
          plan.lastCredited = nowTs;
          // add to user wallet
          u.wallet = (Number(u.wallet) || 0) + Number(creditAmount);
          changed = true;
        }
      });
    });

    if (changed) {
      writeUsers(users);
      pageInit();
    }
  } catch (e) {
    console.warn("autoCreditPlanEarnings error", e);
  }
}

// Sync admin withdraw responses from admin localStorage to user withdraw requests (polling)
function syncAdminWithdrawResponses() {
  try {
    const adminWithdraws = JSON.parse(localStorage.getItem('withdrawals') || '[]');
    const localReqs = readWithdrawRequests();
    let changed = false;
    adminWithdraws.forEach(a => {
      const local = localReqs.find(l => l.id === a.id || l.phone === a.userId && l.amount === a.amount);
      if (local && local.status !== a.status) {
        local.status = a.status === 'accepted' ? 'processed' : (a.status === 'declined' ? 'declined' : local.status);
        local.processedAt = a.processedAt || Date.now();
        changed = true;
      }
    });
    if (changed) writeWithdrawRequests(localReqs);
  } catch (e) {
    // ignore sync errors
  }
}

/* ---------- End of script.js core ---------- */

/* Export or attach to window if needed */
window.BUY_FLOW = {
  buyPlanByPrice,
  performLocalPurchase,
  populatePlansList,
  pageInit
};
