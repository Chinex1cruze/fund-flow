document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  if(!user){ location.href = 'login.html'; return; }

  const greetingEl = document.getElementById('dashboard-greeting');
  const userNameEl = document.getElementById('dashboard-user-name');
  const walletCardsEl = document.getElementById('wallet-cards');
  const vipCountdownContentEl = document.getElementById('vip-countdown-content');
  const announcementBannerEl = document.getElementById('announcement-banner');
  const announcementContentEl = document.getElementById('announcement-content');
  const notificationCountEl = document.getElementById('notification-count');
  const activePlanEl = document.getElementById('active-plan-details');
  const transactionsListEl = document.getElementById('transactions-list');
  const profilePic = document.getElementById('user-profile-picture');
  if(profilePic) profilePic.src = user.profilePicture || 'assets/logo/fund_flow.jpeg';

  const roundedGreeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening';
  if(greetingEl) greetingEl.textContent = roundedGreeting;
  if(userNameEl) userNameEl.textContent = user.fullName || 'FundFlow User';

  let currentUser = user;
  try {
    const fresh = await api.getMe();
    if(fresh && fresh.user) {
      currentUser = fresh.user;
      saveUser(currentUser);
    }
  } catch (err) {
    console.warn('Using cached user state.', err);
  }

  function formatMoney(value){
    return `₦${formatN(value || 0)}`;
  }

  function renderWalletCards(data){
    const cards = [
      { label: 'Available Balance', value: formatMoney(data.balance || 0), type: 'balance' },
      { label: "Today's Earnings", value: formatMoney(data.earnings || 0), type: 'earnings' },
      { label: 'Referral Earnings', value: formatMoney(data.refEarnings || 0), type: 'referral' },
      { label: 'Active VIP Plan', value: data.activePlan ? data.activePlan.name : 'No active plan', type: 'vip' }
    ];

    walletCardsEl.innerHTML = cards.map((card) => {
      const isBalance = card.type === 'balance';
      if(isBalance){
        return `
          <article class="wallet-card">
            <div>
              <div class="muted">${card.label}</div>
              <div class="balance-amount balance-value" data-balance-scale="balance">${card.value}</div>
              <div style="margin-top:10px; display:flex; gap:8px;">
                <button class="btn outline balance-toggle" id="toggle-balance-btn" type="button">Hide</button>
                <a href="deposit.html" class="btn primary" style="display:inline-block;">Add Money</a>
                <a href="transactions.html" class="btn ghost" style="display:inline-block;">Transactions</a>
              </div>
            </div>
          </article>`;
      }
      return `
        <article class="wallet-card">
          <div class="dashboard-wallet-inline">
            <div>
              <div class="muted">${card.label}</div>
              <div class="balance-amount ${card.type === 'referral' ? '' : ''}" data-balance-scale="other">${card.value}</div>
            </div>
          </div>
        </article>`;
    }).join('');

    const balanceToggle = document.getElementById('toggle-balance-btn');
    if(balanceToggle){
      balanceToggle.addEventListener('click', () => {
        const shouldShow = balanceToggle.dataset.hidden === 'true';
        balanceToggle.dataset.hidden = shouldShow ? 'false' : 'true';
        balanceToggle.textContent = shouldShow ? 'Hide Balance' : 'Show Balance';
          document.querySelectorAll('[data-balance-scale="balance"]').forEach((el) => {
          el.classList.toggle('masked', !shouldShow);
          el.textContent = shouldShow ? formatMoney(data.balance || 0) : '••••••';
        });
      });
    }
  }

  function renderAnnouncements(items){
    const list = items || [];
    if(!list.length){
      announcementBannerEl.classList.add('hidden');
      return;
    }
    announcementBannerEl.classList.remove('hidden');
    announcementContentEl.innerHTML = list.map((item) => `<div><strong>${item.title || 'FundFlow Update'}</strong> <div>${item.message || ''}</div></div>`).join('');
  }

  function renderVipCountdown(data){
    if(!vipCountdownContentEl) return;
    if(!data.activePlan){
      vipCountdownContentEl.innerHTML = '<div class="muted">No active VIP plan. Purchase one from the VIP page to start earning daily rewards.</div>';
      return;
    }

    const nextPayoutAt = Number(data.activePlan.nextPayoutAt) || Date.now();
    vipCountdownContentEl.innerHTML = `
      <div class="vip-countdown-card">
        <div class="row" style="align-items:center; gap:12px;">
          <div>
            <div><strong>${data.activePlan.name}</strong></div>
            <div class="muted">Daily reward: ${formatMoney(data.activePlan.daily || 0)}</div>
          </div>
          <div>
            <div class="muted">Next payout in</div>
            <div id="vip-countdown-timer" class="countdown-timer">00:00:00</div>
          </div>
        </div>
      </div>`;

    const timerEl = document.getElementById('vip-countdown-timer');
    if(timerEl && typeof startCountdown === 'function'){
      startCountdown(nextPayoutAt, timerEl, async () => {
        try {
          const fresh = await api.getMe();
          if(fresh && fresh.user){
            currentUser = fresh.user;
            saveUser(currentUser);
            renderWalletCards(currentUser);
            renderActivePlan(currentUser);
            renderVipCountdown(currentUser);
          }
        } catch (error) {
          console.error('Error refreshing VIP countdown after payout', error);
        }
      });
    }
  }

  function renderTransactions(items){
    const list = (items || []).slice(0, 6);
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
              <div class="muted">${new Date(transaction.createdAt || Date.now()).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="transaction-right">
            <div class="transaction-amount ${amountClass}">${sign}${formatMoney(transaction.amount || 0)}</div>
            <div class="muted">${transaction.status || 'pending'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderActivePlan(data){
    if(!data.activePlan){
      activePlanEl.innerHTML = '<div class="muted">No active VIP plan. Buy one from the VIP page.</div>';
      return;
    }
    activePlanEl.innerHTML = `<div><strong>${data.activePlan.name}</strong></div><div class="muted">Daily reward: ${formatMoney(data.activePlan.daily || 0)}</div>`;
  }

  async function loadDashboardData(){
    const [transactionsRes, announcementsRes, notificationsRes, referralsRes] = await Promise.all([
      api.getTransactions(),
      api.getAnnouncements(),
      api.getNotifications(),
      api.getReferrals()
    ]);

    renderWalletCards(currentUser);
    renderAnnouncements(announcementsRes.announcements || []);
    renderVipCountdown(currentUser);
    renderActivePlan(currentUser);
    renderTransactions(transactionsRes.transactions || []);
    notificationCountEl.textContent = (notificationsRes.notifications || []).length;
    // render referrals panel
    const referralsData = referralsRes || {};
    const referralContentEl = document.getElementById('referral-content');
    if(referralContentEl){
      const code = referralsData.referralCode || '—';
      const link = referralsData.referralLink || (window.location.origin + `/register.html?ref=${encodeURIComponent(code)}`);
      const totalReferrals = referralsData.totalReferrals || 0;
      const totalReferralEarnings = referralsData.totalReferralEarnings || 0;
      const recentHistory = referralsData.history || [];
      referralContentEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <div style="flex:1;min-width:120px;max-width:100%;"><div class="muted">Referral code</div><div style="font-weight:700">${code}</div></div>
            <div style="flex:2;min-width:120px;max-width:100%;"><div class="muted">Referral link</div><div style="word-break:break-all">${link}</div></div>
            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
              <button class="btn" id="copy-ref-link">Copy</button>
              <button class="btn ghost" id="share-ref-link">Share</button>
            </div>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <div class="note-panel" style="padding:10px;min-width:140px;"><div class="muted">Total referrals</div><div style="font-weight:700">${totalReferrals}</div></div>
            <div class="note-panel" style="padding:10px;min-width:160px;"><div class="muted">Referral earnings</div><div style="font-weight:700">₦${formatN(totalReferralEarnings)}</div></div>
          </div>
          <div>
            <h4>Recent referral rewards</h4>
            <div id="ref-history" style="max-height:220px;overflow:auto;">
              ${recentHistory.length ? recentHistory.map(h => `<div style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.02);"><div><strong>₦${formatN(h.amount)}</strong> <span class="muted">${new Date(h.createdAt||Date.now()).toLocaleString()}</span></div><div class="muted">Ref. deposit: ${h.meta && h.meta.depositId ? h.meta.depositId : '—'}</div></div>`).join('') : '<div class="muted">No referral rewards yet.</div>'}
            </div>
          </div>
        </div>
      `;

      document.getElementById('copy-ref-link')?.addEventListener('click', () => {
        navigator.clipboard.writeText(link).then(()=> showToast('Referral link copied', 'success')).catch(()=> showToast('Unable to copy', 'error'));
      });
      document.getElementById('share-ref-link')?.addEventListener('click', () => {
        if(navigator.share){
          navigator.share({ title: 'Join FundFlow', text: 'Join FundFlow and earn rewards', url: link }).catch(()=>{});
        }else{
          navigator.clipboard.writeText(link).then(()=> showToast('Referral link copied', 'success')).catch(()=> showToast('Unable to copy', 'error'));
        }
      });
    }
   // render notifications list for modal
   const notificationsListEl = document.getElementById('notifications-list');
   if(notificationsListEl){
     const notifs = (notificationsRes.notifications || []).slice(0, 50);
     notificationsListEl.innerHTML = notifs.length ? notifs.map(n => `
       <article class="note-panel" style="padding:8px; margin-bottom:8px;">
         <div><strong>${n.title || 'Notification'}</strong></div>
         <div class="muted">${n.text || ''}</div>
         <div class="muted" style="font-size:12px; margin-top:6px;">${new Date(n.createdAt || Date.now()).toLocaleString()}</div>
       </article>
     `).join('') : '<div class="muted">No notifications yet.</div>';
   }
  }
 
  await loadDashboardData();

  // Notifications modal wiring
  const notificationsButton = document.getElementById('notifications-button');
  const notificationsModal = document.getElementById('notifications-modal');
  const notificationsModalClose = document.getElementById('notifications-modal-close');
  notificationsButton?.addEventListener('click', () => { if(notificationsModal) notificationsModal.classList.remove('hidden'); });
  notificationsModalClose?.addEventListener('click', () => { if(notificationsModal) notificationsModal.classList.add('hidden'); });

  // Mobile bottom nav notifications open
  document.getElementById('open-notifications-mobile')?.addEventListener('click', (e) => { e.preventDefault(); if(notificationsModal) notificationsModal.classList.remove('hidden'); });

  const communityModal = document.getElementById('community-modal');
  const shouldShowCommunity = localStorage.getItem('ff_show_community') === '1' && !localStorage.getItem('ff_community_dismissed');
  if(communityModal && shouldShowCommunity){
    communityModal.classList.remove('hidden');
  }

  const closeModal = () => {
    communityModal?.classList.add('hidden');
    localStorage.setItem('ff_community_dismissed', '1');
    localStorage.removeItem('ff_show_community');
  };

  document.getElementById('community-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('dismiss-community')?.addEventListener('click', closeModal);
  communityModal?.addEventListener('click', (event) => {
    if(event.target === communityModal) closeModal();
  });

  // Keep bottom-nav active state in sync
  document.querySelectorAll('.bottom-nav .nav-item').forEach(a => {
    try{ if(location.pathname.endsWith(a.getAttribute('href'))) a.classList.add('active'); }catch(e){}
  });

});
