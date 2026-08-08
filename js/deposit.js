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
  const paymentScreenshotInput = document.getElementById('payment-screenshot');
  const paymentBack = document.getElementById('payment-back');

  if(!step1Form) return;
  loadDefaultDepositAccount();

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

  const generatePaymentReference = () => {
    return `FF-${Math.floor(100000 + Math.random() * 900000)}-${Date.now().toString().slice(-5)}`;
  };

  const bannerEl = document.getElementById('payment-session-banner');

  async function toBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to process screenshot file'));
      reader.readAsDataURL(file);
    });
  }

  async function loadDefaultDepositAccount(){
    const bankNameEl = document.getElementById('default-bank-name');
    const accountNumberEl = document.getElementById('default-account-number');
    const accountNameEl = document.getElementById('default-account-name');
    const copyDefaultNumberBtn = document.getElementById('copy-account-number-default');
    const copyDefaultNameBtn = document.getElementById('copy-account-name-default');

    const setAccountDetails = (account) => {
      if(bankNameEl) bankNameEl.textContent = account.bankName || 'Sterling Bank';
      if(accountNumberEl) accountNumberEl.textContent = account.accountNumber || '0142489003';
      if(accountNameEl) accountNameEl.textContent = account.accountName || 'Chinedu Chima';
    };

    const defaultAccount = { bankName: 'Sterling Bank', accountNumber: '0142489003', accountName: 'Chinedu Chima' };
    setAccountDetails(defaultAccount);

    if(copyDefaultNumberBtn){
      copyDefaultNumberBtn.addEventListener('click', async () => {
        try{
          await navigator.clipboard.writeText(accountNumberEl?.textContent || '');
          showToast('Account number copied.', 'success');
        }catch(err){
          showToast('Unable to copy account number.', 'warning');
        }
      });
    }

    if(copyDefaultNameBtn){
      copyDefaultNameBtn.addEventListener('click', async () => {
        try{
          await navigator.clipboard.writeText(accountNameEl?.textContent || '');
          showToast('Account name copied.', 'success');
        }catch(err){
          showToast('Unable to copy account name.', 'warning');
        }
      });
    }

    try{
      const response = await api.getDepositAccount();
      const account = response.account || {};
      if(account.bankName || account.accountNumber || account.accountName){
        setAccountDetails(account);
      }
    }catch(err){
      console.warn('Unable to load default deposit account', err);
    }
  }

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

      const paymentReference = account.paymentReference || generatePaymentReference();
      if(paymentTxInput) paymentTxInput.value = paymentReference;
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
            <div class="account-stat-label">Payment reference</div>
            <div class="account-stat-value">${paymentReference}</div>
          </div>
        </div>
        <div class="account-copy-row">
          <button type="button" id="copy-account-number-2" class="btn primary">Copy Account Number</button>
          <button type="button" id="copy-payment-ref" class="btn outline">Copy Reference</button>
        </div>
      `;
      document.getElementById('copy-account-number-2')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(account.accountNumber || ''); showToast('Account Number copied.', 'success'); }
        catch(err){ showToast('Unable to copy the account number', 'warning'); }
      });
      document.getElementById('copy-payment-ref')?.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(paymentReference); showToast('Payment reference copied.', 'success'); }
        catch(err){ showToast('Unable to copy the payment reference', 'warning'); }
      });
      paymentAccountLoader.classList.add('hidden');
    }catch(err){
      paymentAccountLoader.classList.add('hidden');
      paymentAccountCard.innerHTML = '<div class="muted">Unable to load the secure deposit account right now.</div>';
    }

    paymentStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  paymentBack?.addEventListener('click', () => {
    clearPaymentTimers();
    paymentStep.classList.add('hidden');
    step1Form.classList.remove('hidden');
    depositPlaceholderCard?.classList.remove('hidden');
    step1Form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  paymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearPaymentTimers();
    const button = paymentForm.querySelector('button[type="submit"]');
    const stopLoading = setLoading(button, true);
    const amt = Number(paymentAmountInput.value);
    const txRef = paymentTxInput.value.trim();
    if(!txRef){ stopLoading(); showToast('Transfer reference is required.', 'warning'); return; }
    let screenshotData = null;
    if(paymentScreenshotInput && paymentScreenshotInput.files && paymentScreenshotInput.files[0]){
      try{
        screenshotData = await toBase64(paymentScreenshotInput.files[0]);
      }catch(err){ console.warn('Screenshot conversion failed', err); }
    }
    try{
      const res = await api.deposit({ amount: amt, transactionReference: txRef, screenshot: screenshotData });
      if(res && res.deposit){ showToast('Deposit submitted and pending verification by admin.', 'success'); setTimeout(()=> location.href = 'dashboard.html', 800); }
      else showToast('Deposit submission failed', 'error');
    }catch(err){ console.error(err); showToast(err.message || 'Deposit failed', 'error'); }
    stopLoading();
  });

});
