const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const multer = require('multer');

function loadDotEnvFile(){
  const envPath = path.join(__dirname, '.env');
  if(!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for(const line of lines){
    const trimmed = line.trim();
    if(!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if(separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if(key) process.env[key] = value;
  }
}

loadDotEnvFile();

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const JWT_SECRET = process.env.JWT_SECRET || 'fundflow-secret-key';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PREFERRED_BANK = process.env.PAYSTACK_PREFERRED_BANK || 'wema-bank';
const TOKEN_NAME = 'ff_token';
const PAYSTACK_API_BASE = 'https://api.paystack.co';
const DEFAULT_DEPOSIT_ACCOUNTS = [
  { id: 'acct-sterling', bankName: 'Sterling Bank', accountNumber: '0142489003', accountName: 'Chinedu Chima', status: 'active', createdAt: Date.now() },
  { id: 'acct-access', bankName: 'Access Bank', accountNumber: '1909738594', accountName: 'Chinedu Chima', status: 'active', createdAt: Date.now() }
];
const VIP_PLANS = [
  { id: 1, name: 'VIP 1', deposit: 3000, daily: 700 },
  { id: 2, name: 'VIP 2', deposit: 10000, daily: 2400 },
  { id: 3, name: 'VIP 3', deposit: 30000, daily: 7500 },
  { id: 4, name: 'VIP 4', deposit: 60000, daily: 15000 },
  { id: 5, name: 'VIP 5', deposit: 100000, daily: 26000 },
  { id: 6, name: 'VIP 6', deposit: 200000, daily: 55000 },
  { id: 7, name: 'VIP 7', deposit: 350000, daily: 100000 },
  { id: 8, name: 'VIP 8', deposit: 500000, daily: 145000 },
  { id: 9, name: 'VIP 9', deposit: 750000, daily: 220000 },
  { id: 10, name: 'VIP 10', deposit: 1000000, daily: 300000 },
  { id: 11, name: 'VIP 11', deposit: 2000000, daily: 620000 },
  { id: 12, name: 'VIP 12', deposit: 5000000, daily: 1600000 }
];

function ensureDataFile(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // ensure uploads folder for screenshots
  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
  if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if(!fs.existsSync(DATA_FILE)){
    const defaultData = {
      users: [],
      withdrawals: [],
      deposits: [],
      transactions: [],
      verifications: [],
      auditLogs: [],
      announcements: [],
      notifications: [],
      vipPurchases: [],
      depositAccounts: DEFAULT_DEPOSIT_ACCOUNTS,
      depositAccountCursor: 0,
      paymentSettings: {
        mode: process.env.PAYMENT_MODE || 'testing',
        bankName: process.env.PAYMENT_BANK_NAME || 'Sterling Bank',
        accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || '0142489003',
       accountName: process.env.PAYMENT_ACCOUNT_NAME || 'Chinedu Chima',
       withdrawalFee: 0.2
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function normalizeData(data){
  const normalized = data || {};
  normalized.users = normalized.users || [];
  normalized.withdrawals = normalized.withdrawals || [];
  normalized.deposits = normalized.deposits || [];
  normalized.transactions = normalized.transactions || [];
  normalized.verifications = normalized.verifications || [];
  normalized.auditLogs = normalized.auditLogs || [];
  normalized.announcements = normalized.announcements || [];
  normalized.notifications = normalized.notifications || [];
  normalized.depositAccounts = normalized.depositAccounts && normalized.depositAccounts.length ? normalized.depositAccounts : DEFAULT_DEPOSIT_ACCOUNTS;
  normalized.depositAccountCursor = Number.isInteger(normalized.depositAccountCursor) ? normalized.depositAccountCursor : 0;
  normalized.paymentSettings = normalized.paymentSettings || {};
  if(typeof normalized.paymentSettings.withdrawalFee === 'undefined') normalized.paymentSettings.withdrawalFee = 0.2;

  // Backfill referralCode and referralLink for existing users if missing, ensuring uniqueness
  const existingCodes = new Set((normalized.users || []).map(u => String(u.referralCode || '').toLowerCase()).filter(Boolean));
  function genRefCode(){
    return 'FF' + String(Math.floor(Math.random() * 900000 + 100000));
  }
  for(const u of normalized.users){
    if(!u.referralCode){
      let code = genRefCode();
      while(existingCodes.has(code.toLowerCase())) code = genRefCode();
      u.referralCode = code;
      existingCodes.add(code.toLowerCase());
    }
    if(!u.referralLink){
      u.referralLink = (process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/, '') : '') + `/register.html?ref=${encodeURIComponent(u.referralCode || '')}`;
    }
    // ensure flag exists
    if(typeof u.referralRewardProcessed === 'undefined') u.referralRewardProcessed = false;
  }

  return normalized;
}

function readData(){
  ensureDataFile();
  const content = fs.readFileSync(DATA_FILE, 'utf8');
  try{
    const parsed = JSON.parse(content);
    return normalizeData(parsed);
  }catch(e){
    return normalizeData({ users: [], withdrawals: [], deposits: [] });
  }
}

function writeData(data){
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateToken(user){
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

function sanitizeUser(user){
  if(!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function getNextDepositAccount(data){
  const activeAccounts = (data.depositAccounts || []).filter(account => account.status !== 'disabled');
  if(!activeAccounts.length) return null;
  const selected = activeAccounts[data.depositAccountCursor % activeAccounts.length];
  data.depositAccountCursor = (data.depositAccountCursor + 1) % activeAccounts.length;
  return selected;
}

function assignDepositAccountToUser(data, user){
  if(user.depositAccount && user.depositAccount.accountNumber){
    return user.depositAccount;
  }
  const account = getNextDepositAccount(data);
  if(!account) return null;
  const accountPayload = {
    id: account.id,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    status: account.status || 'active',
    assignedAt: Date.now()
  };
  user.depositAccount = accountPayload;
  user.assignedDepositAccountId = account.id;
  user.paystackAccount = accountPayload;
  return accountPayload;
}

function createNotification(data, { userId, title, text, type = 'info' }){
  const notification = {
    id: 'notif-' + Date.now(),
    userId,
    title,
    text,
    type,
    createdAt: Date.now(),
    read: false
  };
  data.notifications = data.notifications || [];
  data.notifications.push(notification);
  return notification;
}

function paystackRequest(pathname, { method = 'GET', body = null } = {}) {
  if(!PAYSTACK_SECRET_KEY) {
    return Promise.reject(new Error('Paystack secret key is not configured'));
  }

  const payload = body ? JSON.stringify(body) : null;
  const url = new URL(pathname, PAYSTACK_API_BASE);
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const parsed = data ? JSON.parse(data) : {};
        if(res.statusCode >= 400 || parsed.status === false) {
          return reject(new Error(parsed.message || `Paystack request failed with status ${res.statusCode}`));
        }
        resolve(parsed);
      });
    });

    req.on('error', reject);
    if(payload) req.write(payload);
    req.end();
  });
}

function getPaystackPublicKey(){
  return PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || '';
}

function applyPayouts(data, user){
  // data: full data object from readData(); user: user object reference from data
  if(!user || !user.activePlan || !user.activePlan.nextPayoutAt) return false;
  // Ensure plan bookkeeping fields exist
  user.activePlan.durationDays = Number(user.activePlan.durationDays || 30);
  user.activePlan.daysCompleted = Number(user.activePlan.daysCompleted || 0);
  user.activePlan.daily = Number(user.activePlan.daily || 0);
  user.activePlan.totalEarned = Number(user.activePlan.totalEarned || 0);

  let updated = false;
  const now = Date.now();

  // Process due earnings one day at a time to maintain atomicity and avoid overshooting
  while(user.activePlan.nextPayoutAt <= now && (user.activePlan.daysCompleted < user.activePlan.durationDays)){
    const nextDay = user.activePlan.daysCompleted + 1;
    // Avoid duplicate crediting: check vipPurchase earnings array if available
    let vipPurchase = null;
    if(user.activePlan.purchaseId){
      data.vipPurchases = data.vipPurchases || [];
      vipPurchase = data.vipPurchases.find(v => v.id === user.activePlan.purchaseId);
    }
    // If purchase record exists, ensure this day not already processed
    if(vipPurchase){
      vipPurchase.earnings = vipPurchase.earnings || [];
      const existing = vipPurchase.earnings.find(e => e.day === nextDay);
      if(existing){
        // Already processed; advance pointers
        user.activePlan.daysCompleted = vipPurchase.earnings.length;
        user.activePlan.nextPayoutAt += 24 * 60 * 60 * 1000;
        continue;
      }
    }

    // Credit wallet
    const dailyAmount = Number(user.activePlan.daily || 0);
    user.balance = (user.balance || 0) + dailyAmount;
    user.earnings = (user.earnings || 0) + dailyAmount;
    user.activePlan.daysCompleted = (user.activePlan.daysCompleted || 0) + 1;
    user.activePlan.totalEarned = (user.activePlan.totalEarned || 0) + dailyAmount;

    // Create transaction record for this earning
    const vipRef = user.activePlan.purchaseRef || (user.activePlan.purchaseId || null);
    const tx = recordTransaction(data, { userId: user.id, type: 'vip_daily_earning', amount: dailyAmount, status: 'completed', meta: { vipPurchaseId: user.activePlan.purchaseId || null, vipRef: vipRef, planId: user.activePlan.id, planName: user.activePlan.name, earningDay: user.activePlan.daysCompleted } });

    // Create user notification
    createNotification(data, { userId: user.id, title: 'VIP DAILY EARNING', text: `Your ${user.activePlan.name} daily earning of ₦${dailyAmount} has been credited (Day ${user.activePlan.daysCompleted}/${user.activePlan.durationDays}). Reference: ${vipRef}`, type: 'success' });

    // Create admin notification (persistent)
    try{ createNotification(data, { userId: 'admin', title: 'VIP DAILY EARNING', text: `${user.fullName || user.phone || user.id} received ₦${dailyAmount} for ${user.activePlan.name} (Day ${user.activePlan.daysCompleted}/${user.activePlan.durationDays}). Ref: ${vipRef}`, type: 'admin' }); }catch(e){}

    // Mark earning in vipPurchase record if exists
    if(vipPurchase){
      vipPurchase.earnings = vipPurchase.earnings || [];
      vipPurchase.earnings.push({ id: `earning-${Date.now()}`, day: user.activePlan.daysCompleted, amount: dailyAmount, txId: tx.id, createdAt: Date.now() });
    }

    // Schedule next payout
    user.activePlan.nextPayoutAt = Number(user.activePlan.nextPayoutAt || Date.now()) + 24 * 60 * 60 * 1000;

    updated = true;

    // If we've reached duration, mark completed
    if(user.activePlan.daysCompleted >= user.activePlan.durationDays){
      user.activePlan.status = 'completed';
      // Create completion transaction/notification
      recordTransaction(data, { userId: user.id, type: 'vip_cycle_completed', amount: 0, status: 'completed', meta: { vipPurchaseId: user.activePlan.purchaseId || null, vipRef: vipRef } });
      createNotification(data, { userId: user.id, title: 'VIP Cycle Completed', text: `Your ${user.activePlan.name} 30-day cycle has completed.`, type: 'success' });
      try{ createNotification(data, { userId: 'admin', title: 'VIP Completed', text: `${user.fullName || user.phone || user.id} completed ${user.activePlan.name} (${vipRef})`, type: 'admin' }); }catch(e){}
      break;
    }
  }

  return updated;
}

function findUserByPhone(data, phone){
  return data.users.find(u => u.phone === phone);
}

function findUserById(data, id){
  return data.users.find(u => u.id === id);
}

function authMiddleware(req, res, next){
  const token = req.cookies[TOKEN_NAME];
  if(!token) return res.status(401).json({ message: 'Authentication required' });
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    const data = readData();
    const user = findUserById(data, payload.id);
    if(!user) return res.status(401).json({ message: 'Invalid authentication token' });
    if(applyPayouts(data, user)) writeData(data);
    req.user = user;
    next();
  }catch(err){
    return res.status(401).json({ message: 'Invalid authentication token' });
  }
}

// Helper: simple admin auth using an admin token header (x-admin-token)
function adminAuthMiddleware(req, res, next){
  // Accept admin token via header, query param, or secure httpOnly cookie 'ff_admin'
  const token = req.headers['x-admin-token'] || req.query.adminToken || req.cookies && req.cookies['ff_admin'];
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'chinex002';
  if(!token || token !== ADMIN_TOKEN) return res.status(401).json({ message: 'Admin authorization required' });
  req.admin = { token: ADMIN_TOKEN };
  next();
}

function getPaymentSettings(){
  const data = readData();
  const ds = data.paymentSettings || {};
  const configuredFee = Number(ds.withdrawalFee ?? 0.2);
  const normalizedFee = Number.isFinite(configuredFee) && configuredFee > 1 ? configuredFee / 100 : configuredFee;
  return {
    mode: process.env.PAYMENT_MODE || ds.mode || 'testing',
    bankName: process.env.PAYMENT_BANK_NAME || ds.bankName || 'Access bank',
    accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER || ds.accountNumber || '1909738593',
    accountName: process.env.PAYMENT_ACCOUNT_NAME || ds.accountName || 'chinedu Chima',
    withdrawalFee: Number.isFinite(normalizedFee) ? normalizedFee : 0.2
  };
}

function resolveWithdrawalFeeRate(data){
  const configuredFee = Number((data && data.paymentSettings && data.paymentSettings.withdrawalFee) ?? 0.2);
  const normalizedFee = Number.isFinite(configuredFee) && configuredFee > 1 ? configuredFee / 100 : configuredFee;
  return Number.isFinite(normalizedFee) ? Math.max(0, normalizedFee) : 0.2;
}

function recordTransaction(data, { userId, type, amount, status, meta }){
  const tx = { id: 'txn-' + Date.now(), userId, type, amount, status: status || 'pending', meta: meta || {}, createdAt: Date.now() };
  data.transactions = data.transactions || [];
  data.transactions.push(tx);
  return tx;
}

function addAuditLog(data, { adminToken, action, details }){
  data.auditLogs = data.auditLogs || [];
  const entry = { id: 'audit-' + Date.now(), adminToken: adminToken || null, action, details: details || {}, at: Date.now() };
  data.auditLogs.push(entry);
  return entry;
}

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 80 });
app.use(limiter);

app.post('/api/auth/register', (req, res) => {
  const { fullName, phone, password } = req.body;
  if(!fullName || !phone || !password) return res.status(400).json({ message: 'Missing required fields' });
  const data = readData();
  if(findUserByPhone(data, phone)) return res.status(409).json({ message: 'Phone number already registered' });
  const id = 'user-' + Date.now();
  const passwordHash = bcrypt.hashSync(password, 10);
  // Generate a unique referral code for the new user (FF + 6 digits)
  function genRef(){ return 'FF' + String(Math.floor(Math.random() * 900000 + 100000)); }
  let referralCode = genRef();
  const existingCodes = new Set((data.users || []).map(u => String(u.referralCode || '').toLowerCase()).filter(Boolean));
  while(existingCodes.has(referralCode.toLowerCase())) referralCode = genRef();
  const referralLink = (process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/, '') : '') + `/register.html?ref=${encodeURIComponent(referralCode)}`;

  const user = {
    id,
    fullName,
    phone,
    passwordHash,
    balance: 500,
    welcomeBonus: 500,
    earnings: 0,
    referrals: 0,
    refEarnings: 0,
    activePlan: null,
    // referral fields
    referralCode,
    referralLink,
    referredBy: null,
    referralRewardProcessed: false
  };

  // If a referral code was provided in body or query (e.g., ?ref=...), associate the referrer
  const providedRef = (req.body && req.body.referralCode) || (req.query && req.query.ref) || null;
  if(providedRef){
    const referrer = (data.users || []).find(u => String(u.referralCode).toLowerCase() === String(providedRef).toLowerCase());
    if(referrer){
      user.referredBy = referrer.id;
      // do not credit earnings now — only after the referred user's first approved deposit
    }
  }

  assignDepositAccountToUser(data, user);
  data.users.push(user);
  createNotification(data, { userId: user.id, title: 'Welcome bonus', text: 'Your account has been created and your welcome bonus has been credited.', type: 'success' });
  writeData(data);
  const token = generateToken(user);
  res.cookie(TOKEN_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  if(!phone || !password) return res.status(400).json({ message: 'Phone and password are required' });
  const data = readData();
  const user = findUserByPhone(data, phone);
  if(!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ message: 'Invalid credentials' });
  if(applyPayouts(user)) writeData(data);
  const token = generateToken(user);
  res.cookie(TOKEN_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(TOKEN_NAME, { httpOnly: true, sameSite: 'lax' });
  res.json({ message: 'Logged out' });
});

app.get('/api/users/me', authMiddleware, (req, res) => {
  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });
  if(applyPayouts(user)) writeData(data);
  res.json({ user: sanitizeUser(user) });
});

