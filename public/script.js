// script.js - Backend Integrated (Redbull)
// Authentication via Cookies + API calls

const API_BASE = (function () {
  try {
    const host = location.hostname;
    const port = location.port || "";
    // If serving from Live Server (5500/5501), point to backend on 4000
    if ((host === "127.0.0.1" || host === "localhost") && port && port !== "4000") {
      return "http://localhost:4000";
    }
  } catch (e) { }
  return ""; // relative by default
})();

// Global user state
let CURRENT_USER = null;

/* ---------- NETWORK HELPERS ---------- */
async function apiFetch(url, options = {}) {
  options.credentials = 'include'; // Ensure cookies are sent
  options.headers = { ...options.headers, 'Content-Type': 'application/json' };
  try {
    const res = await fetch(`${API_BASE}${url}`, options);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error("API Fetch Error:", err);
    return { ok: false, error: err };
  }
}

/* ---------- AUTHENTICATION ---------- */
async function checkAuth() {
  const res = await apiFetch('/api/auth/me');
  if (res.ok && res.data && res.data.user) {
    CURRENT_USER = res.data.user;
    updateUI(CURRENT_USER);
    return CURRENT_USER;
  } else {
    CURRENT_USER = null;
    // If on a protected page, redirect to login
    const protectedPages = ['home.html', 'profile.html', 'recharge.html', 'withdraw.html', 'team.html', 'share.html'];
    const currentPage = location.pathname.split('/').pop();
    if (protectedPages.includes(currentPage)) {
      window.location.href = 'index.html';
    }
    return null;
  }
}

async function login(phone, pass) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, pass })
  });
  return res;
}

async function register(phone, pass, invite, withdrawPass) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone, pass, invite, withdrawPass }) // Backend needs to support withdrawPass if added to schema
  });
  return res;
}

async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  window.location.href = 'index.html';
}

/* ---------- UI UPDATES ---------- */
function updateUI(user) {
  if (!user) return;

  // Wallet
  document.querySelectorAll("[id^=walletDisplay]").forEach(el => {
    el.textContent = "Wallet: ₹" + Number((user.wallet || 0).toFixed(2));
  });

  // Profile
  const profilePhone = document.getElementById("profilePhone");
  if (profilePhone) profilePhone.textContent = "Phone: " + user.phone;

  const userId = document.getElementById("userId");
  if (userId) userId.textContent = "ID : " + user.phone; // Using phone as ID for now

  const balanceEl = document.getElementById("balance");
  if (balanceEl) balanceEl.textContent = "₹ " + Number((user.wallet || 0).toFixed(2));

  // Invite Link
  const inviteInput = document.getElementById("inviteLink");
  if (inviteInput) {
    const code = user.inviteCode || "f6c05036";
    inviteInput.value = location.origin + "/?invite=" + code;
  }
}

/* ---------- PLANS ---------- */
async function populatePlansList() {
  const plansList = document.getElementById("plansList");
  if (!plansList) return;

  const res = await apiFetch('/api/plans');
  if (!res.ok || !res.data) {
    plansList.innerHTML = '<p style="text-align:center;padding:20px;">Failed to load plans.</p>';
    return;
  }

  const plans = res.data; // Array of plans
  plansList.innerHTML = '';

  plans.forEach(p => {
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
    img.alt = p.name;
    img.loading = 'lazy';
    img.src = p.image || 'assets/images/sa.jpg';
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

    const btn = document.createElement("button");
    btn.className = "plan-buy";
    btn.textContent = "🛒 Buy now";
    btn.addEventListener("click", () => buyPlan(p));
    actionContainer.appendChild(btn);

    buyRow.appendChild(actionContainer);
    card.appendChild(buyRow);
    plansList.appendChild(card);
  });
}

