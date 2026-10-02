(function () {
  async function apiRequest(url, options = {}) {
    const isFormData = options.body instanceof FormData;

    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      }
    });

    if (response.status === 401) {
      window.location.href = '/admin/';
      throw new Error('UNAUTHORIZED');
    }

    return response;
  }

  async function ensureAdminAuth() {
    const response = await apiRequest('/api/admin/me', { method: 'GET' });
    if (!response.ok) {
      window.location.href = '/admin/';
    }
  }

  async function logoutAdmin() {
    await apiRequest('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/';
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const errorEl = document.getElementById('loginError');
    const formData = new FormData(form);

    if (errorEl) {
      errorEl.textContent = '';
    }

    const payload = {
      login: String(formData.get('login') || '').trim(),
      password: String(formData.get('password') || '')
    };

    try {
      const response = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Неверный логин или пароль');
      }

      window.location.href = '/admin/orders';
    } catch (_error) {
      if (errorEl) {
        errorEl.textContent = 'Неверный логин или пароль';
      }
    }
  }

  function bindLogoutButton() {
    const button = document.getElementById('logoutBtn');
    if (!button) {
      return;
    }

    button.addEventListener('click', () => {
      logoutAdmin();
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const pageType = document.body.getAttribute('data-admin-page');
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
      try {
        const meResponse = await fetch('/api/admin/me', { credentials: 'same-origin' });
        if (meResponse.ok) {
          window.location.href = '/admin/orders';
          return;
        }
      } catch (_error) {
        // ignore network check errors on login page and let user submit form
      }

      loginForm.addEventListener('submit', handleLoginSubmit);
      return;
    }

    if (
      pageType === 'orders-list' ||
      pageType === 'order-detail' ||
      pageType === 'products-list' ||
      pageType === 'product-form'
    ) {
      await ensureAdminAuth();
      bindLogoutButton();
    }
  });

  window.adminApiRequest = apiRequest;
})();
