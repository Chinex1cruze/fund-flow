document.addEventListener('DOMContentLoaded', async ()=>{
  const u = requireAuth();
  const heroBalance = document.getElementById('hero-balance');
  if(heroBalance) heroBalance.textContent = formatN((u && u.balance) || 0);

  // Elements

  // New multi-step flow
  const step1Form = document.getElementById('deposit-form');
  const paymentStep = document.getElementById('payment-step');
  const paymentAccountLoader = document.getElementById('payment-account-loader');
  const paymentAccountCard = document.getElementById('payment-account-card');
  const paymentForm = document.getElementById('payment-form');
  const paymentAmountInput = document.getElementById('payment-amount');
  const paymentTxInput = document.getElementById('payment-transaction-reference');
  const paymentBack = document.getElementById('payment-back');

  if(!step1Form) return;

  const depositPlaceholderCard = document.getElementById('deposit-placeholder-card');
  const paymentAmountLabel = document.getElementById('payment-amount-label');
  const paymentCountdownLabel = document.getElementById('payment-countdown');
  const closeCountdownLabel = document.getElementById('close-countdown');
  let paymentTimerId = null;
  let closeTimerId = null;

  const clearPaymentTimers = () => {
    if(paymentTimerId) clearInterval(paymentTimerId);
    if(closeTimerId) clearInterval(closeTimerId);
    paymentTimerId = null;
    closeTimerId = null;
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const bannerEl = document.getElementById('payment-session-banner');

  const hideBanner = () => {
    if(!bannerEl) return;
    bannerEl.style.display = 'none';
    bannerEl.classList.add('hidden');
    bannerEl.innerHTML = '';
  };

  const showSessionBanner = (message) => {
    if(!bannerEl) return;
    bannerEl.classList.remove('hidden');
    bannerEl.style.display = 'block';
    bannerEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;"><div>${message}</div><div><button id=\"payment-banner-dismiss\" class=\"btn ghost\">Dismiss</button></div></div>`;
    const dismiss = document.getElementById('payment-banner-dismiss');
    const submitBtn = paymentForm?.querySelector('button[type="submit"]');
    // disable submit while banner is active
    if(submitBtn) submitBtn.disabled = true;
    dismiss?.addEventListener('click', () => {
      hideBanner();
      if(submitBtn) submitBtn.disabled = false;
      clearPaymentTimers();
      closePaymentStep();
    });
  };

  const closePaymentStep = (message) => {
    clearPaymentTimers();
    // If payment step is visible, show a prominent banner first then close after a short delay
    if(message && paymentStep && paymentStep.classList.contains('hidden') === false){
      showSessionBanner(message);
      setTimeout(()=>{
        hideBanner();
        const submitBtn = paymentForm?.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.disabled = false;
        paymentStep.classList.add('hidden');
        step1Form.classList.remove('hidden');
        depositPlaceholderCard?.classList.remove('hidden');
        if(message) showToast(message, 'warning');
        step1Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 4000);
      return;
    }

    paymentStep.classList.add('hidden');
    step1Form.classList.remove('hidden');
    depositPlaceholderCard?.classList.remove('hidden');
    if(message) showToast(message, 'warning');
    step1Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  step1Form.addEventListener('submit', async e=>{
    e.preventDefault();
    const amt = Number(document.getElementById('deposit-amount').value);
    if(!amt || amt < 3000){ showToast('Minimum deposit is ₦3,000', 'warning'); return; }

    // Show payment step and populate amount
    step1Form.classList.add('hidden');
    depositPlaceholderCard?.classList.add('hidden');
    paymentAmountInput.value = amt;
    if(paymentAmountLabel) paymentAmountLabel.textContent = `₦${formatN(amt)}`;
    paymentTxInput.value = '';
    paymentStep.classList.remove('hidden');
    if(paymentCountdownLabel) paymentCountdownLabel.textContent = '10:00';
    if(closeCountdownLabel) closeCountdownLabel.textContent = '03:00';

    // Load assigned account into the payment card area
    paymentAccountLoader.classList.remove('hidden');
    paymentAccountCard.innerHTML = '';
    try{
      const response = await api.getDepositAccount({ amount: amt });
      const account = response.account || {};

      // configure timers from server session if present
      clearPaymentTimers();
      const now = Date.now();
      let paymentRemaining = 10 * 60;
      let closeRemaining = 3 * 60;
      if(account.expiresAt) paymentRemaining = Math.max(0, Math.ceil((Number(account.expiresAt) - now)/1000));
      if(account.closeAt) closeRemaining = Math.max(0, Math.ceil((Number(account.closeAt) - now)/1000));

      if(paymentCountdownLabel) paymentCountdownLabel.textContent = formatCountdown(paymentRemaining);
      if(closeCountdownLabel) closeCountdownLabel.textContent = formatCountdown(closeRemaining);

      paymentTimerId = setInterval(() => {
        paymentRemaining -= 1;
        if(paymentCountdownLabel) paymentCountdownLabel.textContent = formatCountdown(paymentRemaining);
        if(paymentRemaining <= 0){
          clearPaymentTimers();
          closePaymentStep('Payment session expired. Please start again.');
        }
      }, 1000);
      closeTimerId = setInterval(() => {
        closeRemaining -= 1;
        if(closeCountdownLabel) closeCountdownLabel.textContent = formatCountdown(closeRemaining);
        if(closeRemaining <= 0){
          clearPaymentTimers();
          closePaymentStep('Virtual account details closed after 3 minutes. Please try again.');
        }
      }, 1000);

      paymentAccountCard.innerHTML = `
        <div class="deposit-account-grid">
          <div>
            <div class="account-stat-label">Virtual bank</div>
            <div class="account-stat-value">${account.bankName || '—'}</div>
          </div>
          <div>
            <div class="account-stat-label">Virtual account number</div>
            <div class="account-stat-value">${account.accountNumber || '—'}</div>
          </div>
          <div>
            <div class="account-stat-label">Account name</div>
            <div class="account-stat-value">${account.accountName || '—'}</div>
          </div>
          <div>
            <div class="account-stat-label">Status</div>
            <div class="account-stat-value">${account.status || 'Active'}</div>
          </div>
        </div>
        <div class="account-copy-row">
          <button type="button" id="copy-account-number-2" class="btn primary">Copy Account Number</button>
        </div>
      `;
      document.getElementById('copy-account-number-2')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.accountNumber || ''); showToast('Account Number copied.', 'success'); }
        catch(err){ showToast('Unable to copy the account number', 'warning'); }
      });
      paymentAccountLoader.classList.add('hidden');
    }catch(err){
      paymentAccountLoader.classList.add('hidden');
      paymentAccountCard.innerHTML = '<div class="muted">Unable to load the secure deposit account right now.</div>';
    }

    paymentStep.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Make the confirm button prominent: focus and give a short pulse animation to draw attention.
    try{
      const confirmBtn = document.getElementById('confirm-payment-btn');
      if(confirmBtn){
        confirmBtn.focus({ preventScroll: true });
        confirmBtn.classList.add('pulse');
        setTimeout(() => confirmBtn.classList.remove('pulse'), 1000);
      }
    }catch(e){ /* ignore */ }
  });

  paymentBack?.addEventListener('click', () => {
    clearPaymentTimers();
    paymentStep.classList.add('hidden');
    step1Form.classList.remove('hidden');
    depositPlaceholderCard?.classList.remove('hidden');
    step1Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Allow pressing SPACE to confirm payment when the payment step is visible.
  document.addEventListener('keydown', (ev) => {
    try {
      if(ev.code !== 'Space') return;
      // Don't trigger while typing in inputs, textareas, selects, buttons or content editable areas
      const active = document.activeElement;
      if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'BUTTON' || active.tagName === 'SELECT' || active.isContentEditable)) return;
      if(!paymentStep || paymentStep.classList.contains('hidden')) return;
      ev.preventDefault();
      const submitBtn = paymentForm?.querySelector('button[type="submit"]');
      if(submitBtn) {
        // give a small visual focus feedback
        submitBtn.focus({ preventScroll: true });
        submitBtn.click();
      }
    } catch (e) {
      // swallow errors to avoid breaking the page
      console.error('Spacebar handler error', e);
    }
  });

  paymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearPaymentTimers();
    const button = paymentForm.querySelector('button[type="submit"]');
    const stopLoading = setLoading(button, true);
    const amt = Number(paymentAmountInput.value);
    const txRef = paymentTxInput.value.trim();
    if(!txRef){ stopLoading(); showToast('Transfer reference is required after sending your bank transfer.', 'warning'); return; }
    try{
      const res = await api.deposit({ amount: amt, transactionReference: txRef, screenshot: null });
      if(res && res.deposit){ showToast('Deposit submitted and pending verification by admin.', 'success'); setTimeout(()=> location.href = 'dashboard.html', 800); }
      else showToast('Deposit submission failed', 'error');
    }catch(err){ console.error(err); showToast(err.message || 'Deposit failed', 'error'); }
    stopLoading();
  });

});
