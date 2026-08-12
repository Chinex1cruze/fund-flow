document.addEventListener('DOMContentLoaded', async ()=>{
  const u = requireAuth();
  const heroBalance = document.getElementById('hero-balance');
  if(heroBalance) heroBalance.textContent = formatN((u && u.balance) || 0);

  // Load and render the user's persistent assigned deposit account (fallback to default)
  const depositPlaceholderCard = document.getElementById('deposit-placeholder-card');
  async function loadAssignedAccount(){
    if(!depositPlaceholderCard) return;
    try{
      const resp = await api.getDepositAccount();
      const account = resp.account || {};
      // Render assigned account into the top card so it's never empty
      depositPlaceholderCard.innerHTML = `\n        <div class="deposit-account-grid">\n          <div>\n            <div class="account-stat-label">Bank Name</div>\n            <div class="account-stat-value">${account.bankName || '—'}</div>\n          </div>\n          <div>\n            <div class="account-stat-label">Account Number</div>\n            <div class="account-stat-value" id="assigned-account-number">${account.accountNumber || '—'}</div>\n          </div>\n          <div>\n            <div class="account-stat-label">Account Name</div>\n            <div class="account-stat-value">${account.accountName || '—'}</div>\n          </div>\n        </div>\n        <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">\n          <button type="button" id="copy-assigned-account" class="btn primary">Copy Account Number</button>\n          <div style="display:flex;flex-direction:column;">
            <span class="muted">Status: ${account.status || 'Active'}</span>
            <span class="muted">Account ID: ${account.id || account.backingAccountId || '—'}</span>
          </div>\n        </div>\n      `;

      // Wire copy button
      const copyBtn = document.getElementById('copy-assigned-account');
      copyBtn?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.accountNumber || ''); showToast('Account number copied', 'success'); }
        catch(err){ showToast('Unable to copy account number', 'warning'); }
      });
    }catch(err){
      // show a helpful message instead of leaving blank
      depositPlaceholderCard.innerHTML = '<div class="deposit-account-placeholder"><div class="muted">Unable to load assigned deposit account right now. Please enter an amount or try again later.</div></div>';
    }
  }

  // Kick off load on page load
  loadAssignedAccount();

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
            <div class="account-stat-label">Bank Name</div>
            <div class="account-stat-value">${account.bankName || '—'}</div>
          </div>
          <div>
            <div class="account-stat-label">Account Number</div>
            <div class="account-stat-value">${account.accountNumber || '—'}</div>
          </div>
          <div>
            <div class="account-stat-label">Account Name</div>
            <div class="account-stat-value">${account.accountName || '—'}</div>
          </div>
          <div>
            <div class="account-stat-label">Status</div>
            <div class="account-stat-value">${account.status || 'Active'}</div>
          </div>
        </div>
          <div style="margin-top:12px;">
            <div class="muted">Payment Reference (FundFlow)</div>
            <div class="account-stat-value" id="payment-reference">${account.paymentReference || '—'}</div>
            <div class="muted" style="margin-top:6px">After transferring the money, include the payment reference shown above in your bank transfer narration/description. Example: ${account.paymentReference || 'FF-824915'}</div>
          <div class="muted" style="margin-top:6px">Using configured account: <strong>${account.backingAccountId || account.id || '—'}</strong></div>
        </div>
        <div class="account-copy-row">
          <button type="button" id="copy-account-number-2" class="btn primary">Copy Account Number</button>
          <button type="button" id="copy-payment-ref" class="btn ghost">Copy Reference</button>
        </div>
        `;
      document.getElementById('copy-account-number-2')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.accountNumber || ''); showToast('Account Number copied.', 'success'); }
        catch(err){ showToast('Unable to copy the account number', 'warning'); }
      });
      document.getElementById('copy-payment-ref')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.paymentReference || ''); showToast('Payment reference copied.', 'success'); }
        catch(err){ showToast('Unable to copy the payment reference', 'warning'); }
      });

      // Show the FundFlow payment reference prominently and ensure the user can enter their own bank transfer narration separately
      const bankTransferInput = document.getElementById('bank-transfer-reference');
      const paymentRefEl = document.getElementById('payment-reference');
      if(paymentRefEl) paymentRefEl.textContent = account.paymentReference || '';

      // Wire copy buttons
      document.getElementById('copy-account-number-2')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.accountNumber || ''); showToast('Account Number copied.', 'success'); }
        catch(err){ showToast('Unable to copy the account number', 'warning'); }
      });
      document.getElementById('copy-payment-ref')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.paymentReference || ''); showToast('Payment reference copied.', 'success'); }
        catch(err){ showToast('Unable to copy the payment reference', 'warning'); }
      });

      paymentAccountLoader.classList.add('hidden');

      // Wire the new "I Have Made the Payment" button
      const confirmBtn = document.getElementById('confirm-payment-btn');
      confirmBtn?.addEventListener('click', async () => {
        try{
          const btRef = (bankTransferInput && bankTransferInput.value.trim()) || '';
          // disable to prevent duplicates
          confirmBtn.disabled = true;
          confirmBtn.dataset.prevText = confirmBtn.innerHTML;
          confirmBtn.innerHTML = '<span class="loader"></span> Submitting';
          const payload = {
            amount: amt,
            paymentReference: account.paymentReference || '',
            bankTransferReference: btRef,
            screenshot: null
          };
          const res = await api.deposit(payload);
          if(res && res.deposit){
            showToast('Deposit submitted and pending verification by admin.', 'success');
            // give user the generated FundFlow reference in a toast
            try{ const ref = res.deposit.transactionReference; if(ref) showToast(`Reference: ${ref}`, 'info', 6000); }catch(e){}
            setTimeout(()=> location.href = 'dashboard.html', 900);
          } else showToast('Deposit submission failed', 'error');
        }catch(err){ console.error(err); showToast(err.message || 'Deposit failed', 'error'); }
        finally{
          if(confirmBtn){ confirmBtn.disabled = false; if(confirmBtn.dataset.prevText) confirmBtn.innerHTML = confirmBtn.dataset.prevText; }
        }
      });
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