// Allow users to update limited profile fields (fullName, profilePicture)
app.patch('/api/users/me', authMiddleware, (req, res) => {
  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });
  const { fullName, profilePicture } = req.body || {};
  let changed = false;
  if(fullName && String(fullName).trim() && String(fullName).trim() !== (user.fullName || '')){
    user.fullName = String(fullName).trim();
    changed = true;
  }
  if(profilePicture && typeof profilePicture === 'string' && profilePicture.length > 10){
    // Accept data URL or remote url — store as provided
    user.profilePicture = profilePicture;
    changed = true;
  }
  if(changed){
    writeData(data);
    createNotification(data, { userId: user.id, title: 'Profile updated', text: 'Your profile was successfully updated.', type: 'info' });
  }
  res.json({ user: sanitizeUser(user) });
});

// Referral info for current user: code, link, stats and history
app.get('/api/referrals', authMiddleware, (req, res) => {
  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });

  const referredUsers = (data.users || []).filter(u => String(u.referredBy) === String(user.id));
  const referralTxs = (data.transactions || []).filter(t => t.userId === user.id && t.type === 'referral').sort((a,b)=>b.createdAt - a.createdAt);
  const totalReferralEarnings = referralTxs.reduce((s, t) => s + Number(t.amount || 0), 0);

  const history = referralTxs.map(t => ({ id: t.id, amount: t.amount, status: t.status, createdAt: t.createdAt, meta: t.meta || {} }));

  res.json({
    referralCode: user.referralCode || null,
    referralLink: user.referralLink || ((process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/, '') : '') + `/register.html?ref=${encodeURIComponent(user.referralCode || '')}`),
    totalReferrals: referredUsers.length,
    totalReferralEarnings: totalReferralEarnings,
    referrals: referredUsers.map(u=>({ id: u.id, fullName: u.fullName, phone: u.phone, createdAt: u.createdAt || null })),
    history
  });
});

