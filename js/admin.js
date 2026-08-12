document.addEventListener('DOMContentLoaded', async () => {
  // Verify server-side admin session (cookie) before loading. If not authenticated, redirect to login.
  try {
    const res = await fetch('/api/admin/verify');
    if(!res.ok){ location.href = 'admin-login.html'; return; }
  } catch (e) { location.href = 'admin-login.html'; return; }

  const tokenInput = document.getElementById('admin-token');
  const statsGrid = document.getElementById('stats-grid');
  const depositsList = document.getElementById('deposits-list');
  const withdrawalsList = document.getElementById('withdrawals-list');
  const usersList = document.getElementById('users-list');
  const transactionsList = document.getElementById('transactions-list');
  const depositAccountsList = document.getElementById('deposit-accounts-list');
  const announcementsList = document.getElementById('announcements-list');
  const createAnnouncementBtn = document.getElementById('create-announcement');

  // Do not rely on localStorage for admin session in production. Server establishes a secure httpOnly cookie.

  async function adminFetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const adminToken = (tokenInput?.value || '').trim();
    if(adminToken) headers['x-admin-token'] = adminToken; // allow override if provided in the UI
    const res = await fetch(url, {
      headers,
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){ throw new Error(data.message || 'Admin request failed'); }
    return data;
  }

  function createStatCard(label, value) {
    return `
      <div class="wallet-card">
        <div class="muted">${label}</div>
        <div class="balance-value" style="font-size:22px; margin-top:10px;">${value}</div>
      </div>
    `;
  }

  function renderDeposits(items) {
    const list = items || [];
    if(!list.length){
      depositsList.innerHTML = '<div class="muted">No pending deposit requests found.</div>';
      return;
    }
    depositsList.innerHTML = list.map((item) => `
      <article class="note-panel card" style="margin:12px 0;">
        <div><strong>${item.id}</strong></div>
        <div class="muted">User ID: ${item.userId}</div>
        <div class="muted">Amount: ₦${formatN(item.amount)}</div>
        <div class="muted">FundFlow Ref: ${item.transactionReference || '—'}</div>
        <div class="muted">Payment Ref: ${item.paymentReference || '—'}</div>
        <div class="muted">Bank Transfer Ref: ${item.bankTransferReference || '—'}</div>
        <div class="muted">Status: ${item.status || 'pending'}</div>
        <div class="button-row">
          <button class="btn primary" data-action="approve-deposit" data-id="${item.id}">Approve</button>
          <button class="btn ghost" data-action="reject-deposit" data-id="${item.id}">Reject</button>
        </div>
      </article>
    `).join('');
  }

  function renderWithdrawals(items) {
    const list = items || [];
    if(!list.length){
      withdrawalsList.innerHTML = '<div class="muted">No pending withdrawal requests found.</div>';
      return;
    }
    withdrawalsList.innerHTML = list.map((item) => `
      <article class="note-panel card" style="margin:12px 0;">
        <div><strong>${item.id}</strong></div>
        <div class="muted">User ID: ${item.userId}</div>
        <div class="muted">Amount: ₦${formatN(item.amount)}</div>
        <div class="muted">Bank: ${item.bankName}</div>
        <div class="muted">Account: ${item.accountNumber}</div>
        <div class="muted">Status: ${item.status || 'pending'}</div>
        <div class="button-row">
          <button class="btn primary" data-action="approve-withdrawal" data-id="${item.id}">Approve</button>
          <button class="btn ghost" data-action="reject-withdrawal" data-id="${item.id}">Reject</button>
        </div>
      </article>
    `).join('');
  }

  function renderUsers(items) {
    const list = items || [];
    if(!list.length){
      usersList.innerHTML = '<div class="muted">No users found.</div>';
      return;
    }
    usersList.innerHTML = list.map((user) => `
      <article class="note-panel card" style="margin:12px 0;">
        <div><strong>${user.fullName || 'User'}</strong></div>
        <div class="muted">Phone: ${user.phone || '—'}</div>
        <div class="muted">Balance: ₦${formatN(user.balance || 0)}</div>
        <div class="muted">VIP: ${user.activePlan ? user.activePlan.name : 'No active plan'}</div>
      </article>
    `).join('');
  }

  function renderTransactions(items) {
    const list = items || [];
    if(!list.length){
      transactionsList.innerHTML = '<div class="muted">No transactions found.</div>';
      return;
    }
    transactionsList.innerHTML = list.slice(0, 8).map((transaction) => `
      <article class="note-panel card" style="margin:12px 0;">
        <div><strong>${transaction.type || 'transaction'}</strong></div>
        <div class="muted">Amount: ₦${formatN(transaction.amount || 0)}</div>
        <div class="muted">Status: ${transaction.status || 'pending'}</div>
        <div class="muted">Created: ${new Date(transaction.createdAt || Date.now()).toLocaleString()}</div>
      </article>
    `).join('');
  }

  function renderDepositAccounts(items) {
    const list = items || [];
    if(!list.length){
      depositAccountsList.innerHTML = '<div class="muted">No deposit account records found.</div>';
      return;
    }
    depositAccountsList.innerHTML = list.map((account) => `
      <article class="note-panel card" style="margin:12px 0;">
        <div><strong>${account.bankName}</strong></div>
        <div class="muted">Account Number: ${account.accountNumber}</div>
        <div class="muted">Account Name: ${account.accountName}</div>
        <div class="muted">Status: ${account.status || 'active'}</div>
        <div class="button-row">
          <button class="btn ghost" data-account-status="${account.status === 'disabled' ? 'active' : 'disabled'}" data-account-id="${account.id}">${account.status === 'disabled' ? 'Enable' : 'Disable'}</button>
        </div>
      </article>
    `).join('');
  }

  function renderAnnouncements(items) {
    const list = items || [];
    if(!list.length){
      announcementsList.innerHTML = '<div class="muted">No announcements published.</div>';
      return;
    }
    announcementsList.innerHTML = list.map((item) => `
      <article class="note-panel card" style="margin:12px 0;">
        <div><strong>${item.title}</strong></div>
        <div class="muted">${item.message}</div>
      </article>
    `).join('');
  }

  async function loadQueue() {
    try {
      const [stats, deposits, withdrawals, users, accounts, announcements, transactions] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/deposits'),
        adminFetch('/api/admin/withdrawals'),
        adminFetch('/api/admin/users'),
        adminFetch('/api/admin/deposit-accounts'),
        adminFetch('/api/admin/announcements'),
        adminFetch('/api/admin/transactions')
      ]);

      statsGrid.innerHTML = [
        createStatCard('Total Users', stats.users || 0),
        createStatCard('Total Deposits', `₦${formatN(stats.totalDeposits || 0)}`),
        createStatCard('Total Withdrawals', `₦${formatN(stats.totalWithdrawals || 0)}`),
        createStatCard('Pending Deposits', stats.pendingDeposits || 0),
        createStatCard('Pending Withdrawals', stats.pendingWithdrawals || 0),
        createStatCard('Total Revenue', `₦${formatN(stats.totalRevenue || 0)}`)
      ].join('');

      renderDeposits((deposits.deposits || []).filter(d => d.status !== 'approved' && d.status !== 'rejected'));
      renderWithdrawals((withdrawals.withdrawals || []).filter(w => w.status !== 'approved' && w.status !== 'rejected'));
      renderUsers(users.users || []);
      renderDepositAccounts(accounts.accounts || []);
      renderAnnouncements(announcements.announcements || []);
      renderTransactions(transactions.transactions || []);
    } catch (err) {
      showToast(err.message || 'Failed to load admin queue', 'error');
    }
  }

  document.addEventListener('click', async (e) => {
    const accountToggle = e.target.closest('button[data-account-id]');
    if(accountToggle){
      try {
        const accountId = accountToggle.dataset.accountId;
        const status = accountToggle.dataset.accountStatus;
        await adminFetch('/api/admin/deposit-accounts', {
          method: 'POST',
          body: JSON.stringify({ accountId, status })
        });
        showToast('Deposit account status updated.', 'success');
        await loadQueue();
      } catch (err) {
        showToast(err.message || 'Unable to update deposit account', 'error');
      }
      return;
    }

    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if(!id) return;

    let reason = '';
    if(action.includes('reject')) {
      reason = window.prompt('Enter rejection reason:') || '';
      if(!reason.trim()) {
        showToast('A rejection reason is required.', 'warning');
        return;
      }
    }

    let endpoint = '';
    if(action === 'approve-deposit') endpoint = `/api/admin/deposits/${id}/approve`;
    if(action === 'reject-deposit') endpoint = `/api/admin/deposits/${id}/reject`;
    if(action === 'approve-withdrawal') endpoint = `/api/admin/withdrawals/${id}/approve`;
    if(action === 'reject-withdrawal') endpoint = `/api/admin/withdrawals/${id}/reject`;

    try {
      const options = { method: 'POST' };
      if(action.includes('reject')) {
        options.body = JSON.stringify({ reason });
      }
      await adminFetch(endpoint, options);
      showToast(`${action.replace('-', ' ')} completed.`, 'success');
      await loadQueue();
    } catch (err) {
      showToast(err.message || 'Admin action failed', 'error');
    }
  });

  createAnnouncementBtn?.addEventListener('click', async () => {
    const title = document.getElementById('announcement-title')?.value.trim();
    const message = document.getElementById('announcement-message')?.value.trim();
    if(!title || !message){
      showToast('Both title and message are required', 'warning');
      return;
    }
    try {
      await adminFetch('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, message, type: 'info' })
      });
      document.getElementById('announcement-title').value = '';
      document.getElementById('announcement-message').value = '';
      await loadQueue();
      showToast('Announcement created.', 'success');
    } catch (err) {
      showToast(err.message || 'Unable to create announcement', 'error');
    }
  });

  await loadQueue();
});
