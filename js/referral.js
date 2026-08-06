document.addEventListener('DOMContentLoaded', ()=>{
  const u = requireAuth();
  const refLinkEl = document.getElementById('ref-link');
  const countEl = document.getElementById('ref-count');
  const earnEl = document.getElementById('ref-earn');
  if(refLinkEl){ refLinkEl.value = location.origin + location.pathname + '?ref=' + (u.phone||''); }
  if(countEl) countEl.textContent = 'Referrals: ' + (u.referrals||0);
  if(earnEl) earnEl.textContent = 'Referral Earnings: ₦' + formatN(u.refEarnings||0);
  document.getElementById('copy-ref')?.addEventListener('click', async () => {
    try{
      await navigator.clipboard.writeText(refLinkEl.value);
      showToast('Referral link copied to clipboard', 'success');
    }catch(err){
      console.error(err);
      showToast('Unable to copy referral link', 'error');
    }
  });

  document.getElementById('share-ref')?.addEventListener('click', async () => {
    const shareText = `Invite friends to FundFlow and earn rewards! Use my referral link: ${refLinkEl.value}`;
    try {
      if(navigator.share){
        await navigator.share({ title: 'FundFlow Referral', text: shareText, url: refLinkEl.value });
        showToast('Referral shared successfully', 'success');
        return;
      }
      const whatsapp = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsapp, '_blank');
    } catch (err) {
      console.error(err);
      showToast('Unable to share referral link', 'error');
    }
  });
});