app.get('/api/vips', (req, res) => {
  res.json({ plans: VIP_PLANS });
});

// Account verification endpoint (uses testing mock or a real provider when configured)
app.post('/api/verify-account', authMiddleware, (req, res) => {
  const { bankName, accountNumber } = req.body || {};
  if(!bankName) return res.status(400).json({ message: 'Bank selection is required' });
  if(!accountNumber || !/^\d{10}$/.test(accountNumber)) return res.status(400).json({ message: 'Account number must contain exactly 10 digits' });

  const settings = getPaymentSettings();
  const data = readData();
  data.verifications = data.verifications || [];

  if((settings.mode || 'testing') === 'testing'){
    // Mock verification for testing mode
    const accountName = 'Test Account ' + accountNumber.slice(-4);
    const verification = { id: 'ver-' + Date.now(), bankName, accountNumber, accountName, createdAt: Date.now() };
    data.verifications.push(verification);
    writeData(data);
    return res.json({ success: true, verificationId: verification.id, accountName });
  }

  // Production: provider must be configured
  const providerUrl = process.env.PAYMENT_PROVIDER_API_URL;
  const providerKey = process.env.PAYMENT_PROVIDER_API_KEY;
  if(!providerUrl || !providerKey) return res.status(502).json({ message: 'Payment provider not configured' });
  // Placeholder: in production, call provider's account resolution API here.
  return res.status(501).json({ message: 'Account verification not implemented for production in this demo' });
});

