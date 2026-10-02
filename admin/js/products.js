function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatPrice(value) {
  return `от ${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function categoryLabel(value) {
  const map = {
    cafes: 'Кафе и рестораны',
    shops: 'Магазины',
    beauty: 'Салоны красоты',
    flowers: 'Цветочные магазины',
    offices: 'Офисы',
    other: 'Другое'
  };

  return map[value] || 'Другое';
}

function resolveImageUrl(image) {
  if (!image) return null;
  if (String(image).startsWith('/')) return image;
  if (String(image).startsWith('products/')) return `/uploads/${image}`;
  return `/uploads/products/${image}`;
}

function debounce(fn, delay) {
  let timer = null;

  return (...args) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

async function loadProductsList() {
  const statusFilter = document.getElementById('productStatusFilter');
  const categoryFilter = document.getElementById('productCategoryFilter');
  const searchFilter = document.getElementById('productSearchFilter');
  const tableBody = document.getElementById('productsTableBody');
  const emptyState = document.getElementById('productsEmptyState');

  const params = new URLSearchParams();
  if (statusFilter.value && statusFilter.value !== 'all') params.set('status', statusFilter.value);
  if (categoryFilter.value && categoryFilter.value !== 'all') params.set('category', categoryFilter.value);
  if (searchFilter.value.trim()) params.set('search', searchFilter.value.trim());

  const response = await window.adminApiRequest(`/api/admin/products?${params.toString()}`);
  if (!response.ok) return;

  const payload = await response.json();
  const products = payload.products || [];

  tableBody.innerHTML = '';

  for (const product of products) {
    const tr = document.createElement('tr');
    const imageUrl = resolveImageUrl(product.image);
    const imageCell = imageUrl
      ? `<img class="admin-product-thumb" src="${imageUrl}" alt="${product.name}" loading="lazy" />`
      : '<span class="admin-product-thumb admin-product-thumb-empty">Нет фото</span>';

    const statusText = product.is_active ? 'Опубликован' : 'Скрыт';
    const statusClass = product.is_active ? 'admin-status-published' : 'admin-status-hidden';

    tr.innerHTML = `
      <td>${imageCell}</td>
      <td>
        <strong>${product.name}</strong><br />
        <small>/${product.slug}</small>
      </td>
      <td>${categoryLabel(product.category)}</td>
      <td>${formatPrice(product.price_from)}</td>
      <td><span class="admin-status-badge ${statusClass}">${statusText}</span></td>
      <td>${product.sort_order ?? '-'}</td>
      <td>${formatDate(product.updated_at)}</td>
      <td>
        <div class="admin-row-actions">
          <a class="admin-btn admin-btn-ghost" href="/admin/product.html?id=${product.id}">Редактировать</a>
          <button type="button" class="admin-btn admin-btn-ghost" data-action="toggle" data-id="${product.id}" data-active="${product.is_active}">
            ${product.is_active ? 'Скрыть' : 'Опубликовать'}
          </button>
          <button type="button" class="admin-btn admin-btn-danger" data-action="delete" data-id="${product.id}">Удалить</button>
        </div>
      </td>
    `;

    tableBody.appendChild(tr);
  }

  emptyState.hidden = products.length !== 0;
}

async function toggleProductStatus(id, isActive) {
  const response = await window.adminApiRequest(`/api/admin/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive ? 0 : 1 })
  });

  if (!response.ok) {
    window.alert('Не удалось изменить статус товара');
    return;
  }

  await loadProductsList();
}