/* ---------- PURCHASE FLOW ---------- */
async function buyPlan(plan) {
  if (!CURRENT_USER) return alert("Please login first");
  if (CURRENT_USER.wallet < plan.price) return alert("Insufficient balance. Please recharge.");

  // 1. Create Order
  const orderRes = await apiFetch('/api/purchases/create-order', {
    method: 'POST',
    body: JSON.stringify({ planId: plan.id, price: plan.price })
  });

  if (!orderRes.ok || !orderRes.data) {
    return alert("Failed to initiate purchase. Please try again.");
  }

  const { key, orderId, amount } = orderRes.data;

  // 2. Open Razorpay
  const options = {
    key: key,
    amount: amount,
    order_id: orderId,
    name: "Redbull",
    description: plan.name,
    handler: async function (response) {
      // 3. Verify Payment
      const verifyRes = await apiFetch('/api/purchases/verify', {
        method: 'POST',
        body: JSON.stringify(response)
      });

      if (verifyRes.ok && verifyRes.data && verifyRes.data.success) {
        alert("Purchase successful!");
        checkAuth(); // Refresh user data (wallet)
      } else {
        alert("Payment verification failed. Contact support.");
      }
    },
    modal: {
      ondismiss: function () { console.log('Payment popup closed'); }
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

/* ---------- RECHARGE & WITHDRAW ---------- */
async function handleRecharge() {
  const amount = parseFloat(document.getElementById("rechargeAmount").value || 0);
  if (!amount || amount <= 0) return alert("Enter valid amount");

  // For demo, we just simulate a recharge via backend (if we had an endpoint)
  // Since we don't have a recharge endpoint, we'll just alert.
  // In a real app, this would open a payment gateway similar to buying a plan.
  alert("Recharge functionality requires a payment gateway integration. For this demo, please use the admin panel to add funds or buy a plan directly.");
}

async function handleWithdraw() {
  const amount = parseFloat(document.getElementById("withdrawAmount").value || 0);
  const pass = document.getElementById("withdrawPass").value || "";

  if (!amount || amount <= 0) return alert("Enter valid amount");
  if (!pass) return alert("Enter withdrawal password");

  const res = await apiFetch('/api/withdraws/request', {
    method: 'POST',
    body: JSON.stringify({ amount, withdrawPass: pass })
  });

  if (res.ok) {
    alert("Withdrawal request submitted!");
    document.getElementById("withdrawAmount").value = "";
    document.getElementById("withdrawPass").value = "";
    checkAuth(); // Refresh wallet
  } else {
    alert(res.data?.message || "Withdrawal failed");
  }
}

/* ---------- INITIALIZATION ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // Check auth on load
  checkAuth();

  // Populate plans if on home page
  if (document.getElementById("plansList")) {
    populatePlansList();
  }

  // Event Listeners
  const rechargeBtn = document.getElementById("rechargeBtn");
  if (rechargeBtn) rechargeBtn.addEventListener("click", handleRecharge);

  const withdrawBtn = document.getElementById("withdrawBtn");
  if (withdrawBtn) withdrawBtn.addEventListener("click", handleWithdraw);

  const logoutBtn = document.getElementById("m-logout"); // Profile page logout
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const logoutBtn2 = document.getElementById("logoutBtn"); // Other logout buttons
  if (logoutBtn2) logoutBtn2.addEventListener("click", logout);

  // Dashboard infinite scroll (mock for now)
  setupDashboardScroll();
});

/* ---------- DASHBOARD (Mock) ---------- */
function setupDashboardScroll() {
  const listEl = document.getElementById("dashboardList");
  if (!listEl) return;

  // Simple mock items
  const items = Array.from({ length: 10 }, (_, i) => ({
    title: `Featured Plan ${i + 1}`,
    desc: `High return investment plan ${i + 1}`,
    price: 500 + (i * 100),
    image: 'assets/images/sa.jpg'
  }));

  items.forEach(item => {
    const el = document.createElement("div");
    el.className = "dash-item";
    el.innerHTML = `
      <img src="${item.image}" class="dash-thumb" loading="lazy">
      <div class="dash-body">
        <div class="dash-title">${item.title}</div>
        <div class="dash-desc">${item.desc}</div>
        <div class="dash-meta"><div class="dash-price">₹ ${item.price}</div></div>
      </div>
    `;
    listEl.appendChild(el);
  });
}

// Expose functions for inline scripts if needed
window.login = login;
window.register = register;
window.checkAuth = checkAuth;