app.get('/api/payment-settings', (req, res) => {
  const settings = getPaymentSettings();
  res.json({ settings });
});

app.get('/api/deposit-account', authMiddleware, (req, res) => {
  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });

  // If amount is provided, create a per-deposit virtual account session
  const amount = Number(req.query.amount || 0);
  if(amount && amount >= 3000){
    data.virtualAccounts = data.virtualAccounts || [];
    // Select an active configured deposit account to back this virtual session (round-robin via cursor)
    const base = getNextDepositAccount(data) || { id: 'acct-fallback', bankName: 'Access Bank', accountNumber: '1909738594', accountName: 'FundFlow', status: 'active' };

    const now = Date.now();
    // generate a unique payment reference for this payment session (shown to user)
    const paymentReference = `FF-${Math.floor(Math.random()*900000+100000)}`;
    const virtual = {
      id: 'va-' + now,
      userId: user.id,
      bankName: base.bankName,
      // Use the authoritative configured account number from the backing account (no random numbers)
      accountNumber: base.accountNumber,
      accountName: base.accountName || user.fullName || 'FundFlow',
      status: 'active',
      amount: amount,
      paymentReference: paymentReference,
      backingAccountId: base.id || null,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // payment window 10 minutes
      closeAt: now + 3 * 60 * 1000 // auto-close after 3 minutes
    };
    data.virtualAccounts.push(virtual);
    // Audit the creation of a virtual deposit session for reconciliation
    try{ addAuditLog(data, { adminToken: null, action: 'create_virtual_account', details: { vaId: virtual.id, userId: virtual.userId, backingAccountId: virtual.backingAccountId, paymentReference } }); }catch(e){}
    writeData(data);
    return res.json({ account: virtual, session: { paymentWindowSec: 10*60, autoCloseSec: 3*60 } });
  }

  // default: assign a persistent deposit account to the user
  const account = assignDepositAccountToUser(data, user);
  writeData(data);
  res.json({ account, status: 'active', note: 'Transfer only to this account. Your wallet will be credited automatically after payment verification.' });
});

app.get('/api/announcements', (req, res) => {
  const data = readData();
  res.json({ announcements: data.announcements || [] });
});

app.get('/api/notifications', authMiddleware, (req, res) => {
  const data = readData();
  const notifications = (data.notifications || []).filter(n => n.userId === req.user.id).sort((a,b)=>b.createdAt-a.createdAt);
  res.json({ notifications });
});

app.post('/api/paystack/account', authMiddleware, async (req, res) => {
  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });

  const account = assignDepositAccountToUser(data, user);
  writeData(data);
  return res.json({ account: account || { bankName: 'Access Bank', accountNumber: '1909738594', accountName: 'Chinedu Chima', status: 'active' }, fallback: true });
});

app.get('/api/paystack/config', (req, res) => {
  res.json({
    publicKey: getPaystackPublicKey(),
    currency: 'NGN',
    mode: process.env.PAYMENT_MODE || 'production'
  });
});

app.post('/api/paystack/initialize', authMiddleware, async (req, res) => {
  const { amount, email } = req.body || {};
  const depositAmount = Number(amount);
  if(!depositAmount || depositAmount < 3000) return res.status(400).json({ message: 'Minimum deposit is ₦3,000' });
  const normalizedEmail = String(email || '').trim();
  if(!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'A valid email address is required to initialize Paystack checkout.' });
  }
  if(!getPaystackPublicKey() || !PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ message: 'Paystack keys are not configured on this host.' });
  }

  const reference = `fundflow-${Date.now()}-${Math.floor(Math.random() * 900000 + 100000)}`;
  try{
    const response = await paystackRequest('/transaction/initialize', {
      method: 'POST',
      body: {
        email: normalizedEmail,
        amount: Math.round(depositAmount * 100),
        currency: 'NGN',
        reference,
        channels: ['card', 'bank', 'ussd']
      }
    });
    res.json({
      status: true,
      reference,
      data: response.data,
      publicKey: getPaystackPublicKey()
    });
  }catch(err){
    return res.status(502).json({ message: err.message || 'Unable to initialize Paystack checkout' });
  }
});

