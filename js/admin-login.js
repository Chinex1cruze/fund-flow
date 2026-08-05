document.addEventListener('DOMContentLoaded', async () => {
  const tokenInput = document.getElementById('admin-token');
  const form = document.getElementById('admin-login-form');
  if(!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const adminToken = (tokenInput?.value || '').trim();
    if(!adminToken){
      showToast('Admin token is required', 'warning');
      return;
    }

    try {
      // Call server-side login which will set a secure httpOnly cookie for the admin session
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: adminToken })
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok) throw new Error(data.message || 'Admin token is invalid');
      showToast('Admin access verified', 'success');
      setTimeout(() => {
        // Redirect to /admin; server will gate this route and allow because of the session cookie
        location.href = 'admin';
      }, 700);
    } catch (err) {
      showToast(err.message || 'Admin login failed', 'error');
    }
  });
});
