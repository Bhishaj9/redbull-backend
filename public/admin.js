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
