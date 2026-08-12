document.addEventListener('DOMContentLoaded', async () => {
  let user = getUser();
  if(!user){ location.href = 'login.html'; return; }

  // Try refresh from API
  try{
    const res = await api.getMe();
    if(res && res.user) { saveUser(res.user); user = res.user; }
  }catch(e){ /* use cached user */ }

  const picPreview = document.getElementById('profile-picture-preview');
  const picInput = document.getElementById('profile-picture-input');
  const nameInput = document.getElementById('profile-name-input');
  const phoneInput = document.getElementById('profile-phone-input');
  const balanceEl = document.getElementById('profile-balance');
  const refCodeEl = document.getElementById('profile-ref-code');
  const refLinkEl = document.getElementById('profile-ref-link');

  const editBtn = document.getElementById('edit-profile-btn');
  const saveBtn = document.getElementById('save-profile-btn');
  const cancelBtn = document.getElementById('cancel-profile-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // populate
  function populate(u){
    nameInput.value = u.fullName || '';
    phoneInput.value = u.phone || '';
    balanceEl.textContent = formatN(u.balance || 0);
    refCodeEl.textContent = u.referralCode || '—';
    const link = u.referralLink || (window.location.origin + `/register.html?ref=${encodeURIComponent(u.referralCode || '')}`);
    refLinkEl.href = link; refLinkEl.textContent = link;
    if(u.profilePicture) picPreview.src = u.profilePicture;
  }
  populate(user);

  // edit mode toggle
  function setEditMode(on){
    if(on){
      nameInput.disabled = false; picInput.disabled = false;
      editBtn.classList.add('hidden'); saveBtn.classList.remove('hidden'); cancelBtn.classList.remove('hidden');
      nameInput.focus();
    }else{
      nameInput.disabled = true; picInput.disabled = false; // keep file input usable
      editBtn.classList.remove('hidden'); saveBtn.classList.add('hidden'); cancelBtn.classList.add('hidden');
    }
  }

  editBtn?.addEventListener('click', () => setEditMode(true));
  cancelBtn?.addEventListener('click', () => { populate(getUser()); setEditMode(false); });

  let pendingImageData = null;
  picInput?.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingImageData = reader.result; // data URL
      picPreview.src = pendingImageData;
    };
    reader.readAsDataURL(f);
  });

  saveBtn?.addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    if(!newName){ return showToast('Please enter your full name', 'warning'); }

    // prepare payload
    const payload = { fullName: newName };
    if(pendingImageData) payload.profilePicture = pendingImageData;

    // optimistic UI update
    const oldUser = { ...getUser() };
    const newUser = { ...oldUser, fullName: newName };
    if(pendingImageData) newUser.profilePicture = pendingImageData;
    saveUser(newUser);
    populate(newUser);
    setEditMode(false);

    // try save to backend if available
    if(typeof apiFetch === 'function'){
      try{
        await apiFetch('/api/users/me', { method: 'PATCH', body: payload });
        showToast('Profile updated', 'success');
      }catch(err){
        // rollback local if server didn't accept
        saveUser(oldUser);
        populate(oldUser);
        showToast('Unable to save profile to server. Changes saved locally.', 'warning');
      }
    }else{
      showToast('Profile saved locally', 'success');
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    try{ await api.logout(); }catch(e){}
    localStorage.removeItem('ff_user');
    location.href = 'login.html';
  });

  // copy referral code/link
  document.getElementById('copy-ref-code')?.addEventListener('click', () => {
    const code = getUser()?.referralCode || '';
    if(!code) return showToast('No referral code to copy', 'warning');
    navigator.clipboard.writeText(code).then(() => showToast('Referral code copied', 'success')).catch(() => showToast('Unable to copy', 'error'));
  });
  document.getElementById('copy-ref-link')?.addEventListener('click', () => {
    const link = document.getElementById('profile-ref-link')?.href || '';
    if(!link) return showToast('No link to copy', 'warning');
    navigator.clipboard.writeText(link).then(() => showToast('Referral link copied', 'success')).catch(() => showToast('Unable to copy', 'error'));
  });

});