app.post('/api/paystack/verify', authMiddleware, async (req, res) => {
  const { reference } = req.body || {};
  if(!reference) return res.status(400).json({ message: 'Transaction reference is required' });
  if(!PAYSTACK_SECRET_KEY) return res.status(500).json({ message: 'Paystack secret key is not configured on this host.' });

  try{
    const response = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const amount = Number((response.data?.amount || 0) / 100);
    res.json({
      status: true,
      data: {
        reference: response.data?.reference,
        amount,
        status: response.data?.status,
        gateway_response: response.data?.gateway_response,
        channel: response.data?.channel,
        paid_at: response.data?.paid_at
      }
    });
  }catch(err){
    return res.status(502).json({ message: err.message || 'Unable to verify Paystack transaction' });
  }
});

app.post('/api/deposits', authMiddleware, (req, res) => {
  // Accept payload: amount, paymentReference (FundFlow virtual session ref), bankTransferReference (user-supplied narration), screenshot
  const { amount, paymentReference, bankTransferReference, screenshot } = req.body || {};
  const depositAmount = Number(amount);
  if(!depositAmount || depositAmount <= 0) return res.status(400).json({ message: 'Invalid deposit amount' });

  const data = readData();
  data.deposits = data.deposits || [];

  // Prevent duplicate submission for the same user/paymentReference (idempotency)
  if(paymentReference){
    const existingSame = (data.deposits || []).find(d => d.userId === req.user.id && d.paymentReference === paymentReference && (d.status === 'pending' || d.status === 'approved'));
    if(existingSame) return res.status(409).json({ message: 'A deposit for this payment session has already been submitted' });
  }

  // Generate a unique internal transaction reference (FF-xxxxxx)
  function genRef(){ return `FF-${Math.floor(Math.random()*900000+100000)}`; }
  let txRef = genRef();
  const existingRefs = new Set((data.deposits||[]).map(d => String(d.transactionReference||'').toLowerCase()).filter(Boolean));
  while(existingRefs.has(txRef.toLowerCase())) txRef = genRef();

  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });

  const deposit = {
    id: 'dep-' + Date.now(),
    userId: user.id,
    amount: depositAmount,
    transactionReference: txRef,              // internal FundFlow reference
    paymentReference: paymentReference || null, // virtual account session reference (if any)
    bankTransferReference: bankTransferReference || null, // user-supplied bank narration/reference
    screenshot: screenshot || null,
    status: 'pending',
    statusHistory: [{ status: 'pending', at: Date.now() }],
    createdAt: Date.now(),
    referralProcessed: false,
    backingAccountId: null
  };

  // If this deposit references a virtual session, attach its backingAccountId for traceability
  try{
    if(deposit.paymentReference){
      data.virtualAccounts = data.virtualAccounts || [];
      const va = data.virtualAccounts.find(v => String(v.paymentReference) === String(deposit.paymentReference));
      if(va && va.backingAccountId) deposit.backingAccountId = va.backingAccountId;
    }
  }catch(e){ /* ignore */ }
  // Fallback: if user has an assignedDepositAccountId, use that
  if(!deposit.backingAccountId && user.assignedDepositAccountId) deposit.backingAccountId = user.assignedDepositAccountId;

  data.deposits.push(deposit);
  // create a pending transaction record with backingAccountId included in meta
  recordTransaction(data, { userId: user.id, type: 'deposit', amount: depositAmount, status: 'pending', meta: { depositId: deposit.id, transactionReference: deposit.transactionReference, paymentReference: deposit.paymentReference, bankTransferReference: deposit.bankTransferReference, backingAccountId: deposit.backingAccountId } });
  // notify user that deposit was submitted and include reference in message
  createNotification(data, { userId: user.id, title: 'Deposit submitted', text: `Your deposit request of ₦${depositAmount} was submitted and is pending admin verification. Reference: ${deposit.transactionReference}`, type: 'info' });
  // create an admin notification for dashboard visibility (persistent)
  try{
    createNotification(data, { userId: 'admin', title: 'New deposit submitted', text: `${user.fullName || user.phone || user.id} submitted a deposit of ₦${depositAmount}. Reference: ${deposit.transactionReference}`, type: 'admin' });
  }catch(e){}
  writeData(data);

  res.json({ deposit });
  return;
  // Ensure backingAccountId persisted for this deposit by re-resolving virtual session (edge-case when virtual created in separate request)
  try{
    const refreshed = readData();
    const stored = (refreshed.deposits || []).find(d => d.id === deposit.id);
    if(stored && (!stored.backingAccountId || String(stored.backingAccountId).trim() === '')){
      // try resolve from virtualAccounts
      const va = (refreshed.virtualAccounts || []).find(v => String(v.paymentReference) === String(stored.paymentReference));
      if(va && va.backingAccountId) stored.backingAccountId = va.backingAccountId;
      else if(!stored.backingAccountId && stored.userId){
        const usr = (refreshed.users || []).find(u => u.id === stored.userId);
        if(usr && usr.assignedDepositAccountId) stored.backingAccountId = usr.assignedDepositAccountId;
      }
      // update corresponding transaction meta
      if(stored.backingAccountId && refreshed.transactions){
        refreshed.transactions.forEach(t => {
          if(t.meta && t.meta.depositId === stored.id){
            t.meta = t.meta || {};
            t.meta.backingAccountId = stored.backingAccountId;
          }
        });
      }
      writeData(refreshed);
      return res.json({ deposit: stored });
    }
  }catch(e){ /* ignore */ }

  res.json({ deposit });
});

