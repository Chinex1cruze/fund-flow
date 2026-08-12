document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  if(!user){ location.href = 'login.html'; return; }

  const profileName = document.getElementById('profile-name');
  const profilePhone = document.getElementById('profile-phone');
  const profileBalance = document.getElementById('profile-balance');
  const profileRefCode = document.getElementById('profile-ref-code');
  const profileRefLink = document.getElementById('profile-ref-link');
  const logoutBtn = document.getElementById('logout-btn');

  try{
    const res = await api.getMe();
    if(res && res.user) saveUser(res.user);
  }catch(e){ /* ignore, use cached */ }

  const u = getUser();
  if(profileName) profileName.textContent = u.fullName || '';
  if(profilePhone) profilePhone.textContent = u.phone || '';
  if(profileBalance) profileBalance.textContent = formatN(u.balance || 0);
  if(profileRefCode) profileRefCode.textContent = u.referralCode || '—';
  if(profileRefLink){
    const link = u.referralLink || (window.location.origin + `/register.html?ref=${encodeURIComponent(u.referralCode || '')}`);
    profileRefLink.href = link;
    profileRefLink.textContent = link;
  }

  logoutBtn?.addEventListener('click', async () => {
    try{ await api.logout(); }catch(e){ /* ignore */ }
    localStorage.removeItem('ff_user');
    location.href = 'login.html';
  });

  // copy referral code/link
  const copyRefBtn = document.getElementById('copy-ref-code');
  const copyLinkBtn = document.getElementById('copy-ref-link');
  copyRefBtn?.addEventListener('click', () => {
    const code = u.referralCode || '';
    if(!code) return showToast('No referral code to copy', 'warning');
    navigator.clipboard.writeText(code).then(() => showToast('Referral code copied', 'success')).catch(() => showToast('Unable to copy', 'error'));
  });
  copyLinkBtn?.addEventListener('click', () => {
    const link = profileRefLink?.href || '';
    if(!link) return showToast('No link to copy', 'warning');
    navigator.clipboard.writeText(link).then(() => showToast('Referral link copied', 'success')).catch(() => showToast('Unable to copy', 'error'));
  });

});