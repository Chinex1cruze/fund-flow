// Utility helpers and minimal API wrapper
const USE_API = true; // using backend by default
const API_BASE = '/api'; // configure to your backend base path

function getUser(){ try{return JSON.parse(localStorage.getItem('ff_user')) || null}catch(e){return null} }
function saveUser(u){ localStorage.setItem('ff_user', JSON.stringify(u||{})); }
function requireAuth(redirectTo='login.html'){ const u = getUser(); if(!u) location.href = redirectTo; return u; }
function formatN(amount){ if(amount==null) amount=0; return Number(amount).toLocaleString(); }

async function apiFetch(url, options = {}){
  const opts = { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options };
  if(opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(()=>({}));
  if(!res.ok){ throw new Error(data.message || 'Request failed'); }
  return data;
}

// Minimal API wrapper that falls back to localStorage for demo mode
const api = {
  register: async ({ fullName, phone, password, referralCode } = {}) => {
    if(USE_API){
      const body = { fullName, phone, password };
      if(referralCode) body.referralCode = referralCode;
      return apiFetch(`${API_BASE}/auth/register`, { method:'POST', body });
    }
    const user = { fullName, phone, password, balance:500, welcomeBonus:500, earnings:0, referrals:0, refEarnings:0, activePlan:null };
    saveUser(user);
    return { user };
  },


  login: async ({ phone, password }) => {
    if(USE_API){
      return apiFetch(`${API_BASE}/auth/login`, { method:'POST', body: { phone, password } });
    }
    const u = getUser();
    if(!u || u.phone !== phone || u.password !== password) throw new Error('Invalid credentials');
    return { user: u };
  },

  logout: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/auth/logout`, { method:'POST' });
    }
    localStorage.removeItem('ff_user');
    return { message: 'Logged out' };
  },

  getMe: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/users/me`, { method:'GET' });
    }
    return { user: getUser() };
  },

  getTransactions: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/transactions`, { method:'GET' });
    }
    return { transactions: [] };
  },

  getAnnouncements: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/announcements`, { method:'GET' });
    }
    return { announcements: [] };
  },

  getNotifications: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/notifications`, { method:'GET' });
    }
    return { notifications: [] };
  },

  getPaymentSettings: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/payment-settings`, { method: 'GET' });
    }
    return { settings: { withdrawalFee: 0 } };
  },

  getReferrals: async () => {
    if(USE_API){
      return apiFetch(`${API_BASE}/referrals`, { method: 'GET' });
    }
    return { referralCode: 'FF000000', referralLink: window.location.origin + '/register.html?ref=FF000000', totalReferrals: 0, totalReferralEarnings: 0, referrals: [], history: [] };
  },

  getDepositAccount: async (opts = {}) => {
    // opts: { amount }
    if(USE_API){
      const qs = opts.amount ? `?amount=${encodeURIComponent(opts.amount)}` : '';
      return apiFetch(`${API_BASE}/deposit-account${qs}`, { method:'GET' });
    }
    return { account: { bankName: 'Access Bank', accountNumber: '1909738594', accountName: 'Chinedu Chima', status: 'active' } };
  },


  deposit: async ({ amount, paymentReference, bankTransferReference, screenshot }) => {
    if(USE_API){
      return apiFetch(`${API_BASE}/deposits`, { method:'POST', body: { amount, paymentReference, bankTransferReference, screenshot } });
    }
    const u = getUser() || {};
    u.balance = (u.balance||0) + Number(amount);
    saveUser(u);
    return { user: u };
  },


  verifyAccount: async ({ bankName, accountNumber }) => {
    if(USE_API) return apiFetch(`${API_BASE}/verify-account`, { method: 'POST', body: { bankName, accountNumber } });
    // local mock
    return { success: true, verificationId: 'ver-' + Date.now(), accountName: 'Local Mock ' + accountNumber.slice(-4) };
  },

  buyVip: async ({ planId }) => {
    if(USE_API){
      return apiFetch(`${API_BASE}/vips/buy`, { method:'POST', body: { planId } });
    }
    const u = getUser();
    if(!u) throw new Error('Not authenticated');
    saveUser(u);
    return { user: u };
  },

  withdraw: async ({ amount, bankName, accountNumber, accountName }) => {
    if(USE_API){
      return apiFetch(`${API_BASE}/withdrawals`, { method:'POST', body: { amount, bankName, accountNumber, accountName } });
    }
    const u = getUser();
    if(!u) throw new Error('Not authenticated');
    const req = { id: 'wd-' + Date.now(), amount, bankName, accountNumber, accountName, status: 'pending', createdAt: Date.now() };
    const all = JSON.parse(localStorage.getItem('ff_withdrawals') || '[]');
    all.push(req);
    localStorage.setItem('ff_withdrawals', JSON.stringify(all));
    // do not deduct locally for demo fallback here (server handles balances in production)
    return { request: req, user: u };
  }
};

window.api = api;
