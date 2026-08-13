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

  // Fetch server payment settings (fee, withdrawal window) to drive client-side UX
  let paymentSettings = { withdrawalFee: 0.2, withdrawalWindow: { startHour: 9, endHour: 21 } };
  try{
    const sres = await api.getPaymentSettings?.();
    if(sres && sres.settings) paymentSettings = sres.settings;
  }catch(e){ /* use defaults */ }

  // No longer require an active VIP plan to request withdrawal. Display helpful guidance instead.
  if(withdrawStatus){
    withdrawStatus.style.display = 'block';
    try{
      const startH = Number(paymentSettings.withdrawalWindow && paymentSettings.withdrawalWindow.startHour ? paymentSettings.withdrawalWindow.startHour : 9);
      const endH = Number(paymentSettings.withdrawalWindow && paymentSettings.withdrawalWindow.endHour ? paymentSettings.withdrawalWindow.endHour : 21);
      const formatted = `Withdrawals are allowed only between ${String(startH).padStart(2,'0')}:00 and ${String(endH).padStart(2,'0')}:00 (server local time).`;
      // replace first list item text to keep other guidance
      const ul = withdrawStatus.querySelector('ul');
      if(ul && ul.children && ul.children.length){
        ul.children[0].textContent = formatted;
      }
    }catch(e){ /* ignore */ }
  }

  // If form missing, nothing to do
  if(!form) return;

  // Helper to enable/disable submit according to server window
  function isWithinWindow(){
    const nowH = new Date().getHours();
    const startH = Number(paymentSettings.withdrawalWindow && paymentSettings.withdrawalWindow.startHour ? paymentSettings.withdrawalWindow.startHour : 9);
    const endH = Number(paymentSettings.withdrawalWindow && paymentSettings.withdrawalWindow.endHour ? paymentSettings.withdrawalWindow.endHour : 21);
    return nowH >= startH && nowH < endH;
  }

  function updateSubmitAvailability(){
    if(submitBtn){
      if(!isWithinWindow()){
        submitBtn.disabled = true;
        submitBtn.classList.add('disabled');
        submitBtn.title = 'Withdrawals are allowed only during the configured window.';
      } else {
        submitBtn.disabled = false;
        submitBtn.classList.remove('disabled');
        submitBtn.title = '';
      }
    }
  }

  // initialize availability and refresh every minute
  updateSubmitAvailability();
  setInterval(updateSubmitAvailability, 60 * 1000);

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
    if(!isWithinWindow()){ stopLoading(); const win = paymentSettings.withdrawalWindow || { startHour: 9, endHour: 21 }; showToast(`Withdrawals are available only between ${String(win.startHour).padStart(2,'0')}:00 and ${String(win.endHour).padStart(2,'0')}:00.`, 'warning'); return; }
    if(!bank || !acctNo || !acctName){ stopLoading(); showToast('Please complete your bank details and account name', 'warning'); return; }
    if(!/^\d{10}$/.test(acctNo)){ stopLoading(); showToast('Account number must be exactly 10 digits', 'warning'); return; }

    // Retrieve withdrawal fee from server to show user breakdown before confirmation
    try{
      const settingsRes = await api.getPaymentSettings?.() || {};
      const configuredFee = Number((settingsRes.settings && settingsRes.settings.withdrawalFee) ?? 0.2);
      const feeRate = configuredFee > 1 ? configuredFee / 100 : configuredFee;
      const fee = Number((amt * (Number.isFinite(feeRate) ? feeRate : 0.2)).toFixed(2));
      const net = Number((amt - fee).toFixed(2));
      const confirmMsg = [
        `Withdrawal Amount: ₦${formatN(amt)}`,
        `Withdrawal Fee (20%): ₦${formatN(fee)}`,
        `Amount You Will Receive: ₦${formatN(net)}`,
        `Bank: ${bank}`,
        `Account Number: ${acctNo}`,
        `Account Name: ${acctName}`
      ].join('\n');

      // Show styled modal confirmation instead of native confirm()
      const modal = document.getElementById('withdraw-confirm-modal');
      const modalBody = document.getElementById('withdraw-confirm-body');
      const confirmBtn = document.getElementById('withdraw-confirm-btn');
      const cancelBtn = document.getElementById('withdraw-cancel-btn');
      const closeBtn = document.getElementById('withdraw-confirm-close');
      if(modal && modalBody && confirmBtn && cancelBtn && closeBtn){
        modalBody.innerHTML = `
          <div style="display:grid; gap:10px; color:var(--text-main);">
            <div><strong>Withdrawal Amount:</strong> ₦${formatN(amt)}</div>
            <div><strong>Withdrawal Fee (20%):</strong> ₦${formatN(fee)}</div>
            <div><strong>Amount You Will Receive:</strong> ₦${formatN(net)}</div>
            <div><strong>Bank:</strong> ${bank}</div>
            <div><strong>Account Number:</strong> ${acctNo}</div>
            <div><strong>Account Name:</strong> ${acctName}</div>
          </div>
        `;
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
