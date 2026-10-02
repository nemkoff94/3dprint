async function checkAuth() {
  const response = await fetch('/api/auth/me');

  if (!response.ok) {
    window.location.href = '/admin/login';
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/admin/login';
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', logout);
});
