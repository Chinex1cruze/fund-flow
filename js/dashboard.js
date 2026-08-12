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
    // Compact premium balance card + action row + small stats
    const balance = formatMoney(data.balance || 0);
    const earnings = formatMoney(data.earnings || 0);
    const referral = formatMoney(data.refEarnings || 0);

    walletCardsEl.innerHTML = `
      <article class="wallet-card balance-card-compact">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
              <div class="muted">Available balance</div>
              <div class="balance-amount balance-value" data-balance-scale="balance">${balance}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              <button class="icon-pill eye-button" id="toggle-balance-btn" type="button" aria-label="Toggle balance">👁️</button>
            </div>
          </div>

          <div class="dashboard-action-row" style="display:flex;gap:10px;flex-wrap:wrap">
            <a href="deposit.html" class="btn primary">+ Add Money</a>
            <a href="withdraw.html" class="btn outline">Withdraw</a>
            <a href="transactions.html" class="btn ghost">Transactions</a>
          </div>

          <div class="compact-stats" style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="note-panel" style="padding:10px;min-width:120px;flex:1;">
              <div class="muted">Today's Earnings</div>
              <div style="font-weight:700;font-size:16px">${earnings}</div>
            </div>
            <div class="note-panel" style="padding:10px;min-width:120px;flex:1;">
              <div class="muted">Referral Earnings</div>
              <div style="font-weight:700;font-size:16px">${referral}</div>
            </div>
          </div>
        </div>
      </article>`;

    // Masking logic
    const balanceToggle = document.getElementById('toggle-balance-btn');
    const balanceEls = document.querySelectorAll('[data-balance-scale="balance"]');
    let isHidden = false;
    // initialize masked state if CSS class present
    balanceEls.forEach(el => { if(el.classList.contains('masked')) isHidden = true; });

    if(balanceToggle){
      balanceToggle.addEventListener('click', () => {
        isHidden = !isHidden;
        balanceEls.forEach((el) => {
          if(isHidden){
            el.classList.add('masked');
            el.dataset.hidden = 'true';
            el.textContent = '₦••••••';
            balanceToggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7z" stroke="#fde68a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" stroke="#fde68a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          } else {
            el.classList.remove('masked');
            el.dataset.hidden = 'false';
            el.textContent = balance;
            balanceToggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.94 17.94L6.06 6.06" stroke="#111827" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.59 13.41a3 3 0 004.24-4.24" stroke="#111827" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          }
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
      // use SVG icons for consistency and premium look
      const iconSvg = type === 'deposit' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#fde68a" stroke-width="1.1"/></svg>'
        : type === 'withdrawal' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" stroke="#fde68a" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 12h10" stroke="#fde68a" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l2.6 5.9L20 9l-4 3.4L17 20l-5-3-5 3 1-7.6L2 9l5.4-1.1L12 2z" stroke="#fde68a" stroke-width="0.9" fill="rgba(251,191,36,0.04)"/></svg>';
      const amountClass = type === 'withdrawal' ? 'negative' : 'positive';
      const sign = type === 'withdrawal' ? '-' : '+';
      return `
        <div class="transaction-row">
          <div class="transaction-left">
            <div class="transaction-icon">${iconSvg}</div>
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
            <div class="note-panel" style="padding:10px;min-width:120px;max-width:100%;"><div class="muted">Total referrals</div><div style="font-weight:700">${totalReferrals}</div></div>
            <div class="note-panel" style="padding:10px;min-width:120px;max-width:100%;"><div class="muted">Referral earnings</div><div style="font-weight:700">₦${formatN(totalReferralEarnings)}</div></div>
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
