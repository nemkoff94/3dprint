const loginForm = document.getElementById('loginForm');
const errorEl = document.getElementById('error');

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const formData = new FormData(loginForm);

  const payload = {
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || '')
  };

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Ошибка входа');
    }

    window.location.href = '/admin';
  } catch (error) {
    errorEl.textContent = error.message;
  }
});