app.post('/api/vips/buy', authMiddleware, (req, res) => {
  const { planId } = req.body;
  const plan = VIP_PLANS.find((p) => p.id === Number(planId));
  if(!plan) return res.status(400).json({ message: 'Invalid VIP plan' });
  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });
  if(!user.balance || user.balance < plan.deposit) return res.status(400).json({ message: 'Insufficient balance' });
  if(user.activePlan && user.activePlan.status === 'active') return res.status(400).json({ message: 'Only one VIP plan can be active at a time' });
  const now = Date.now();
  // Deduct purchase amount once
  user.balance -= plan.deposit;

  // Create vip purchase record
  data.vipPurchases = data.vipPurchases || [];
  const purchaseId = 'vip-' + Date.now();
  function genVipRef(){ return `VIP-${Math.floor(Math.random()*900000+100000)}`; }
  let vipRef = genVipRef();
  const existingRefs = new Set((data.vipPurchases||[]).map(v=>String(v.ref||'').toLowerCase()));
  while(existingRefs.has(vipRef.toLowerCase())) vipRef = genVipRef();

  const vip = {
    id: purchaseId,
    ref: vipRef,
    userId: user.id,
    planId: plan.id,
    planName: plan.name,
    purchaseAmount: plan.deposit,
    dailyEarning: plan.daily,
    durationDays: 30,
    startedAt: now,
    nextEarningAt: now + 24 * 60 * 60 * 1000,
    daysCompleted: 0,
    status: 'active',
    earnings: []
  };
  data.vipPurchases.push(vip);

  // Attach a lightweight view to the user's activePlan for UI convenience and for backward compatibility
  user.activePlan = {
    purchaseId: vip.id,
    purchaseRef: vip.ref,
    id: plan.id,
    name: plan.name,
    deposit: plan.deposit,
    daily: plan.daily,
    startedAt: vip.startedAt,
    nextPayoutAt: vip.nextEarningAt,
    nextEarningAt: vip.nextEarningAt,
    daysCompleted: 0,
    durationDays: vip.durationDays,
    totalEarned: 0,
    status: 'active'
  };

  // record purchase transaction and create a notification
  recordTransaction(data, { userId: user.id, type: 'vip_purchase', amount: plan.deposit, status: 'approved', meta: { vipPurchaseId: vip.id, vipRef: vip.ref, planId: plan.id } });
  createNotification(data, { userId: user.id, title: 'VIP Purchased', text: `${plan.name} purchased for ₦${plan.deposit}. Your daily reward is ₦${plan.daily}.`, type: 'success' });
  // Admin notification
  try{ createNotification(data, { userId: 'admin', title: 'VIP Purchased', text: `${user.fullName || user.phone || user.id} purchased ${plan.name} for ₦${plan.deposit}. Ref: ${vip.ref}`, type: 'admin' }); }catch(e){}

  writeData(data);
  return res.json({ user: sanitizeUser(user), vip });
});

app.get('/api/vips/purchases', authMiddleware, (req, res) => {
  const data = readData();
  const purchases = (data.vipPurchases || []).filter(v => v.userId === req.user.id);
  res.json({ purchases });
});

// Admin: list all VIP purchases
app.get('/api/admin/vips', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ vipPurchases: data.vipPurchases || [] });
});

app.post('/api/withdrawals', authMiddleware, (req, res) => {
  // New withdrawal flow: accept manual accountName (no mandatory external verification), reserve funds immediately,
  // create a pending withdrawal record, create a pending transaction, and notify user and admin.
  const { amount, bankName, accountNumber, accountName } = req.body || {};
  const withdrawAmount = Number(amount);
  if(!withdrawAmount || withdrawAmount <= 0) return res.status(400).json({ message: 'Invalid withdrawal amount' });
  if(!bankName) return res.status(400).json({ message: 'Bank selection is required' });
  if(!accountNumber || !/^\d{10}$/.test(String(accountNumber))) return res.status(400).json({ message: 'Account number must contain exactly 10 digits' });
  if(!accountName || !String(accountName).trim()) return res.status(400).json({ message: 'Please enter the account name exactly as it appears on the bank account' });
  if(withdrawAmount < 500) return res.status(400).json({ message: 'Minimum withdrawal amount is ₦500' });

  const now = new Date();
  const hour = now.getHours();
  if(hour < 9 || hour >= 21) return res.status(400).json({ message: 'Withdrawals are available only between 9:00 AM and 9:00 PM.' });

  const data = readData();
  const user = findUserById(data, req.user.id);
  if(!user) return res.status(404).json({ message: 'User not found' });

  // Prevent duplicate rapid submissions: if a pending withdrawal with identical details was created recently, reject
  data.withdrawals = data.withdrawals || [];
  const recentDuplicate = (data.withdrawals || []).find(w => w.userId === user.id && w.status === 'pending' && w.amount === withdrawAmount && w.accountNumber === accountNumber && (Date.now() - (w.createdAt || 0)) < 60 * 1000);
  if(recentDuplicate) return res.status(429).json({ message: 'Duplicate withdrawal detected. Please wait a moment before trying again.' });

  // Ensure the user has sufficient available balance (server authoritative check)
  const available = Number(user.balance || 0);
  if(withdrawAmount > available) return res.status(400).json({ message: 'Insufficient balance' });

  const feeRate = resolveWithdrawalFeeRate(data);
  const fee = Number((withdrawAmount * feeRate).toFixed(2));
  const netAmount = Number((withdrawAmount - fee).toFixed(2));

  // Reserve funds immediately to protect the wallet from double-spend
  user.balance = Number(user.balance || 0) - withdrawAmount;

  const ref = `WD-${Math.floor(Math.random()*900000 + 100000)}`;
  const withdrawal = {
    id: 'wd-' + Date.now(),
    ref,
    userId: user.id,
    amount: withdrawAmount,
    fee,
    netAmount,
    bankName,
    accountNumber,
    accountName: String(accountName).trim(),
    status: 'pending',
    reserved: true,
    statusHistory: [{ status: 'pending', at: Date.now() }],
    createdAt: Date.now()
  };

  data.withdrawals.push(withdrawal);
  // create a pending transaction record (debit) with fee breakdown for audit and UI history
  recordTransaction(data, { userId: user.id, type: 'withdrawal', amount: withdrawAmount, status: 'pending', meta: { withdrawalId: withdrawal.id, ref, fee, netAmount } });
  // notify user that withdrawal was submitted
  createNotification(data, { userId: user.id, title: 'Withdrawal submitted', text: `Your withdrawal request of ₦${withdrawAmount} has been submitted and is awaiting administrator approval. Ref: ${ref}`, type: 'info' });
  // create admin notification
  try{ createNotification(data, { userId: 'admin', title: 'Withdrawal submitted', text: `${user.fullName || user.phone || user.id} requested withdrawal of ₦${withdrawAmount}. Ref: ${ref}`, type: 'admin' }); }catch(e){}

  writeData(data);
  res.json({ withdrawal });
});

