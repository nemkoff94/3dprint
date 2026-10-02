function formatPrice(value) {
  return `от ${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function updateMeta(title, description) {
  document.title = title;
  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', description);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function categoryLabel(category) {
  const map = {
    cafes: 'Кафе и рестораны',
    shops: 'Магазины',
    beauty: 'Салоны красоты',
    flowers: 'Цветочные магазины',
    offices: 'Офисы',
    other: 'Другое'
  };

  return map[category] || 'Другое';
}

function lightingLabel(lighting) {
  if (!lighting) return '-';
  return lighting;
}

function resolveImageUrl(image) {
  if (!image) {
    return null;
  }

  if (String(image).startsWith('/')) {
    return image;
  }

  if (String(image).startsWith('products/')) {
    return `/uploads/${image}`;
  }

  return `/uploads/products/${image}`;
}

function renderImageMarkup(product) {
  const imageUrl = resolveImageUrl(product.image);

  if (imageUrl) {
    return `<img src="${imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy" />`;
  }

  return `<span class="catalog-placeholder-label">${escapeHtml(product.name)}</span>`;
}

function renderProductCard(product) {
  const height = product.height ? `${product.height} мм` : '-';
  const depth = product.depth ? `${product.depth} мм` : '-';

  return `
    <article class="card catalog-card">
      <a class="catalog-card-image" href="/catalog/${product.slug}" aria-label="Открыть товар ${escapeHtml(product.name)}">
        ${renderImageMarkup(product)}
      </a>
      <div class="card-content catalog-card-content">
        <span class="badge">${categoryLabel(product.category)}</span>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="catalog-card-description">${escapeHtml(product.short_description || product.description || '')}</p>
        <ul class="catalog-meta-list">
          <li><strong>Высота:</strong> ${height}</li>
          <li><strong>Глубина:</strong> ${depth}</li>
          <li><strong>Материал:</strong> ${escapeHtml(product.material || '-')}</li>
          <li><strong>Подсветка:</strong> ${escapeHtml(lightingLabel(product.lighting))}</li>
        </ul>
        <div class="catalog-card-footer">
          <strong class="catalog-price">${formatPrice(product.price_from)}</strong>
          <a class="button button-primary" href="/catalog/${product.slug}">Подробнее</a>
        </div>
      </div>
    </article>
  `;
}

async function fetchProducts(filters = {}) {
  const params = new URLSearchParams();

  if (filters.category && filters.category !== 'all') {
    params.set('category', filters.category);
  }

  if (filters.type && filters.type !== 'all') {
    params.set('type', filters.type);
  }

  if (filters.lighting && filters.lighting !== 'all') {
    params.set('lighting', filters.lighting);
  }

  const response = await fetch(`/api/products?${params.toString()}`);

  if (!response.ok) {
    throw new Error('products_load_error');
  }

  return response.json();
}

function renderCatalogShell(app) {
  updateMeta(
    'Готовые объёмные вывески для бизнеса - 3Dело',
    'Готовые объёмные буквы и вывески для кафе, магазинов, салонов и других компаний. Выберите готовый вариант или адаптируйте его под свои размеры.'
  );

  app.innerHTML = `
    <section class="section catalog-hero">
      <div class="container catalog-hero-grid">
        <div>
          <span class="badge">Каталог 3Dело</span>
          <h1 class="section-title catalog-main-title">Готовые вывески для бизнеса</h1>
          <p class="section-subtitle">Популярные варианты объёмных вывесок. Можно адаптировать под размеры, цвет и место установки.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="#catalog-grid">Выбрать вывеску</a>
            <a class="button button-secondary" href="#catalog-cta">Сделать на заказ</a>
          </div>
        </div>
        <div class="catalog-hero-visual" role="img" aria-label="Плейсхолдер готовой вывески">
          <p class="hero-placeholder-label">место для фото ваших проектов</p>
        </div>
      </div>
    </section>

    <section class="section catalog-filters-wrap">
      <div class="container">
        <div class="catalog-filters-header">
          <h2 class="section-title">Фильтры</h2>
          <button class="button button-secondary catalog-filter-toggle" id="filterToggle" type="button">Показать фильтры</button>
        </div>

        <div class="catalog-filters" id="catalogFilters">
          <label>
            Категория
            <select id="filterCategory" class="select">
              <option value="all">Все</option>
              <option value="cafes">Кафе и рестораны</option>
              <option value="shops">Магазины</option>
              <option value="beauty">Салоны красоты</option>
              <option value="flowers">Цветочные магазины</option>
              <option value="offices">Офисы</option>
              <option value="other">Другое</option>
            </select>
          </label>

          <label>
            Тип
            <select id="filterType" class="select">
              <option value="all">Все</option>
              <option value="volumetric-letters">Объёмные буквы</option>
              <option value="ready-sign">Готовая вывеска</option>
              <option value="logo">Логотип</option>
              <option value="sign">Табличка</option>
              <option value="other">Другое</option>
            </select>
          </label>

          <label>
            Подсветка
            <select id="filterLighting" class="select">
              <option value="all">Все</option>
              <option value="Без подсветки">Без подсветки</option>
              <option value="Опционально">Опционально</option>
              <option value="Задняя подсветка">Задняя подсветка</option>
            </select>
          </label>

          <label>
            Цена
            <select id="filterPrice" class="select">
              <option value="all">Все</option>
              <option value="0-10000">До 10 000 ₽</option>
              <option value="10000-20000">10 000-20 000 ₽</option>
              <option value="20000-50000">20 000-50 000 ₽</option>
              <option value="50000-9999999">От 50 000 ₽</option>
            </select>
          </label>
        </div>
      </div>
    </section>

    <section class="section catalog-list-section" id="catalog-grid">
      <div class="container">
        <div class="catalog-results-head">
          <h2 class="section-title">Каталог товаров</h2>
          <p class="section-subtitle" id="catalogResultsCount"></p>
        </div>
        <div id="catalogGrid" class="grid catalog-grid"></div>
      </div>
    </section>

    <section class="container cta" id="catalog-cta">
      <div class="cta-box">
        <div>
          <h2>Нужна вывеска, которой нет в каталоге?</h2>
          <p>Оставьте заявку, и мы предложим индивидуальное решение под ваш проект.</p>
        </div>
        <a class="button button-primary" href="mailto:hello@3delo.org">Сделать запрос</a>
      </div>
    </section>
  `;
}

function renderPublicError(grid) {
  grid.innerHTML = `
    <article class="card catalog-empty">
      <div class="card-content">
        <h3>Не удалось загрузить каталог. Попробуйте обновить страницу.</h3>
      </div>
    </article>
  `;
}

function applyPriceFilter(products, value) {
  if (value === 'all') {
    return products;
  }

  const [rawMin, rawMax] = value.split('-');
  const min = Number(rawMin);
  const max = Number(rawMax);

  return products.filter((item) => item.price_from >= min && item.price_from <= max);
}

async function renderCatalogPage(app) {
  renderCatalogShell(app);

  const catalogGrid = document.getElementById('catalogGrid');
  const catalogResultsCount = document.getElementById('catalogResultsCount');
  const filterCategory = document.getElementById('filterCategory');
  const filterType = document.getElementById('filterType');
  const filterLighting = document.getElementById('filterLighting');
  const filterPrice = document.getElementById('filterPrice');

  const state = {
    category: 'all',
    type: 'all',
    lighting: 'all',
    price: 'all'
  };

  async function loadProducts() {
    try {
      const apiItems = await fetchProducts(state);
      const visible = applyPriceFilter(apiItems, state.price);

      catalogResultsCount.textContent = `Найдено вариантов: ${visible.length}`;

      if (!visible.length) {
        catalogGrid.innerHTML = `
          <article class="card catalog-empty">
            <div class="card-content">
              <h3>Сейчас каталог обновляется</h3>
              <p>Новые готовые решения появятся здесь совсем скоро.</p>
            </div>
          </article>
        `;
        return;
      }

      catalogGrid.innerHTML = visible.map(renderProductCard).join('');
    } catch (_error) {
      renderPublicError(catalogGrid);
      catalogResultsCount.textContent = '';
    }
  }

  [filterCategory, filterType, filterLighting, filterPrice].forEach((select) => {
    select.addEventListener('change', () => {
      state.category = filterCategory.value;
      state.type = filterType.value;
      state.lighting = filterLighting.value;
      state.price = filterPrice.value;
      loadProducts();
    });
  });

  const filterToggle = document.getElementById('filterToggle');
  const filtersPanel = document.getElementById('catalogFilters');
  if (filterToggle && filtersPanel) {
    filterToggle.addEventListener('click', () => {
      const isOpen = filtersPanel.classList.toggle('is-open');
      filterToggle.textContent = isOpen ? 'Скрыть фильтры' : 'Показать фильтры';
    });
  }

  await loadProducts();
}

async function renderProductPage(app, slug) {
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}`);

    if (response.status === 404) {
      updateMeta('Товар не найден - 3Dело', 'Запрошенная страница товара не найдена.');
      app.innerHTML = `
        <section class="section">
          <div class="container">
            <article class="card">
              <div class="card-content">
                <h1 class="section-title">Товар не найден</h1>
                <p class="section-subtitle">Проверьте ссылку или выберите другой вариант в каталоге.</p>
                <a class="button button-primary" href="/catalog">Вернуться в каталог</a>
              </div>
            </article>
          </div>
        </section>
      `;
      return;
    }

    if (!response.ok) {
      throw new Error('product_load_error');
    }

    const product = await response.json();
    updateMeta(`Объёмная вывеска «${product.name}» - 3Dело`, product.short_description || product.description || 'Готовая вывеска из каталога 3Dело.');

    const related = (await fetchProducts({ category: product.category })).filter((item) => item.slug !== product.slug).slice(0, 3);

    const imageMarkup = renderImageMarkup(product);

    app.innerHTML = `
      <section class="section product-page">
        <div class="container">
          <nav class="breadcrumbs" aria-label="Хлебные крошки">
            <a href="/">Главная</a>
            <span>/</span>
            <a href="/catalog">Каталог</a>
            <span>/</span>
            <span>${escapeHtml(product.name)}</span>
          </nav>

          <div class="product-layout">
            <div class="product-image" role="img" aria-label="Изображение ${escapeHtml(product.name)}">
              ${imageMarkup}
            </div>

            <article class="product-main card">
              <div class="card-content">
                <span class="badge">${categoryLabel(product.category)}</span>
                <h1>Объёмная вывеска «${escapeHtml(product.name)}»</h1>
                <p class="section-subtitle product-description">${escapeHtml(product.description || product.short_description || '')}</p>
                <p class="product-price">${formatPrice(product.price_from)}</p>

                <section class="product-section">
                  <h2>Характеристики</h2>
                  <ul class="product-list">
                    <li><strong>Высота:</strong> ${product.height ? `${product.height} мм` : '-'}</li>
                    <li><strong>Ширина:</strong> ${product.width ? `${product.width} мм` : '-'}</li>
                    <li><strong>Глубина:</strong> ${product.depth ? `${product.depth} мм` : '-'}</li>
                    <li><strong>Материал:</strong> ${escapeHtml(product.material || '-')}</li>
                    <li><strong>Цвет:</strong> ${escapeHtml(product.color || '-')}</li>
                    <li><strong>Подсветка:</strong> ${escapeHtml(lightingLabel(product.lighting))}</li>
                    <li><strong>Шрифт:</strong> ${escapeHtml(product.font || '-')}</li>
                    <li><strong>Крепление:</strong> ${escapeHtml(product.mounting || '-')}</li>
                  </ul>
                </section>

                <div class="product-actions">
                  <button
                    class="button button-primary"
                    type="button"
                    data-open-order-modal
                    data-order-service="custom-sign"
                    data-order-comment="Интересует вывеска «${escapeHtml(product.name)}»."
                  >
                    Заказать эту вывеску
                  </button>
                  <a class="button button-secondary" href="/catalog">Все товары</a>
                </div>
              </div>
            </article>
          </div>

          <section class="section product-related">
            <h2 class="section-title">Похожие решения</h2>
            <div class="grid catalog-grid">
              ${related.length ? related.map(renderProductCard).join('') : '<article class="card catalog-empty"><div class="card-content"><h3>Похожие товары появятся позже</h3></div></article>'}
            </div>
          </section>
        </div>
      </section>
    `;
  } catch (_error) {
    app.innerHTML = `
      <section class="section">
        <div class="container">
          <article class="card catalog-empty">
            <div class="card-content">
              <h1 class="section-title">Не удалось загрузить каталог. Попробуйте обновить страницу.</h1>
              <a class="button button-primary" href="/catalog">Перейти в каталог</a>
            </div>
          </article>
        </div>
      </section>
    `;
  }
}

async function initCatalog() {
  const app = document.getElementById('catalogApp');
  if (!app) {
    return;
  }

  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/catalog') {
    await renderCatalogPage(app);
    return;
  }

  if (path.startsWith('/catalog/')) {
    const slug = path.split('/').filter(Boolean)[1];
    await renderProductPage(app, slug);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCatalog();
});
