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
      const labelMap = {
        deposit: 'Deposit Submitted',
        withdrawal: 'Withdrawal Submitted',
        referral_earnings: 'Referral Earnings',
        vip_purchase: 'VIP Purchase',
        welcome_bonus: 'Welcome Bonus',
        wallet_credit: 'Wallet Credit',
        wallet_debit: 'Wallet Debit'
      };
      const title = labelMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const reference = transaction.meta?.transactionReference || transaction.meta?.reference || transaction.transactionReference || transaction.meta?.depositReference || '';
      return `
          <div class="transaction-row">
            <div class="transaction-left">
              <div class="transaction-icon">${icon}</div>
              <div class="transaction-meta">
                <strong>${title}</strong>
                <div class="muted">${new Date(transaction.createdAt || Date.now()).toLocaleString()}</div>
                ${reference ? `<div class="muted">Reference: ${reference}</div>` : ''}
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
    const referralCode = currentUser.referralCode || currentUser.id || '';
    const referralLink = referralCode ? `${location.origin}/register.html?ref=${encodeURIComponent(referralCode)}` : '';
    document.getElementById('profile-ref-code')?.textContent = referralCode || 'N/A';
    const refLinkEl = document.getElementById('profile-ref-link');
    if(refLinkEl){
      if(referralLink){
        refLinkEl.innerHTML = `<a href="${referralLink}" target="_blank" rel="noopener">${referralLink}</a>`;
      } else {
        refLinkEl.textContent = 'N/A';
      }
    }
  } catch (err) {
    console.warn('Unable to refresh profile information', err);
    if(profileNameEl) profileNameEl.textContent = user.fullName || 'FundFlow User';
    if(profilePhoneEl) profilePhoneEl.textContent = user.phone || 'N/A';
    if(profileBalanceEl) profileBalanceEl.textContent = formatMoney(user.balance || 0);
    const referralCode = user.referralCode || user.id || '';
    const referralLink = referralCode ? `${location.origin}/register.html?ref=${encodeURIComponent(referralCode)}` : '';
    document.getElementById('profile-ref-code')?.textContent = referralCode || 'N/A';
    const refLinkEl = document.getElementById('profile-ref-link');
    if(refLinkEl){
      if(referralLink){
        refLinkEl.innerHTML = `<a href="${referralLink}" target="_blank" rel="noopener">${referralLink}</a>`;
      } else {
        refLinkEl.textContent = 'N/A';
      }
    }
  }
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
