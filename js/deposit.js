/* New deposit.js: amount-first flow, server-generated payment reference, optional screenshot as base64, submit deposit */
document.addEventListener('DOMContentLoaded', async ()=>{
  const u = requireAuth();
  const heroBalance = document.getElementById('hero-balance');
  if(heroBalance) heroBalance.textContent = formatN((u && u.balance) || 0);

  const depositForm = document.getElementById('deposit-form');
  const continueBtn = document.getElementById('continue-to-payment');
  const paymentDetails = document.getElementById('payment-details');
  const depositInitial = document.getElementById('deposit-initial');
  const bankAccountCard = document.getElementById('bank-account-card');
  const paymentBack = document.getElementById('payment-back');
  const submitBtn = document.getElementById('submit-payment-btn');
  const bankTransferInput = document.getElementById('bank-transfer-reference');
  const screenshotInput = document.getElementById('payment-screenshot');

  let currentSession = null; // will hold server-returned account/session with paymentReference
  function showBankCard(account){
    bankAccountCard.innerHTML = `
      <div class="deposit-account-grid">
        <div>
          <div class="account-stat-label">Bank Name</div>
          <div class="account-stat-value">${account.bankName || '—'}</div>
        </div>
        <div>
          <div class="account-stat-label">Account Number</div>
          <div class="account-stat-value" id="account-number">${account.accountNumber || '—'}</div>
        </div>
        <div>
          <div class="account-stat-label">Account Name</div>
          <div class="account-stat-value">${account.accountName || '—'}</div>
        </div>
        <div>
          <div class="account-stat-label">Status</div>
          <div class="account-stat-value">${(account.status||'Active')}</div>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;align-items:center;">
        <button id="copy-account-btn" class="btn primary">Copy Account Number</button>
        <div style="margin-left:auto;font-size:13px;color:#666;">Reference: <strong id="ff-reference">${account.paymentReference||'—'}</strong></div>
        <button id="copy-ref-btn" class="btn ghost" style="margin-left:8px;">Copy Reference</button>
      </div>
      <div class="muted" style="margin-top:8px">After transferring the money, include the payment reference above in your bank transfer narration/description.</div>
    `;

    document.getElementById('copy-account-btn')?.addEventListener('click', async () => {
      try{ await navigator.clipboard.writeText(account.accountNumber || ''); showToast('Account number copied', 'success'); }
      catch(e){ showToast('Unable to copy account number', 'warning'); }
    });
    document.getElementById('copy-ref-btn')?.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(account.paymentReference || ''); showToast('Reference copied', 'success'); }
      catch(e){ showToast('Unable to copy reference', 'warning'); }
    });
  }

  continueBtn?.addEventListener('click', async ()=>{
    try{
      const amountEl = document.getElementById('deposit-amount');
      const amount = Number(amountEl.value);
      if(!amount || amount < 3000){ showToast('Minimum deposit is ₦3,000', 'warning'); return; }

      // Request server to create a one-time deposit account/session and paymentReference
      continueBtn.disabled = true;
      continueBtn.textContent = 'Loading...';
      const resp = await api.getDepositAccount({ amount });
      // resp.account contains bank + paymentReference when amount supplied
      const account = resp.account || {};
      if(!account || !account.paymentReference){ showToast('Unable to create deposit session', 'error'); continueBtn.disabled = false; continueBtn.textContent='Continue'; return; }

      currentSession = { amount, paymentReference: account.paymentReference, backingAccountId: account.backingAccountId || account.id };
      // show payment details
      depositInitial.classList.add('hidden');
      paymentDetails.classList.remove('hidden');
      showBankCard(account);
      // ensure hero balance reflects current user
      try{ const me = await api.getMe(); if(me && me.user){ document.getElementById('hero-balance').textContent = formatN(me.user.balance||0); } }catch(e){}
    }catch(err){ console.error(err); showToast(err.message || 'Failed to prepare deposit', 'error'); }
    finally{ continueBtn.disabled = false; continueBtn.textContent = 'Continue'; }
  });

  paymentBack?.addEventListener('click', ()=>{
    paymentDetails.classList.add('hidden');
    depositInitial.classList.remove('hidden');
  });

  // helper to read file to dataURL
  function fileToDataUrl(file){
    return new Promise((resolve, reject)=>{
      if(!file) return resolve(null);
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.onerror = ()=> reject(new Error('Unable to read file'));
      fr.readAsDataURL(file);
    });
  }

  submitBtn?.addEventListener('click', async ()=>{
    if(!currentSession){ showToast('No deposit session found. Please enter an amount and continue.', 'warning'); return; }
    const bankNarration = (bankTransferInput && bankTransferInput.value || '').trim();
    // note: bank narration optional
    const screenshotFile = (screenshotInput && screenshotInput.files && screenshotInput.files[0]) ? screenshotInput.files[0] : null;

    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    try{
      let screenshotData = null;
      if(screenshotFile){ screenshotData = await fileToDataUrl(screenshotFile); }
      const payload = { amount: currentSession.amount, paymentReference: currentSession.paymentReference, bankTransferReference: bankNarration || null, screenshot: screenshotData };
      const res = await api.deposit(payload);
      if(res && res.deposit){
        showToast('Deposit submitted and pending verification by admin.', 'success');
        // show deposit reference to user
        try{ const ref = res.deposit.transactionReference; if(ref) showToast(`Reference: ${ref}`, 'info', 6000); }catch(e){}
        setTimeout(()=> location.href = 'dashboard.html', 900);
      } else {
        showToast('Deposit submission failed', 'error');
      }
    }catch(err){ console.error(err); showToast(err.message || 'Deposit failed', 'error'); }
    finally{ submitBtn.disabled = false; submitBtn.textContent = prevText; }
  });

});
