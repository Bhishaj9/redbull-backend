// admin.js - Refactored to match admin.html structure and use Real API

document.addEventListener('DOMContentLoaded', () => {
  // API Helpers
  const API_BASE = '/api/admin';
  const PLANS_API = '/api/plans';

  function getHeaders() {
    // Retrieve credentials from localStorage set by the login page
    const creds = JSON.parse(localStorage.getItem('adminCreds') || '{}');
    const pass = creds.pass;
    // If no password in localStorage, this will fail auth, which is correct.
    const token = `admin:${pass}`;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${token}`
    };
  }

  async function apiFetch(url, options = {}) {
    const headers = getHeaders();
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      if (res.status === 401) {
        console.error('Unauthorized');
        // Optionally redirect to login if 401
        // window.location.href = 'admin-login.html';
        return null;
      }
      return res.json();
    } catch (e) {
      console.error('API Error:', e);
      return null;
    }
  }

  // State
  let users = [];
  let withdrawRequests = [];
  let purchases = [];
  let PLANS_CONFIG = [];
  let vipPlans = [];

  // DOM Refs
  const usersContainer = document.getElementById('usersListInner');
  const normalPlansContainer = document.getElementById('normalPlans');
  const vipPlansContainer = document.getElementById('vipPlansGrid');
  const normalPlansWrapper = document.getElementById('normalPlansWrapper');
  const vipPlansWrapper = document.getElementById('vipPlansWrapper');
  const allPlansDetailed = document.getElementById('allPlansDetailed');
  const allPlansDetailedWrapper = document.getElementById('allPlansDetailedWrapper');
  const purchasesList = document.getElementById('purchasesList');
  const purchasesCompact = document.getElementById('purchasesCompact');
  const withdrawList = document.getElementById('withdrawList');
  const totalsEl = document.getElementById('totals');

  const userModal = document.getElementById('userModal');
  const modalName = document.getElementById('modalName');
  const modalEmail = document.getElementById('modalEmail');
  const modalPhone = document.getElementById('modalPhone');
  const modalPlan = document.getElementById('modalPlan');
  const modalWallet = document.getElementById('modalWallet');
  const modalExtra = document.getElementById('modalExtra');
  const modalAvatar = document.getElementById('modalAvatar');
  const modalClose = document.getElementById('modalClose');
  const modalDelete = document.getElementById('modalDelete');
  const modalBlock = document.getElementById('modalBlock');

  const tabPlans = document.getElementById('tabPlans');
  const tabPurchases = document.getElementById('tabPurchases');
  const plansLeftContent = document.getElementById('plansLeftContent');
  const purchasesLeftContent = document.getElementById('purchasesLeftContent');
  const purchasesRightContent = document.getElementById('purchasesRightContent');
  const plansRightContent = document.getElementById('plansRightContent');

  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const logoutCancel = document.getElementById('logoutCancel');
  const logoutConfirm = document.getElementById('logoutConfirm');
  const toastWrap = document.getElementById('toastWrap');

  // Helpers
  function avatarDataUrl(name, bg) {
    const initials = (name || 'U').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='${bg}' rx='20' ry='20'/><text x='50%' y='52%' font-family='Inter, Arial' font-size='72' fill='white' font-weight='700' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  const colors = ['#0b4db6', '#2b6cb0', '#d69e2e', '#6b46c1', '#dd6b20', '#2f855a', '#285e61', '#b83280'];

  function showToast(message, time = 3000) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    toastWrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const hide = () => {
      t.classList.remove('show');
      setTimeout(() => { try { toastWrap.removeChild(t); } catch (e) { } }, 240);
    };
    setTimeout(hide, time);
    return { hide };
  }

  // Data Fetching
  async function fetchData() {
    const [usersData, withdrawsData, purchasesData, plansData] = await Promise.all([
      apiFetch(`${API_BASE}/users`),
      apiFetch(`${API_BASE}/withdraws`),
      apiFetch(`${API_BASE}/purchases`),
      fetch(PLANS_API).then(r => r.json()).catch(() => ({ plans: [] }))
    ]);

    if (usersData) users = usersData.list || [];
    if (withdrawsData) withdrawRequests = withdrawsData.list || [];
    if (purchasesData) purchases = purchasesData.list || [];

    if (plansData && plansData.plans) {
      PLANS_CONFIG = plansData.plans;
      vipPlans = [];
    }

    renderAll();
  }

  // Renderers
  function renderUsers() {
    usersContainer.innerHTML = '';
    if (users.length === 0) {
      usersContainer.innerHTML = '<div style="padding:10px; color:var(--muted)">No users found</div>';
      return;
    }
    users.forEach((u, idx) => {
      const card = document.createElement('div'); card.className = 'user-card'; card.tabIndex = 0;
      const color = colors[idx % colors.length];
      const name = u.phone || 'User';
      const img = document.createElement('img'); img.className = 'avatar'; img.src = avatarDataUrl(name, color); img.alt = name;
      img.width = 56; img.height = 56; img.style.objectFit = 'cover';

      const meta = document.createElement('div'); meta.className = 'user-meta';
      const nameEl = document.createElement('div'); nameEl.className = 'user-name'; nameEl.textContent = name;
      const phoneEl = document.createElement('div'); phoneEl.className = 'user-phone'; phoneEl.textContent = u.phone;
      const walletEl = document.createElement('div'); walletEl.className = 'user-email'; walletEl.textContent = `Wallet: ₹${u.wallet || 0}`;

      meta.appendChild(nameEl); meta.appendChild(phoneEl); meta.appendChild(walletEl);
      card.appendChild(img); card.appendChild(meta);

      card.addEventListener('click', () => openUserModal(u));
      usersContainer.appendChild(card);
    });
    updateTotals();
  }

  function renderNormalPlans() {
    normalPlansContainer.innerHTML = '';
    if (PLANS_CONFIG.length === 0) {
      normalPlansContainer.innerHTML = '<div style="color:var(--muted)">No plans available</div>';
      return;
    }
    PLANS_CONFIG.forEach(p => {
      const card = document.createElement('div'); card.className = 'plan-card';
      const title = document.createElement('div'); title.className = 'plan-title'; title.textContent = p.name + (p.diamond ? ' ✦' : '');
      const meta = document.createElement('div'); meta.className = 'plan-meta'; meta.textContent = `₹${p.price} • daily ₹${p.daily} • ${p.days} days`;

      const actions = document.createElement('div'); actions.className = 'plan-actions';
      const edit = document.createElement('button'); edit.className = 'btn'; edit.textContent = 'Edit';
      edit.disabled = true;
      actions.appendChild(edit);

      card.appendChild(title); card.appendChild(meta); card.appendChild(actions);
      normalPlansContainer.appendChild(card);
    });
  }

  function renderVipPlans() {
    vipPlansContainer.innerHTML = '';
    if (vipPlans.length === 0) {
      vipPlansContainer.innerHTML = '<div style="color:var(--muted)">No VIP plans</div>';
      return;
    }
  }

  function renderPurchases() {
    purchasesList.innerHTML = '';
    if (purchases.length === 0) {
      purchasesList.textContent = 'No purchases found';
      return;
    }
    purchases.forEach(p => {
      const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.padding = '8px 6px'; row.style.borderBottom = '1px solid #f2f2f2';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${p.planName || 'Plan'}</strong><br><span style="font-size:12px;color:#666">${p.userPhone || p.userId}</span>`;
      const right = document.createElement('div'); right.textContent = `₹${p.amount / 100} • ${p.status}`;
      row.appendChild(left); row.appendChild(right); purchasesList.appendChild(row);
    });

    // Compact view
    purchasesCompact.innerHTML = '';
    purchases.slice(0, 8).forEach(p => {
      const r = document.createElement('div'); r.style.display = 'flex'; r.style.justifyContent = 'space-between'; r.style.padding = '8px 6px'; r.style.borderBottom = '1px solid #f2f2f2';
      r.innerHTML = `<div style="font-weight:600">${p.planName || 'Plan'}</div><div style="color:var(--muted)">₹${p.amount / 100}</div>`;
      purchasesCompact.appendChild(r);
    });
  }

  function renderWithdrawRequests() {
    withdrawList.innerHTML = '';
    if (withdrawRequests.length === 0) { withdrawList.textContent = 'No withdraw requests'; return; }
    withdrawRequests.forEach(w => {
      const card = document.createElement('div'); card.className = 'withdraw-card';
      const info = document.createElement('div'); info.className = 'withdraw-info';
      const meta = document.createElement('div'); meta.className = 'withdraw-meta';
      const who = document.createElement('div'); who.textContent = w.phone;
      const when = document.createElement('div'); when.style.color = 'var(--muted)'; when.style.fontSize = '13px'; when.textContent = `Requested: ${new Date(w.createdAt).toLocaleDateString()}`;
      meta.appendChild(who); meta.appendChild(when);
      info.appendChild(meta);

      const right = document.createElement('div'); right.style.display = 'flex'; right.style.flexDirection = 'column'; right.style.alignItems = 'flex-end'; right.style.gap = '8px';
      const amt = document.createElement('div'); amt.innerHTML = `<strong>₹${w.amount.toLocaleString()}</strong>`;
      const status = document.createElement('div'); status.className = 'status ' + (w.status === 'pending' ? 'pending' : (w.status === 'processed' ? 'approved' : 'declined')); status.textContent = w.status.toUpperCase();

      const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px';

      if (w.status === 'pending') {
        const approve = document.createElement('button'); approve.className = 'btn primary'; approve.textContent = 'Approve';
        const decline = document.createElement('button'); decline.className = 'btn'; decline.textContent = 'Decline';
        approve.onclick = () => handleProcessWithdraw(w._id, 'accept');
        decline.onclick = () => handleProcessWithdraw(w._id, 'decline');
        actions.appendChild(approve); actions.appendChild(decline);
      }

      right.appendChild(amt); right.appendChild(status); right.appendChild(actions);
      card.appendChild(info); card.appendChild(right);
      withdrawList.appendChild(card);
    });
  }

  async function handleProcessWithdraw(id, action) {
    const res = await apiFetch(`${API_BASE}/withdraws/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    if (res) {
      showToast(res.message);
      fetchData(); // Refresh data
    }
  }

  function openUserModal(user) {
    modalName.textContent = user.phone || 'User';
    modalEmail.textContent = '-';
    modalPhone.textContent = user.phone;
    modalPlan.textContent = `Plans: ${user.plans ? user.plans.length : 0}`;
    modalWallet.textContent = 'Wallet: ₹' + (user.wallet ?? 0);
    modalExtra.innerHTML = `Joined: ${new Date(user.createdAt).toLocaleDateString()}`;

    const color = colors[0];
    modalAvatar.style.backgroundImage = `url("${avatarDataUrl(user.phone, color)}")`;
    modalAvatar.style.backgroundSize = 'cover';
    modalAvatar.style.backgroundPosition = 'center';
    modalAvatar.textContent = '';

    userModal.classList.remove('hidden');
    userModal.setAttribute('aria-hidden', 'false');
    currentUserId = user._id;

    if (modalBlock) modalBlock.textContent = user.blocked ? 'Unblock User' : 'Block User';
  }

  function closeModal() {
    userModal.classList.add('hidden');
    userModal.setAttribute('aria-hidden', 'true');
  }

  modalClose.addEventListener('click', closeModal);
  userModal.addEventListener('click', (e) => { if (e.target === userModal) closeModal(); });

  // Block/Delete Logic
  let currentUserId = null;

  if (modalBlock) {
    modalBlock.onclick = async () => {
      if (!currentUserId) return;
      if (!confirm('Are you sure you want to block/unblock this user?')) return;
      const res = await apiFetch(`${API_BASE}/users/${currentUserId}/block`, { method: 'POST' });
      if (res) {
        showToast(res.message);
        closeModal();
        fetchData();
      }
    };
  }

  if (modalDelete) {
    modalDelete.onclick = async () => {
      console.log('Delete button clicked, currentUserId:', currentUserId);
      if (!currentUserId) {
        console.error('No currentUserId set!');
        return;
      }
      if (!confirm('Are you sure you want to DELETE this user? This action cannot be undone.')) {
        console.log('Delete cancelled by user');
        return;
      }
      console.log('Calling DELETE endpoint for user:', currentUserId);
      const res = await apiFetch(`${API_BASE}/users/${currentUserId}`, { method: 'DELETE' });
      console.log('Delete response:', res);
      if (res) {
        showToast(res.message);
        closeModal();
        fetchData();
      } else {
        console.error('Delete failed: no response from server');
      }
    };
  }

  function updateTotals() {
    totalsEl.textContent = `Users: ${users.length} • Plans: ${PLANS_CONFIG.length} • Withdrawals: ${withdrawRequests.length}`;
  }

  function renderAll() {
    renderUsers();
    renderNormalPlans();
    renderVipPlans();
    renderPurchases();
    renderWithdrawRequests();
    updateTotals();
  }

  // Tabs
  function activateTab(tab) {
    if (tab === 'plans') {
      tabPlans.classList.add('active'); tabPurchases.classList.remove('active');
      plansLeftContent.style.display = ''; purchasesLeftContent.style.display = 'none';
      plansRightContent.style.display = ''; purchasesRightContent.style.display = 'none';
    } else {
      tabPurchases.classList.add('active'); tabPlans.classList.remove('active');
      plansLeftContent.style.display = 'none'; purchasesLeftContent.style.display = '';
      plansRightContent.style.display = 'none'; purchasesRightContent.style.display = '';
    }
  }
  tabPlans.addEventListener('click', () => activateTab('plans'));
  tabPurchases.addEventListener('click', () => activateTab('purchases'));

  // Logout Logic
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logoutModal.classList.remove('hidden');
    });
  }
  if (logoutCancel) {
    logoutCancel.addEventListener('click', () => {
      logoutModal.classList.add('hidden');
    });
  }
  if (logoutConfirm) {
    logoutConfirm.addEventListener('click', () => {
      localStorage.removeItem('adminCreds');
      window.location.href = 'admin-login.html';
    });
  }

  // Initial Load
  console.log('Admin JS: Fetching data...');
  fetchData();
  activateTab('plans');

  // Run Payouts
  const runPayoutsBtn = document.getElementById('runPayouts');
  if (runPayoutsBtn) {
    runPayoutsBtn.addEventListener('click', async () => {
      if (!confirm('Run daily payouts for all users? This will add daily earnings to wallets.')) return;
      runPayoutsBtn.disabled = true;
      runPayoutsBtn.textContent = 'Processing...';
      const res = await apiFetch(`${API_BASE}/payouts`, { method: 'POST' });
      if (res) {
        showToast(res.message);
        fetchData();
      }
      runPayoutsBtn.disabled = false;
      runPayoutsBtn.textContent = 'Run Payouts (apply due daily payments)';
    });
  }

  // Add Plan
  const addPlanBtn = document.getElementById('addPlanBtn');
  const resetFormBtn = document.getElementById('resetForm');

  if (addPlanBtn) {
    addPlanBtn.addEventListener('click', async () => {
      const title = document.getElementById('planTitle').value;
      const price = Number(document.getElementById('planPrice').value);
      const daily = Number(document.getElementById('planDaily').value);
      const days = Number(document.getElementById('planDays').value);
      const type = document.getElementById('planType').value;
      const timerHours = Number(document.getElementById('planTimerHours').value);
      const isVip = document.getElementById('planIsVip').checked;

      if (!title || !price || !daily) {
        alert('Please fill in Title, Price, and Daily payout');
        return;
      }

      const body = { name: title, price, daily, days, type, timerHours, diamond: isVip };
      const res = await apiFetch(`${API_BASE}/plans`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (res) {
        showToast('Plan added successfully');
        fetchData();
        // clear form
        if (resetFormBtn) resetFormBtn.click();
      }
    });
  }

  if (resetFormBtn) {
    resetFormBtn.addEventListener('click', () => {
      document.getElementById('planTitle').value = '';
      document.getElementById('planPrice').value = '';
      document.getElementById('planDaily').value = '';
      document.getElementById('planDays').value = '';
      document.getElementById('planTimerHours').value = '';
      document.getElementById('planType').value = 'buy';
      document.getElementById('planIsVip').checked = false;
    });
  }
});
