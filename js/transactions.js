document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser(); if(!user){ location.href = 'login.html'; return; }

  const container = document.getElementById('transactions-container');
  const modal = document.getElementById('transaction-modal');
  const modalClose = document.getElementById('transaction-modal-close');
  const modalContent = document.getElementById('transaction-modal-content');
  const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));

  function formatDateTime(ts){ const d = new Date(ts || Date.now()); return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; }
  function formatMoney(v){ return `₦${formatN(v||0)}`; }

  function mapTypeLabel(type){
    if(!type) return 'Transaction';
    if(type.includes('deposit')) return 'Deposit';
    if(type.includes('withdraw')) return 'Withdrawal';
    if(type.includes('vip')) return 'VIP';
    if(type.includes('referral')) return 'Referral';
    if(type.includes('wallet')) return 'Wallet';
    return type;
  }

  function renderList(items){
    if(!items || !items.length){ container.innerHTML = '<div class="muted">No transactions found.</div>'; return; }
    container.innerHTML = items.map(t => {
      const label = mapTypeLabel(t.type || t.action || 'transaction');
      const isDebit = String(t.type||'').toLowerCase().includes('withdraw') || (t.amount||0) < 0 || String(t.type||'').toLowerCase().includes('debit');
      const sign = isDebit ? '-' : '+';
      const amount = formatMoney(Math.abs(Number(t.amount || 0)));
      const status = t.status || 'pending';
      const ref = t.meta && (t.meta.transactionReference || t.meta.depositId || t.meta.vipRef) || t.transactionReference || t.reference || '';
      const date = new Date(t.createdAt || t.at || Date.now());
      return `
        <article class="note-panel card transaction-card" data-id="${t.id || ''}" style="margin:8px 0; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
              <div style="font-weight:600;">${label}</div>
              ${ref ? `<div class="muted" style="font-size:13px; margin-top:6px;">${ref}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div class="${isDebit ? 'negative' : 'positive'}" style="font-weight:700; font-size:16px;">${sign}${amount}</div>
              <div class="muted" style="font-size:12px; margin-top:6px;">${new Date(date).toLocaleDateString()} • ${new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // attach click handlers to open details
    Array.from(container.querySelectorAll('.transaction-card')).forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.id;
        const all = window.__tx_cache || [];
        const tx = all.find(x => String(x.id) === String(id));
        if(!tx) return;
        showTransactionDetails(tx);
      });
    });
  }

  function showTransactionDetails(tx){
    const label = mapTypeLabel(tx.type || tx.action || 'Transaction');
    const amount = formatMoney(tx.amount || 0);
    const status = tx.status || 'pending';
    const ref = tx.transactionReference || tx.reference || (tx.meta && (tx.meta.transactionReference || tx.meta.depositId || tx.meta.vipRef)) || '';
    const date = new Date(tx.createdAt || tx.at || Date.now());
    const desc = tx.description || (tx.meta && tx.meta.description) || '';
    let related = '';
    if(tx.type && tx.type.includes('deposit')){
      related += `<div class="muted">Bank Transfer Ref: ${tx.meta && tx.meta.bankTransferReference ? tx.meta.bankTransferReference : '—'}</div>`;
      related += `<div class="muted">Backing Account: ${tx.meta && tx.meta.backingAccountId ? tx.meta.backingAccountId : '—'}</div>`;
    }
    if(tx.type && tx.type.includes('vip')){
      related += `<div class="muted">VIP Ref: ${tx.meta && tx.meta.vipRef ? tx.meta.vipRef : (tx.meta && tx.meta.vipPurchaseId ? tx.meta.vipPurchaseId : '—')}</div>`;
    }

    modalContent.innerHTML = `
      <h3>${label}</h3>
      <div style="margin-top:8px;"><strong>Amount:</strong> ${amount}</div>
      <div style="margin-top:6px;"><strong>Status:</strong> ${status}</div>
      ${ref ? `<div style="margin-top:6px;"><strong>Reference:</strong> ${ref}</div>` : ''}
      <div style="margin-top:6px;"><strong>Date:</strong> ${date.toLocaleDateString()}</div>
      <div style="margin-top:6px;"><strong>Time:</strong> ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      ${desc ? `<div style="margin-top:8px;"><strong>Description:</strong><div class="muted">${desc}</div></div>` : ''}
      ${related ? `<div style="margin-top:8px;">${related}</div>` : ''}
      <div style="margin-top:12px; text-align:right;"><button class="btn ghost" id="close-tx-detail">Close</button></div>
    `;
    modal.classList.remove('hidden');
    document.getElementById('close-tx-detail').addEventListener('click', () => { modal.classList.add('hidden'); });
  }

  modalClose?.addEventListener('click', () => { modal.classList.add('hidden'); });

  async function loadTransactions(){
    try{
      const res = await api.getTransactions();
      const items = res.transactions || [];
      // cache for details
      window.__tx_cache = items.slice().reverse();
      renderList(window.__tx_cache);
    }catch(e){ container.innerHTML = `<div class="muted">Failed to load transactions: ${e.message}</div>`; }
  }

  function applyFilter(filter){
    const all = window.__tx_cache || [];
    if(filter === 'all') return renderList(all);
    const filtered = all.filter(t => {
      const type = (t.type||'').toLowerCase();
      if(filter === 'deposit') return type.includes('deposit');
      if(filter === 'withdrawal') return type.includes('withdraw');
      if(filter === 'vip') return type.includes('vip');
      if(filter === 'referral') return type.includes('referral');
      if(filter === 'wallet') return type.includes('wallet') || type.includes('credit') || type.includes('debit');
      return true;
    });
    renderList(filtered);
  }

  filterBtns.forEach(btn => btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter(btn.dataset.filter);
  }));

  await loadTransactions();
});