async function deleteProduct(id) {
  const confirmed = window.confirm('Удалить товар?\n\nЕсли товар опубликован, он будет скрыт.');
  if (!confirmed) return;

  const response = await window.adminApiRequest(`/api/admin/products/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    window.alert('Не удалось удалить товар');
    return;
  }

  const data = await response.json();
  if (data.mode === 'hidden') {
    window.alert('Товар был скрыт. Повторите удаление, чтобы удалить физически.');
  }

  await loadProductsList();
}

function bindProductsListEvents() {
  const statusFilter = document.getElementById('productStatusFilter');
  const categoryFilter = document.getElementById('productCategoryFilter');
  const searchFilter = document.getElementById('productSearchFilter');
  const tableBody = document.getElementById('productsTableBody');

  statusFilter.addEventListener('change', () => loadProductsList());
  categoryFilter.addEventListener('change', () => loadProductsList());
  searchFilter.addEventListener('input', debounce(() => loadProductsList(), 250));

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = Number(button.getAttribute('data-id'));
    const action = button.getAttribute('data-action');

    if (!Number.isInteger(id) || id <= 0) return;

    if (action === 'toggle') {
      const isActive = Number(button.getAttribute('data-active')) === 1;
      await toggleProductStatus(id, isActive);
    }

    if (action === 'delete') {
      await deleteProduct(id);
    }
  });
}

function fillProductForm(form, product) {
  form.elements.name.value = product.name || '';
  form.elements.slug.value = product.slug || '';
  form.elements.category.value = product.category || 'other';
  form.elements.type.value = product.type || 'other';
  form.elements.short_description.value = product.short_description || '';
  form.elements.description.value = product.description || '';
  form.elements.price_from.value = product.price_from ?? 0;
  form.elements.height.value = product.height ?? '';
  form.elements.width.value = product.width ?? '';
  form.elements.depth.value = product.depth ?? '';
  form.elements.material.value = product.material || '';
  form.elements.color.value = product.color || '';
  form.elements.lighting.value = product.lighting || '';
  form.elements.font.value = product.font || '';
  form.elements.mounting.value = product.mounting || '';
  form.elements.sort_order.value = product.sort_order ?? 1000;
  form.elements.is_active.checked = product.is_active === 1;

  const hint = document.getElementById('currentImageHint');
  const imageUrl = resolveImageUrl(product.image);
  if (hint) {
    hint.textContent = imageUrl ? `Текущее изображение: ${imageUrl}` : 'Изображение пока не загружено';
  }
}

async function loadProductById(id) {
  const response = await window.adminApiRequest(`/api/admin/products/${id}`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload.product || null;
}

async function submitProductForm(form, id) {
  const message = document.getElementById('productFormMessage');
  const saveButton = document.getElementById('saveProductBtn');
  message.textContent = '';

  const formData = new FormData(form);
  formData.set('is_active', form.elements.is_active.checked ? '1' : '0');

  saveButton.disabled = true;
  saveButton.textContent = 'Сохраняем...';

  try {
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';

    const response = await window.adminApiRequest(url, {
      method,
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Не удалось сохранить товар' }));
      message.textContent = error.error || 'Не удалось сохранить товар';
      return;
    }

    window.location.href = '/admin/products';
  } catch (_error) {
    message.textContent = 'Не удалось сохранить товар';
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Сохранить товар';
  }
}

async function bindProductForm() {
  const form = document.getElementById('productForm');
  const title = document.getElementById('productFormTitle');
  const deleteButton = document.getElementById('deleteProductBtn');
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id'));

  let product = null;

  if (Number.isInteger(id) && id > 0) {
    product = await loadProductById(id);
    if (!product) {
      window.location.href = '/admin/products';
      return;
    }

    title.textContent = `Редактировать товар #${id}`;
    deleteButton.hidden = false;
    fillProductForm(form, product);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitProductForm(form, product ? product.id : null);
  });

  deleteButton.addEventListener('click', async () => {
    const confirmed = window.confirm('Удалить товар?');
    if (!confirmed || !product) return;

    await deleteProduct(product.id);
    window.location.href = '/admin/products';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const pageType = document.body.getAttribute('data-admin-page');

  if (pageType === 'products-list') {
    bindProductsListEvents();
    await loadProductsList();
    return;
  }

  if (pageType === 'product-form') {
    await bindProductForm();
  }
});
