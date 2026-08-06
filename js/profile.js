document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth();
  const profileNameEl = document.getElementById('profile-name');
  const profilePhoneEl = document.getElementById('profile-phone');
  const profileBalanceEl = document.getElementById('profile-balance');
  const transactionsListEl = document.getElementById('profile-transactions');

  function formatMoney(value){
    return `₦${formatN(value || 0)}`;
  }

  function renderTransactions(items){
    if(!transactionsListEl) return;
    const list = (items || []).sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    if(!list.length){
      transactionsListEl.innerHTML = '<div class="muted">No transactions yet.</div>';
      return;
    }

    transactionsListEl.innerHTML = list.map((transaction) => {
      const type = transaction.type || 'transaction';
      const icon = type === 'deposit' ? '💳' : type === 'withdrawal' ? '🏦' : '✨';
      const amountClass = type === 'withdrawal' ? 'negative' : 'positive';
      const sign = type === 'withdrawal' ? '-' : '+';
      return `
        <div class="transaction-row">
          <div class="transaction-left">
            <div class="transaction-icon">${icon}</div>
            <div class="transaction-meta">
              <strong>${type}</strong>
              <div class="muted">${new Date(transaction.createdAt || Date.now()).toLocaleString()}</div>
            </div>
          </div>
          <div class="transaction-right">
            <div class="transaction-amount ${amountClass}">${sign}${formatMoney(transaction.amount || 0)}</div>
            <div class="muted">${transaction.status || 'pending'}</div>
          </div>
        </div>`;
    }).join('');
  }

  try {
    const me = await api.getMe();
    const currentUser = (me && me.user) ? me.user : user;
    if(profileNameEl) profileNameEl.textContent = currentUser.fullName || 'FundFlow User';
    if(profilePhoneEl) profilePhoneEl.textContent = currentUser.phone || 'N/A';
    if(profileBalanceEl) profileBalanceEl.textContent = formatMoney(currentUser.balance || 0);
  } catch (err) {
    console.warn('Unable to refresh profile information', err);
    if(profileNameEl) profileNameEl.textContent = user.fullName || 'FundFlow User';
    if(profilePhoneEl) profilePhoneEl.textContent = user.phone || 'N/A';
    if(profileBalanceEl) profileBalanceEl.textContent = formatMoney(user.balance || 0);
  }

  try {
    const txRes = await api.getTransactions();
    renderTransactions(txRes.transactions || []);
  } catch (err) {
    console.error('Unable to load transaction history', err);
    if(transactionsListEl) transactionsListEl.innerHTML = '<div class="muted">Unable to load transactions at this time.</div>';
  }
});
