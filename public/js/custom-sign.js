function formatPrice(value) {
  return `от ${Number(value || 0).toLocaleString('ru-RU')} ₽`;
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

function resolveImageUrl(image) {
  if (!image) return null;
  if (String(image).startsWith('/')) return image;
  if (String(image).startsWith('products/')) return `/uploads/${image}`;
  return `/uploads/products/${image}`;
}

function renderPopularCard(product) {
  const imageUrl = resolveImageUrl(product.image);
  const imageMarkup = imageUrl
    ? `<img src="${imageUrl}" alt="${product.name}" loading="lazy" />`
    : `<span class="catalog-placeholder-label">${product.name}</span>`;

  return `
    <article class="card catalog-card reveal">
      <a class="catalog-card-image" href="/catalog/${product.slug}" aria-label="Открыть товар ${product.name}">
        ${imageMarkup}
      </a>
      <div class="card-content catalog-card-content">
        <span class="badge">${categoryLabel(product.category)}</span>
        <h3>${product.name}</h3>
        <p class="catalog-card-description">${product.short_description || product.description || ''}</p>
        <div class="catalog-card-footer">
          <strong class="catalog-price">${formatPrice(product.price_from)}</strong>
          <a class="button button-primary" href="/catalog/${product.slug}">Подробнее</a>
        </div>
      </div>
    </article>
  `;
}

async function initCustomSignPopular() {
  const grid = document.getElementById('customPopularGrid');

  if (!grid) {
    return;
  }

  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error('products_load_error');
    }

    const products = await response.json();
    const targetSlugs = ['kofeynya', 'tsvety', 'salon-krasoty'];

    const items = targetSlugs
      .map((slug) => products.find((item) => item.slug === slug))
      .filter(Boolean);

    if (!items.length) {
      grid.innerHTML = `
        <article class="card catalog-empty">
          <div class="card-content">
            <h3>Популярные позиции появятся здесь</h3>
            <p>Каталог временно обновляется.</p>
          </div>
        </article>
      `;
      return;
    }

    grid.innerHTML = items.map(renderPopularCard).join('');
  } catch (_error) {
    grid.innerHTML = `
      <article class="card catalog-empty">
        <div class="card-content">
          <h3>Не удалось загрузить каталог. Попробуйте обновить страницу.</h3>
        </div>
      </article>
    `;
  }
}

function initCustomSignTimeline() {
  const timeline = document.querySelector('.custom-timeline');

  if (!timeline) {
    return;
  }

  const items = Array.from(timeline.querySelectorAll('.custom-timeline-item'));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateTimelineProgress = () => {
    const rect = timeline.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const travel = rect.height + viewportHeight * 0.24;
    const passed = viewportHeight * 0.78 - rect.top;
    const progress = Math.max(0, Math.min(1, passed / travel));

    timeline.style.setProperty('--timeline-progress', `${(progress * 100).toFixed(2)}%`);
  };

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    timeline.classList.add('is-animated');

    const itemObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        threshold: 0.22,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    items.forEach((item) => itemObserver.observe(item));
  } else {
    items.forEach((item) => item.classList.add('is-visible'));
  }

  updateTimelineProgress();

  window.addEventListener('scroll', updateTimelineProgress, { passive: true });
  window.addEventListener('resize', updateTimelineProgress);
}

document.addEventListener('DOMContentLoaded', () => {
  initCustomSignPopular();
  initCustomSignTimeline();
});
