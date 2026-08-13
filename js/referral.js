document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth();
  const refLinkEl = document.getElementById('ref-link');
  const codeEl = document.getElementById('ref-code');
  const countEl = document.getElementById('ref-count');
  const earnEl = document.getElementById('ref-earn');
  const earnAmountEl = document.getElementById('ref-earn-amount');
  const historyEl = document.getElementById('ref-history');

  const normalizeReferralLink = (value, code) => {
    if(!value) {
      return `${window.location.origin}/register.html?ref=${encodeURIComponent(code || '')}`;
    }
    if(/^https?:\/\//i.test(value)) return value;
    if(value.startsWith('/')) return `${window.location.origin}${value}`;
    return new URL(value, window.location.origin).toString();
  };

  let data = {
    referralCode: user.referralCode || 'FF000000',
    referralLink: normalizeReferralLink(user.referralLink, user.referralCode || 'FF000000'),
    totalReferrals: user.referrals || 0,
    totalReferralEarnings: user.refEarnings || 0,
    history: []
  };

  try {
    const res = await api.getReferrals?.();
    if(res) {
      data = {
        referralCode: res.referralCode || data.referralCode,
        referralLink: normalizeReferralLink(res.referralLink || data.referralLink, res.referralCode || data.referralCode),
        totalReferrals: Number(res.totalReferrals || user.referrals || 0),
        totalReferralEarnings: Number(res.totalReferralEarnings || user.refEarnings || 0),
        history: Array.isArray(res.history) ? res.history : []
      };
    }
  } catch (error) {
    console.warn('Unable to fetch referral data, using local values.', error);
  }

  if(refLinkEl) {
    refLinkEl.value = data.referralLink;
    refLinkEl.addEventListener('click', () => {
      window.location.href = data.referralLink;
    });
  }
  if(codeEl) codeEl.textContent = data.referralCode;
  if(countEl) countEl.textContent = String(data.totalReferrals || 0);
  if(earnEl) earnEl.textContent = `₦${formatN(data.totalReferralEarnings || 0)}`;
  if(earnAmountEl) earnAmountEl.textContent = `₦${formatN(data.totalReferralEarnings || 0)}`;

  const renderHistory = (items) => {
    if(!historyEl) return;
    if(!items.length){
      historyEl.innerHTML = '<div class="empty-state">No referral rewards yet.</div>';
      return;
    }

    historyEl.innerHTML = items.slice(0, 8).map((item) => {
      const amount = Number(item.amount || 0);
      const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently';
      const note = item.meta && item.meta.depositId ? `Deposit: ${item.meta.depositId}` : 'Reward payout';
      return `
        <div class="history-row">
          <div>
            <strong>₦${formatN(amount)}</strong>
            <span>${note}</span>
          </div>
          <small>${createdAt}</small>
        </div>
      `;
    }).join('');
  };

  renderHistory(data.history);

  const copyValue = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage, 'success');
    } catch (err) {
      console.error(err);
      showToast('Unable to copy', 'error');
    }
  };

  document.getElementById('copy-ref')?.addEventListener('click', () => copyValue(data.referralCode, 'Referral code copied'));
  document.getElementById('copy-link')?.addEventListener('click', () => copyValue(data.referralLink, 'Referral link copied'));
  document.getElementById('share-ref')?.addEventListener('click', async () => {
    if(navigator.share){
      try{
        await navigator.share({ title: 'FundFlow Referral', text: 'Join FundFlow using my referral link and earn rewards.', url: data.referralLink });
      }catch(err){
        console.warn('Share canceled', err);
      }
      return;
    }
    await copyValue(data.referralLink, 'Referral link copied');
  });
});
