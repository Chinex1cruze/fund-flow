const VIP_PLANS = [
  { id:1, name:'VIP 1', deposit:3000, daily:700 },
  { id:2, name:'VIP 2', deposit:10000, daily:2400 },
  { id:3, name:'VIP 3', deposit:30000, daily:7500 },
  { id:4, name:'VIP 4', deposit:60000, daily:15000 },
  { id:5, name:'VIP 5', deposit:100000, daily:26000 },
  { id:6, name:'VIP 6', deposit:200000, daily:55000 },
  { id:7, name:'VIP 7', deposit:350000, daily:100000 },
  { id:8, name:'VIP 8', deposit:500000, daily:145000 },
  { id:9, name:'VIP 9', deposit:750000, daily:220000 },
  { id:10, name:'VIP 10', deposit:1000000, daily:300000 },
  { id:11, name:'VIP 11', deposit:2000000, daily:620000 },
  { id:12, name:'VIP 12', deposit:5000000, daily:1600000 }
];

async function loadVIPPlans(){
  if(USE_API){
    try{
      const res = await apiFetch(`${API_BASE}/vips`, { method:'GET' });
      if(res && Array.isArray(res.plans)) return res.plans;
    }catch(err){ console.warn('VIP API failed, falling back to local plans', err); }
  }
  return VIP_PLANS;
}

// Render VIP cards. If user has an active plan, show its countdown and keep it updated.
async function renderVIPList(){
  const list = document.getElementById('vip-list') || document.getElementById('vip-preview');
  if(!list) return;
  list.innerHTML = '';
  const isVipPage = window.location.pathname.split('/').pop() === 'vip.html';

  // load plans from backend if available
  const plans = await loadVIPPlans();

  // fetch user via API wrapper to get latest state (mock or real)
  let u = null;
  const cached = getUser();
  try{
    const res = await api.getMe();
    u = res.user || cached;
    if(res && res.user) saveUser(res.user);
  }catch(e){ u = cached; }

  plans.forEach(plan=>{
    const hasActive = u && u.activePlan && u.activePlan.id === plan.id;
    const card = document.createElement('div'); card.className='vip-card card';
    const actionButton = isVipPage
      ? `<button class="btn primary buy-vip" data-id="${plan.id}">Buy Now</button>`
      : `<a class="btn outline" href="vip.html">View details</a>`;
    card.innerHTML = `
      <div class="row"><strong>${plan.name}</strong><div class="muted" style="margin-left:auto">Deposit ₦${formatN(plan.deposit)}</div></div>
      <div class="meta">Daily Reward: ₦${formatN(plan.daily)}</div>
      <div class="row mt-2">${actionButton}
      <div class="muted" style="margin-left:auto" data-countdown-id="${plan.id}">24:00:00</div></div>
    `;
    list.appendChild(card);

    if(hasActive){
      const cdEl = card.querySelector(`[data-countdown-id="${plan.id}"]`);
      if(cdEl && typeof startCountdown === 'function'){
        const creditAndRestart = async function(){
          try{
            if(USE_API){
              const fresh = await api.getMe();
              if(fresh && fresh.user) { saveUser(fresh.user); }
            } else {
              const usr = getUser();
              if(!usr || !usr.activePlan) return;
              usr.balance = (usr.balance || 0) + (usr.activePlan.daily || 0);
              usr.earnings = (usr.earnings || 0) + (usr.activePlan.daily || 0);
              const next = Date.now() + 24*60*60*1000;
              usr.activePlan.nextPayoutAt = next;
              usr.nextPayoutAt = next;
              saveUser(usr);
            }
          }catch(err){ console.error('Error crediting payout', err); }
          const newNext = (getUser() && getUser().activePlan && getUser().activePlan.nextPayoutAt) || (Date.now() + 24*60*60*1000);
          startCountdown(newNext, cdEl, creditAndRestart);
        };
        startCountdown((u.activePlan && (u.activePlan.nextPayoutAt || u.activePlan.endsAt)) || Date.now() + 24*60*60*1000, cdEl, creditAndRestart);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  const isVipPage = window.location.pathname.split('/').pop() === 'vip.html';
  if(isVipPage && !getUser()){
    location.href = 'login.html';
    return;
  }

  renderVIPList();

  document.addEventListener('click', async (e)=>{
    if(e.target && e.target.classList.contains('buy-vip')){
      const button = e.target;
      const stopLoading = setLoading(button, true);
      const id = Number(button.dataset.id);
      const plans = await loadVIPPlans();
      const plan = plans.find(p=>p.id===id);
      let u = getUser();
      if(USE_API){
        try{
          const res = await api.getMe();
          if(res && res.user){ u = res.user; saveUser(res.user); }
        }catch(err){ /* fallback to local storage */ }
      }
      if(!u){ stopLoading(); location.href='login.html'; return; }
      if(!plan){ stopLoading(); showToast('Unable to find the selected VIP plan.', 'error'); return; }
      if(!u.balance || u.balance < plan.deposit){ stopLoading(); showToast('You must deposit before buying this VIP plan.', 'warning'); return; }
      if(u.activePlan){ stopLoading(); showToast('Only one VIP plan can be active at a time.', 'warning'); return; }
      try{
        const now = Date.now(); const nextPayoutAt = now + 24*60*60*1000;
        u.activePlan = { id:plan.id, name:plan.name, deposit:plan.deposit, daily:plan.daily, startedAt: now, nextPayoutAt };
        u.balance = u.balance - plan.deposit;
        saveUser(u);
        if(USE_API){
          const res = await api.buyVip({ planId: id });
          if(res && res.user) saveUser(res.user);
        }
        showToast(`${plan.name} activated. Daily reward ₦${formatN(plan.daily)} will be credited every 24 hours.`, 'success');
        setTimeout(()=> location.href='dashboard.html', 800);
      }catch(err){ console.error(err); showToast(err.message || 'VIP purchase failed', 'error'); }
      stopLoading();
    }
  });
});