// Admin routes: view and manage deposits/withdrawals, view transactions and stats
app.get('/api/admin/deposits', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ deposits: data.deposits || [] });
});

// Search deposits by transaction reference (query param: ref)
app.get('/api/admin/deposits/search', adminAuthMiddleware, (req, res) => {
  const ref = String(req.query.ref || '').trim();
  if(!ref) return res.status(400).json({ message: 'Missing ref query parameter' });
  const data = readData();
  const matches = (data.deposits || []).filter(d => {
    if(!d.transactionReference) return false;
    try{
      return String(d.transactionReference).toLowerCase().includes(ref.toLowerCase());
    }catch(e){ return false; }
  });
  res.json({ deposits: matches });
});

app.post('/api/admin/deposits/:id/approve', adminAuthMiddleware, (req, res) => {
  const id = req.params.id;
  const data = readData();
  const deposit = (data.deposits || []).find(d => d.id === id);
  if(!deposit) return res.status(404).json({ message: 'Deposit not found' });
  if(deposit.status === 'approved') return res.status(400).json({ message: 'Deposit already approved' });
  deposit.status = 'approved';
  deposit.statusHistory = deposit.statusHistory || [];
  deposit.statusHistory.push({ status: 'approved', at: Date.now() });
  const user = findUserById(data, deposit.userId);
  if(!user) return res.status(404).json({ message: 'User not found' });
  user.balance = (user.balance || 0) + deposit.amount;
  if(data.transactions) data.transactions.forEach(t => { if(t.meta && t.meta.depositId === deposit.id) t.status = 'approved'; });
  createNotification(data, { userId: deposit.userId, title: 'Deposit approved', text: `Your deposit of ₦${deposit.amount} has been approved and credited to your wallet.`, type: 'success' });

  // Referral reward: credit 5% to the referrer when a referred user's deposit is approved.
  try{
    if(user.referredBy && !deposit.referralProcessed){
      // Protect against self-referral and ensure referrer exists
      if(user.referredBy !== user.id){
        const referrer = findUserById(data, user.referredBy);
        if(referrer){
          // Idempotency: ensure no referral transaction already exists for this deposit
          data.transactions = data.transactions || [];
          const existingReferralTx = (data.transactions || []).some(t => t.type === 'referral' && t.meta && String(t.meta.depositId) === String(deposit.id));
          if(!existingReferralTx){
            const reward = Number(((deposit.amount || 0) * 0.05).toFixed(2));
            if(reward > 0){
              referrer.balance = (referrer.balance || 0) + reward;
              referrer.refEarnings = (referrer.refEarnings || 0) + reward;
              referrer.referrals = (referrer.referrals || 0) + 1;
              // create transaction record for referral earnings (approved immediately)
              recordTransaction(data, { userId: referrer.id, type: 'referral', amount: reward, status: 'approved', meta: { referredUserId: user.id, depositId: deposit.id } });
              createNotification(data, { userId: referrer.id, title: 'Referral reward received', text: `You received ₦${reward} (5% of ₦${deposit.amount}) as referral reward.`, type: 'success' });
              deposit.referralProcessed = true;
            }
          }
        }
      }
    }
  }catch(e){ /* swallow any referral processing errors to avoid blocking deposit approval */ }

  addAuditLog(data, { adminToken: req.admin.token, action: 'approve_deposit', details: { depositId: deposit.id, userId: deposit.userId, amount: deposit.amount } });
  writeData(data);
  res.json({ deposit, user: sanitizeUser(user) });
});

app.post('/api/admin/deposits/:id/reject', adminAuthMiddleware, (req, res) => {
  const id = req.params.id;
  const { reason } = req.body || {};
  const data = readData();
  const deposit = (data.deposits || []).find(d => d.id === id);
  if(!deposit) return res.status(404).json({ message: 'Deposit not found' });
  if(deposit.status === 'rejected') return res.status(400).json({ message: 'Deposit already rejected' });
  deposit.status = 'rejected';
  deposit.statusHistory = deposit.statusHistory || [];
  deposit.statusHistory.push({ status: 'rejected', at: Date.now(), reason: reason || null });
  if(data.transactions) data.transactions.forEach(t => { if(t.meta && t.meta.depositId === deposit.id) t.status = 'rejected'; });
  createNotification(data, { userId: deposit.userId, title: 'Deposit rejected', text: reason || 'Your deposit request was rejected by the administrator.', type: 'warning' });
  addAuditLog(data, { adminToken: req.admin.token, action: 'reject_deposit', details: { depositId: deposit.id, userId: deposit.userId, reason: reason || null } });
  writeData(data);
  res.json({ deposit });
});

app.get('/api/admin/withdrawals', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ withdrawals: data.withdrawals || [] });
});

app.post('/api/admin/withdrawals/:id/approve', adminAuthMiddleware, (req, res) => {
  const id = req.params.id;
  const data = readData();
  const wd = (data.withdrawals || []).find(w => w.id === id);
  if(!wd) return res.status(404).json({ message: 'Withdrawal not found' });
  if(wd.status === 'approved') return res.status(400).json({ message: 'Withdrawal already approved' });
  const user = findUserById(data, wd.userId);
  if(!user) return res.status(404).json({ message: 'User not found' });

  // At submission time funds were reserved (deducted). Do not deduct again here to avoid double-debit.
  wd.status = 'approved';
  wd.statusHistory = wd.statusHistory || [];
  wd.statusHistory.push({ status: 'approved', at: Date.now() });
  if(data.transactions) data.transactions.forEach(t => { if(t.meta && t.meta.withdrawalId === wd.id) t.status = 'approved'; });
  createNotification(data, { userId: wd.userId, title: 'Withdrawal approved', text: `Your withdrawal of ₦${wd.amount} has been approved and is being processed. Ref: ${wd.ref || wd.id}`, type: 'success' });
  addAuditLog(data, { adminToken: req.admin.token, action: 'approve_withdrawal', details: { withdrawalId: wd.id, userId: wd.userId, amount: wd.amount } });
  writeData(data);
  res.json({ withdrawal: wd, user: sanitizeUser(user) });
});

