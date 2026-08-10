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
      return `
        <article class="wallet-card">
          <div class="dashboard-wallet-inline">
            <div>
              <div class="muted">${card.label}</div>
              <div class="balance-amount ${isBalance ? 'balance-value' : ''}" data-balance-scale="${isBalance ? 'balance' : 'other'}">${card.value}</div>
            </div>
            ${isBalance ? '<button class="balance-toggle" type="button" id="toggle-balance-btn">Hide Balance</button>' : ''}
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
    const [transactionsRes, announcementsRes, notificationsRes] = await Promise.all([
      api.getTransactions(),
      api.getAnnouncements(),
      api.getNotifications()
    ]);

    renderWalletCards(currentUser);
    renderAnnouncements(announcementsRes.announcements || []);
    renderVipCountdown(currentUser);
    renderActivePlan(currentUser);
    renderTransactions(transactionsRes.transactions || []);
    notificationCountEl.textContent = (notificationsRes.notifications || []).length;
  }

  await loadDashboardData();

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
});
