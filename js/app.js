// App shell: load components and simple client-side routing/helpers
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-include]').forEach(async el => {
    const url = el.getAttribute('data-include');
    try{
      const res = await fetch(url);
      if(res.ok) el.innerHTML = await res.text();
    }catch(e){console.error('Include failed', url, e)}
  });

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const isAuthenticatedUserPage = ['dashboard.html', 'deposit.html', 'withdraw.html', 'vip.html', 'profile.html', 'referral.html'].includes(page)
  const showBottomNav = () => {
    const bottomNav = document.querySelector('.bottom-nav');
    if(!bottomNav) return;
    const hasSession = !!(localStorage.getItem('ff_user') && JSON.parse(localStorage.getItem('ff_user') || '{}').id);
    if(isAuthenticatedUserPage && hasSession){
      bottomNav.classList.add('visible');
    } else {
      bottomNav.classList.remove('visible');
    }
  };

  setTimeout(showBottomNav, 120);

  document.addEventListener('click', async (e)=>{
    if(e.target && (e.target.id === 'logout' || e.target.id === 'logout-btn')){
      localStorage.removeItem('ff_user');
      localStorage.removeItem('ff_show_community');
      localStorage.removeItem('ff_community_dismissed');
      if(typeof api !== 'undefined' && api.logout){
        try{ await api.logout(); }catch(err){ console.warn('Logout failed', err); }
      }
      location.href = 'login.html';
    }
  });
});
