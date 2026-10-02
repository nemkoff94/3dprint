const STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  completed: 'Завершено',
  cancelled: 'Отменено'
};

const SERVICE_LABELS = {
  'custom-sign': 'Вывеска',
  '3d-print': '3D-печать',
  modeling: '3D-моделирование',
  prototyping: 'Прототипирование',
  other: 'Другое'
};

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function createStatusBadge(status) {
  const badge = document.createElement('span');
  badge.className = `admin-status-badge admin-status-${status}`;
  badge.textContent = STATUS_LABELS[status] || status;
  return badge;
}

async function loadOrdersList() {
  const tableBody = document.getElementById('ordersTableBody');
  const emptyState = document.getElementById('ordersEmptyState');
  const statusFilter = document.getElementById('statusFilter');
  const serviceFilter = document.getElementById('serviceFilter');
  const searchFilter = document.getElementById('searchFilter');

  const params = new URLSearchParams();

  if (statusFilter.value && statusFilter.value !== 'all') {
    params.set('status', statusFilter.value);
  }

  if (serviceFilter.value && serviceFilter.value !== 'all') {
    params.set('service', serviceFilter.value);
  }

  if (searchFilter.value.trim()) {
    params.set('search', searchFilter.value.trim());
  }

  const response = await window.adminApiRequest(`/api/admin/orders?${params.toString()}`);

  if (!response.ok) {
    return;
  }

  const data = await response.json();

  document.getElementById('statTotal').textContent = String(data.stats.total || 0);
  document.getElementById('statNew').textContent = String(data.stats.new || 0);
  document.getElementById('statProgress').textContent = String(data.stats.in_progress || 0);
  document.getElementById('statCompleted').textContent = String(data.stats.completed || 0);

  tableBody.innerHTML = '';

  for (const order of data.orders) {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'button');
    tr.tabIndex = 0;
    tr.addEventListener('click', () => {
      window.location.href = `/admin/order.html?id=${order.id}`;
    });
    tr.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = `/admin/order.html?id=${order.id}`;
      }
    });

    const fileCell = order.file_path ? '📎' : '-';

    tr.innerHTML = `
      <td>#${order.id}</td>
      <td>${formatDate(order.created_at)}</td>
      <td>${order.name || '-'}</td>
      <td>${order.phone || '-'}</td>
      <td>${SERVICE_LABELS[order.service] || order.service || '-'}</td>
      <td class="order-status-cell"></td>
      <td>${fileCell}</td>
    `;

    tr.querySelector('.order-status-cell').appendChild(createStatusBadge(order.status));
    tableBody.appendChild(tr);
  }

  emptyState.hidden = data.orders.length !== 0;
}

async function loadOrderDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id'));

  if (!Number.isInteger(id) || id <= 0) {
    window.location.href = '/admin/orders';
    return;
  }

  const response = await window.adminApiRequest(`/api/admin/orders/${id}`);

  if (response.status === 404) {
    window.location.href = '/admin/orders';
    return;
  }

  if (!response.ok) {
    return;
  }

  const data = await response.json();
  const order = data.order;

  document.title = `Заявка #${order.id} | 3Dело`;
  document.getElementById('orderTitle').textContent = `Заявка #${order.id}`;
  document.getElementById('orderDate').textContent = formatDate(order.created_at);

  const statusBadgeWrap = document.getElementById('orderStatusBadge');
  statusBadgeWrap.className = '';
  const newBadge = createStatusBadge(order.status);
  statusBadgeWrap.replaceWith(newBadge);
  newBadge.id = 'orderStatusBadge';

  const statusSelect = document.getElementById('orderStatusSelect');
  statusSelect.value = order.status;
  statusSelect.addEventListener('change', async () => {
    await updateOrderStatus(order.id, statusSelect.value);
    const updated = createStatusBadge(statusSelect.value);
    const old = document.getElementById('orderStatusBadge');
    old.replaceWith(updated);
    updated.id = 'orderStatusBadge';
  });

  document.getElementById('clientName').textContent = order.name || '-';
  document.getElementById('clientPhone').textContent = order.phone || '-';
  document.getElementById('clientEmail').textContent = order.email || 'Не указан';

  document.getElementById('taskService').textContent = SERVICE_LABELS[order.service] || order.service || '-';
  document.getElementById('taskQuantity').textContent = order.quantity || 'Не указано';
  document.getElementById('taskComment').textContent = order.comment || 'Не указано';
  document.getElementById('taskSource').textContent = order.source_page || '-';

  const fileCard = document.getElementById('fileCard');
  if (order.file_path) {
    fileCard.hidden = false;
    const filename = order.file_path.split('/').pop();
    document.getElementById('fileName').textContent = filename || 'Файл';

    const link = document.getElementById('fileDownloadBtn');
    link.href = `/api/admin/orders/${order.id}/file`;
  }

  const deleteButton = document.getElementById('deleteOrderBtn');
  deleteButton.addEventListener('click', async () => {
    const confirmText = 'Заявка будет удалена без возможности восстановления.';
    const confirmed = window.confirm(`Удалить заявку?\n\n${confirmText}`);

    if (!confirmed) {
      return;
    }

    const deleteResponse = await window.adminApiRequest(`/api/admin/orders/${order.id}`, {
      method: 'DELETE'
    });

    if (deleteResponse.ok) {
      window.location.href = '/admin/orders';
    }
  });
}

async function updateOrderStatus(id, status) {
  const response = await window.adminApiRequest(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error('Не удалось изменить статус');
  }
}

function bindFilters() {
  const statusFilter = document.getElementById('statusFilter');
  const serviceFilter = document.getElementById('serviceFilter');
  const searchFilter = document.getElementById('searchFilter');

  const debounced = debounce(() => {
    loadOrdersList();
  }, 250);

  statusFilter.addEventListener('change', () => {
    loadOrdersList();
  });

  serviceFilter.addEventListener('change', () => {
    loadOrdersList();
  });

  searchFilter.addEventListener('input', debounced);
}

function debounce(fn, delay) {
  let timer = null;

  return function debouncedFunction(...args) {
    if (timer) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  const pageType = document.body.getAttribute('data-admin-page');

  if (pageType === 'orders-list') {
    bindFilters();
    await loadOrdersList();
    return;
  }

  if (pageType === 'order-detail') {
    await loadOrderDetail();
  }
});
