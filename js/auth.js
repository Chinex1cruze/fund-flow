// Registration and login using the api wrapper (falls back to localStorage when backend is disabled)
document.addEventListener('DOMContentLoaded', ()=>{
  const reg = document.getElementById('register-form');
  if(reg){
    // If the page was opened with a ?ref=... query param, prefill the referral input
    try{
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if(ref){ const refEl = document.getElementById('referralCode'); if(refEl) refEl.value = ref; }
    }catch(e){ /* ignore */ }

    reg.addEventListener('submit', async e=>{
      e.preventDefault();
      const button = reg.querySelector('button[type="submit"]');
      const stopLoading = setLoading(button, true);
      const fullName = document.getElementById('fullName').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value;
      const referralCode = (document.getElementById('referralCode') && document.getElementById('referralCode').value.trim()) || undefined;
      if(!fullName||!phone||!password){ stopLoading(); showToast('Please fill all fields', 'warning'); return; }
      try{
        const payload = { fullName, phone, password };
        if(referralCode) payload.referralCode = referralCode;
        const res = await api.register(payload);
        if(res && res.user) saveUser(res.user);
        localStorage.setItem('ff_show_community', '1');
        showToast('🎉 Congratulations! You have received a ₦500 Welcome Bonus.', 'success');
        setTimeout(()=> location.href = 'dashboard.html', 800);
      }catch(err){
        console.error(err);
        showToast(err.message || 'Registration failed', 'error');
      }finally{ stopLoading(); }
    });
  }

  const login = document.getElementById('login-form');
  if(login){
    login.addEventListener('submit', async e=>{
      e.preventDefault();
      const button = login.querySelector('button[type="submit"]');
      const stopLoading = setLoading(button, true);
      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value;
      try{
        const res = await api.login({ phone, password });
        if(res && res.user) saveUser(res.user);
        localStorage.setItem('ff_show_community', '1');
        location.href = 'dashboard.html';
      }catch(err){
        console.error(err);
        showToast(err.message || 'Invalid credentials', 'error');
      }finally{ stopLoading(); }
    });
  }
});
