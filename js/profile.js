document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth();
  const profileNameEl = document.getElementById('profile-name');
  const profilePhoneEl = document.getElementById('profile-phone');
  const profileBalanceEl = document.getElementById('profile-balance');
  const profileReferralCodeEl = document.getElementById('profile-referral-code');
  const profileReferralLinkEl = document.getElementById('profile-referral-link');
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

    const labels = {
      deposit: {
        pending: 'Deposit Submitted',
        approved: 'Deposit Approved',
        rejected: 'Deposit Rejected'
      },
      withdrawal: {
        pending: 'Withdrawal Requested',
        approved: 'Withdrawal Approved',
        rejected: 'Withdrawal Rejected'
      },
      wallet_credit: 'Wallet Credit',
      wallet_debit: 'Wallet Debit',
      referral_earnings: 'Referral Earnings',
      vip_purchase: 'VIP Purchase',
      welcome_bonus: 'Welcome Bonus'
    };

    transactionsListEl.innerHTML = list.map((transaction) => {
      const type = transaction.type || 'transaction';
      const status = String(transaction.status || 'pending').toLowerCase();
      let label = labels[type] || transaction.type || 'Transaction';
      if(typeof label === 'object'){
        label = label[status] || label.pending || transaction.type || 'Transaction';
      }
      const icon = type === 'deposit' ? '💳' : type === 'withdrawal' ? '🏦' : type === 'referral_earnings' ? '🎁' : type === 'vip_purchase' ? '⭐' : type === 'wallet_debit' ? '➖' : type === 'wallet_credit' ? '➕' : '✨';
      const amountClass = ['withdrawal','wallet_debit'].includes(type) ? 'negative' : 'positive';
      const sign = ['withdrawal','wallet_debit'].includes(type) ? '-' : '+';
      const reference = transaction.meta && (transaction.meta.transactionReference || transaction.meta.depositId || transaction.meta.withdrawalId || transaction.meta.reference);
      return `
        <div class="transaction-row">
          <div class="transaction-left">
            <div class="transaction-icon">${icon}</div>
            <div class="transaction-meta">
              <strong>${label}</strong>
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
    if(profileReferralCodeEl) profileReferralCodeEl.textContent = currentUser.referralCode || 'N/A';
    if(profileReferralLinkEl) profileReferralLinkEl.innerHTML = currentUser.referralLink ? `<a href="${currentUser.referralLink}" target="_blank" rel="noreferrer">${currentUser.referralLink}</a>` : 'N/A';
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
