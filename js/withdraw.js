document.addEventListener('DOMContentLoaded', async ()=>{
  let u = null;
  try{
    const res = await api.getMe();
    if(res && res.user){ u = res.user; saveUser(res.user); }
  }catch(err){ u = getUser(); }
  if(!u) { location.href = 'login.html'; return; }

  const avail = document.getElementById('available-balance'); if(avail) avail.textContent = formatN((u && u.balance) || 0);
  const withdrawStatus = document.getElementById('withdraw-status');
  const form = document.getElementById('withdraw-form');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const verifyBtn = document.getElementById('verify-account');

  // No longer require an active VIP plan to request withdrawal. Display helpful guidance instead.
  if(withdrawStatus){
    withdrawStatus.style.display = 'block';
  }

  // Optional account verification flow (testing or provider configured). Not required to submit.
  verifyBtn?.addEventListener('click', async ()=>{
    const bank = document.getElementById('bank-name').value.trim();
    const acctNo = document.getElementById('account-number').value.trim();
    const acctNameEl = document.getElementById('account-name');
    if(!bank){ showToast('Please select a bank', 'warning'); return; }
    if(!/^\d{10}$/.test(acctNo)){ showToast('Account number must be exactly 10 digits', 'warning'); return; }
    try{
      const res = await api.verifyAccount({ bankName: bank, accountNumber: acctNo });
      if(res && res.success){
        if(acctNameEl) acctNameEl.value = res.accountName || '';
        showToast('Account name retrieved (testing mode). Please confirm the name matches the account.', 'success');
      }else{
        showToast(res.message || 'Unable to verify account details. Verification is optional; you may enter the account name manually.', 'info');
      }
    }catch(err){ console.error(err); showToast(err.message || 'Verification failed', 'error'); }
  });

  if(!form) return;
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const button = submitBtn;
    const stopLoading = setLoading(button, true);
    const amt = Number(document.getElementById('withdraw-amount').value);
    const bank = document.getElementById('bank-name').value.trim();
    const acctNo = document.getElementById('account-number').value.trim();
    const acctName = document.getElementById('account-name').value.trim();

    if(!amt || amt <= 0){ stopLoading(); showToast('Enter a valid amount', 'warning'); return; }
    if(amt > (u.balance||0)){ stopLoading(); showToast('Insufficient balance', 'warning'); return; }
    const hr = new Date().getHours();
    if(hr < 9 || hr >= 21){ stopLoading(); showToast('Withdrawals are available only between 9:00 AM and 9:00 PM.', 'warning'); return; }
    if(!bank || !acctNo || !acctName){ stopLoading(); showToast('Please complete your bank details and account name', 'warning'); return; }
    if(!/^\d{10}$/.test(acctNo)){ stopLoading(); showToast('Account number must be exactly 10 digits', 'warning'); return; }

    // Retrieve withdrawal fee from server to show user breakdown before confirmation
    try{
      const settingsRes = await api.getPaymentSettings?.() || {};
      const fee = Number((settingsRes.settings && settingsRes.settings.withdrawalFee) || 0);
      const net = Math.max(0, amt - fee);
      const confirmMsg = `Amount: ₦${formatN(amt)}\nBank: ${bank}\nAccount Number: ${acctNo}\nAccount Name: ${acctName}\nWithdrawal Fee: ₦${formatN(fee)}\nNet Amount: ₦${formatN(net)}`;

      // Show styled modal confirmation instead of native confirm()
      const modal = document.getElementById('withdraw-confirm-modal');
      const modalBody = document.getElementById('withdraw-confirm-body');
      const confirmBtn = document.getElementById('withdraw-confirm-btn');
      const cancelBtn = document.getElementById('withdraw-cancel-btn');
      const closeBtn = document.getElementById('withdraw-confirm-close');
      if(modal && modalBody && confirmBtn && cancelBtn && closeBtn){
        modalBody.textContent = `Please confirm the withdrawal details:\n\n${confirmMsg}`;
        modal.classList.remove('hidden');
        // return a promise that resolves when user confirms/cancels
        const choice = await new Promise((resolve) => {
          function cleanup(){
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
          }
          function onConfirm(){ cleanup(); resolve(true); }
          function onCancel(){ cleanup(); resolve(false); }
          confirmBtn.addEventListener('click', onConfirm);
          cancelBtn.addEventListener('click', onCancel);
          closeBtn.addEventListener('click', onCancel);
        });
        if(!choice){ stopLoading(); return; }
      }else{
        // fallback to native confirm if modal not available
        if(!confirm(`Confirm Withdrawal:\n\n${confirmMsg}`)) { stopLoading(); return; }
      }

      // Submit withdrawal request to server (server is authoritative and will reserve funds)
      const res = await api.withdraw({ amount: amt, bankName: bank, accountNumber: acctNo, accountName: acctName });
      if(res && res.withdrawal){
        showToast('Withdrawal request submitted. Administrator approval is required before payment.', 'success');
        setTimeout(()=> location.href = 'dashboard.html', 800);
      }else if(res && res.request){
        // fallback local/demo behaviour
        showToast('Withdrawal request submitted (demo). Administrator approval is required.', 'success');
        setTimeout(()=> location.href = 'dashboard.html', 800);
      }else{
        showToast('Withdrawal submission failed', 'error');
      }
    }catch(err){ console.error(err); showToast(err.message || 'Withdrawal failed', 'error'); }

    stopLoading();
  });
});
