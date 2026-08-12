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
      const confirmMsg = `Confirm Withdrawal:\n\nAmount: ₦${formatN(amt)}\nBank: ${bank}\nAccount Number: ${acctNo}\nAccount Name: ${acctName}\nWithdrawal Fee: ₦${formatN(fee)}\nNet Amount: ₦${formatN(net)}\n\nPlease confirm that the bank details are correct. FundFlow cannot verify the account name automatically at this time.`;
      if(!confirm(confirmMsg)) { stopLoading(); return; }

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