app.post('/api/admin/withdrawals/:id/reject', adminAuthMiddleware, (req, res) => {
  const id = req.params.id;
  const { reason } = req.body || {};
  const data = readData();
  const wd = (data.withdrawals || []).find(w => w.id === id);
  if(!wd) return res.status(404).json({ message: 'Withdrawal not found' });
  if(wd.status === 'rejected') return res.status(400).json({ message: 'Withdrawal already rejected' });
  const user = findUserById(data, wd.userId);
  if(!user) return res.status(404).json({ message: 'User not found' });

  // Restore reserved funds if they were deducted at submission time
  if(wd.reserved){
    user.balance = Number(user.balance || 0) + Number(wd.amount || 0);
    wd.reserved = false;
  }

  wd.status = 'rejected';
  wd.statusHistory = wd.statusHistory || [];
  wd.statusHistory.push({ status: 'rejected', at: Date.now(), reason: reason || null });

  // Update related transactions to rejected
  if(data.transactions) data.transactions.forEach(t => { if(t.meta && t.meta.withdrawalId === wd.id) t.status = 'rejected'; });

  // Create a reversal/credit transaction to reflect funds returned to the wallet
  recordTransaction(data, { userId: wd.userId, type: 'withdrawal_rejected', amount: Number(wd.amount || 0), status: 'completed', meta: { withdrawalId: wd.id } });

  createNotification(data, { userId: wd.userId, title: 'Withdrawal rejected', text: reason || 'Your withdrawal request was rejected by the administrator. Funds have been returned to your wallet.', type: 'warning' });
  addAuditLog(data, { adminToken: req.admin.token, action: 'reject_withdrawal', details: { withdrawalId: wd.id, userId: wd.userId, reason: reason || null } });
  writeData(data);
  res.json({ withdrawal: wd });
});

// Transactions and stats endpoints
app.get('/api/transactions', authMiddleware, (req, res) => {
  const data = readData();
  const txs = (data.transactions || []).filter(t => t.userId === req.user.id);
  res.json({ transactions: txs });
});

app.get('/api/admin/transactions', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ transactions: data.transactions || [] });
});

app.get('/api/admin/users', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ users: (data.users || []).map(user => sanitizeUser(user)) });
});

app.get('/api/admin/deposit-accounts', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ accounts: data.depositAccounts || DEFAULT_DEPOSIT_ACCOUNTS });
});

app.post('/api/admin/deposit-accounts', adminAuthMiddleware, (req, res) => {
  const { accountId, status } = req.body || {};
  const data = readData();
  const target = (data.depositAccounts || []).find(account => account.id === accountId);
  if(!target) return res.status(404).json({ message: 'Deposit account not found' });
  target.status = status || target.status;
  writeData(data);
  res.json({ account: target });
});

app.get('/api/admin/announcements', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ announcements: data.announcements || [] });
});

app.post('/api/admin/announcements', adminAuthMiddleware, (req, res) => {
  const { title, message, type = 'info' } = req.body || {};
  if(!title || !message) return res.status(400).json({ message: 'Title and message are required' });
  const data = readData();
  const announcement = { id: 'ann-' + Date.now(), title, message, type, createdAt: Date.now() };
  data.announcements = data.announcements || [];
  data.announcements.push(announcement);
  writeData(data);
  res.json({ announcement });
});

app.get('/api/admin/stats', adminAuthMiddleware, (req, res) => {
  const data = readData();
  const totalDeposits = (data.deposits || []).reduce((s,d)=>s+(d.amount||0),0);
  const totalWithdrawals = (data.withdrawals || []).reduce((s,w)=>s+(w.amount||0),0);
  const totalBalances = (data.users || []).reduce((s,u)=>s+(u.balance||0),0);
  const pendingDeposits = (data.deposits || []).filter(d => d.status !== 'approved' && d.status !== 'rejected').length;
  const pendingWithdrawals = (data.withdrawals || []).filter(w => w.status !== 'approved' && w.status !== 'rejected').length;
  const totalRevenue = totalDeposits;
  res.json({ totalDeposits, totalWithdrawals, totalBalances, users: (data.users||[]).length, pendingDeposits, pendingWithdrawals, totalRevenue });
});

app.get('/api/admin/verify', adminAuthMiddleware, (req, res) => {
  res.json({ ok: true, message: 'Admin access verified' });
});

// Admin: list virtual deposit sessions for reconciliation
app.get('/api/admin/virtual-accounts', adminAuthMiddleware, (req, res) => {
  const data = readData();
  res.json({ virtualAccounts: data.virtualAccounts || [] });
});

// Admin: notifications for admin dashboard
app.get('/api/admin/notifications', adminAuthMiddleware, (req, res) => {
  const data = readData();
  const notes = (data.notifications || []).filter(n => String(n.userId) === 'admin' || !n.userId || String(n.type) === 'admin');
  res.json({ notifications: notes });
});

// Server-side admin login: accepts token and sets a secure httpOnly cookie for the admin session.
app.post('/api/admin/login', (req, res) => {
  const token = req.body && req.body.token;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'chinex002';
  if(!token || token !== ADMIN_TOKEN) return res.status(401).json({ message: 'Invalid admin token' });
  // Set a short-lived httpOnly cookie to establish the admin session
  res.cookie('ff_admin', ADMIN_TOKEN, { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
  res.json({ ok: true, message: 'Admin session created' });
});

// Admin logout: clear admin cookie
app.post('/api/admin/logout', adminAuthMiddleware, (req, res) => {
  res.clearCookie('ff_admin');
  res.json({ ok: true, message: 'Admin session cleared' });
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/admin', adminAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  if(req.path.startsWith('/api/')){
    return res.status(404).json({ message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Background processor: VIP earnings processor
function processVipEarnings(){
  try{
    const data = readData();
    let changed = false;
    // iterate users and apply payouts where due
    (data.users || []).forEach(user => {
      try{
        if(applyPayouts(data, user)) changed = true;
      }catch(e){ console.error('VIP payout error for user', user && user.id, e); }
    });
    if(changed) writeData(data);
  }catch(e){ console.error('VIP earnings processor failed', e); }
}

// Run every minute to pick up due VIP earnings (safe and idempotent)
setInterval(processVipEarnings, 60 * 1000);
// Run once at startup
processVipEarnings();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FundFlow backend running on http://localhost:${port}`));
