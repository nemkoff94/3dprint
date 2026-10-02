(function () {
  const SERVICE_OPTIONS = [
    { value: '', label: 'Выберите услугу' },
    { value: 'custom-sign', label: 'Объёмная вывеска' },
    { value: '3d-print', label: '3D-печать' },
    { value: 'modeling', label: '3D-моделирование' },
    { value: 'other-prototyping', label: 'Прототипирование' },
    { value: 'other', label: 'Другое' }
  ];

  function normalizeService(value) {
    return value === 'other-prototyping' ? 'other' : value;
  }

  function getDefaultComment() {
    return '';
  }

  function createServiceOptions(selectedService) {
    return SERVICE_OPTIONS.map((option) => {
      const normalizedValue = normalizeService(option.value);
      const isSelected = selectedService && normalizedValue === selectedService && option.value !== '';
      return `<option value="${option.value}" ${isSelected ? 'selected' : ''}>${option.label}</option>`;
    }).join('');
  }

  function createFormMarkup(config) {
    const selectedService = config && config.service ? config.service : '';
    const defaultComment = config && config.comment ? config.comment : getDefaultComment();

    return `
      <section class="order-form-shell" data-order-form-shell>
        <div class="order-form-head">
          <h3 class="order-form-title">Расскажите о задаче</h3>
          <p class="order-form-subtitle">Опишите, что нужно изготовить или разработать. Мы разберёмся в задаче и предложим подходящий вариант.</p>
        </div>

        <form class="order-form" data-order-form novalidate>
          <div class="order-form-grid">
            <label class="order-field">
              <span>Имя</span>
              <input class="order-input" type="text" name="name" placeholder="Как к вам обращаться" required />
            </label>

            <label class="order-field">
              <span>Телефон</span>
              <input class="order-input" type="tel" name="phone" placeholder="+7 ___ ___-__-__" required />
            </label>

            <label class="order-field">
              <span>Email</span>
              <input class="order-input" type="email" name="email" placeholder="you@example.com" />
            </label>

            <label class="order-field">
              <span>Что нужно сделать?</span>
              <select class="order-input" name="service" required>
                ${createServiceOptions(selectedService)}
              </select>
            </label>

            <label class="order-field">
              <span>Количество</span>
              <input class="order-input" type="text" name="quantity" inputmode="numeric" placeholder="Например, 10" />
            </label>

            <label class="order-field order-field-wide">
              <span>Описание задачи</span>
              <textarea class="order-input order-textarea" name="comment" placeholder="Например: нужны объёмные буквы «КОФЕЙНЯ», высота около 300 мм, белый цвет, с подсветкой.">${defaultComment}</textarea>
            </label>

            <label class="order-field order-field-wide">
              <span>Прикрепить файл</span>
              <input class="order-input" type="file" name="file" accept=".stl,.3mf,.obj,.step,.stp,.pdf,.jpg,.jpeg,.png" />
              <small class="order-field-hint">STL, 3MF, OBJ, STEP, PDF, JPG или PNG до 20 МБ</small>
            </label>

            <label class="order-consent order-field-wide">
              <input type="checkbox" name="consent" value="true" required />
              <span>Я согласен на обработку предоставленных данных для связи по моей заявке.</span>
            </label>
          </div>

          <p class="order-form-message" data-order-form-message aria-live="polite"></p>

          <button class="button button-primary order-submit" type="submit" data-order-submit>Отправить заявку</button>
        </form>

        <section class="order-state order-state-success" data-order-success hidden>
          <h3>Заявка отправлена</h3>
          <p>Спасибо! Мы получили вашу заявку и свяжемся с вами, чтобы уточнить детали.</p>
          <button class="button button-primary" type="button" data-order-reset>Отправить ещё одну заявку</button>
        </section>

        <section class="order-state order-state-error" data-order-error hidden>
          <h3>Не удалось отправить заявку</h3>
          <p>Попробуйте ещё раз через несколько секунд.</p>
          <button class="button button-primary" type="button" data-order-retry>Повторить</button>
        </section>
      </section>
    `;
  }

  function setMessage(shell, text) {
    const message = shell.querySelector('[data-order-form-message]');
    if (!message) {
      return;
    }

    message.textContent = text || '';
  }

  function setLoading(shell, loading) {
    const submit = shell.querySelector('[data-order-submit]');
    if (!submit) {
      return;
    }

    submit.disabled = loading;
    submit.textContent = loading ? 'Отправляем...' : 'Отправить заявку';
  }

  function showFormState(shell, stateName) {
    const form = shell.querySelector('[data-order-form]');
    const success = shell.querySelector('[data-order-success]');
    const error = shell.querySelector('[data-order-error]');

    if (!form || !success || !error) {
      return;
    }

    form.hidden = stateName !== 'form';
    success.hidden = stateName !== 'success';
    error.hidden = stateName !== 'error';
  }

  function applyPrefill(shell, prefill) {
    if (!prefill) {
      return;
    }

    const form = shell.querySelector('[data-order-form]');
    if (!form) {
      return;
    }

    const service = form.elements.service;
    const comment = form.elements.comment;

    if (service && prefill.service) {
      service.value = prefill.service;
    }

    if (comment && prefill.comment) {
      comment.value = prefill.comment;
    }
  }

  async function submitOrder(shell) {
    const form = shell.querySelector('[data-order-form]');
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const serviceRaw = String(formData.get('service') || '').trim();
    const service = normalizeService(serviceRaw);
    const email = String(formData.get('email') || '').trim();
    const quantity = String(formData.get('quantity') || '').trim();
    const consent = formData.get('consent');

    if (!name || !phone || !service) {
      setMessage(shell, 'Заполните обязательные поля: имя, телефон и услугу.');
      return;
    }

    if (!consent) {
      setMessage(shell, 'Подтвердите согласие на обработку данных.');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage(shell, 'Укажите корректный email.');
      return;
    }

    if (quantity && !/^\d{1,6}$/.test(quantity)) {
      setMessage(shell, 'Количество должно быть положительным числом.');
      return;
    }

    formData.set('service', service);
    formData.set('source_page', window.location.pathname || '/');

    setMessage(shell, '');
    setLoading(shell, true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        body: formData
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch (_err) {
        payload = null;
      }

      if (!response.ok) {
        if (response.status >= 500) {
          showFormState(shell, 'error');
          return;
        }

        setMessage(shell, payload && payload.message ? payload.message : 'Проверьте заполнение полей и попробуйте снова.');
        return;
      }

      showFormState(shell, 'success');
    } catch (_err) {
      showFormState(shell, 'error');
    } finally {
      setLoading(shell, false);
    }
  }

  function bindShellEvents(shell) {
    const form = shell.querySelector('[data-order-form]');
    const resetButton = shell.querySelector('[data-order-reset]');
    const retryButton = shell.querySelector('[data-order-retry]');

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitOrder(shell);
      });
    }

    if (resetButton && form) {
      resetButton.addEventListener('click', () => {
        form.reset();
        setMessage(shell, '');
        showFormState(shell, 'form');
      });
    }

    if (retryButton) {
      retryButton.addEventListener('click', () => {
        showFormState(shell, 'form');
      });
    }
  }

  function renderInlineOrderForm(target, config) {
    if (!target) {
      return null;
    }

    target.innerHTML = createFormMarkup(config || {});
    const shell = target.querySelector('[data-order-form-shell]');

    if (!shell) {
      return null;
    }

    bindShellEvents(shell);
    return shell;
  }

  function createModal() {
    const wrapper = document.createElement('div');
    wrapper.className = 'order-modal';
    wrapper.id = 'orderModal';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = `
      <div class="order-modal-backdrop" data-order-modal-close></div>
      <div class="order-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="orderModalTitle">
        <button class="order-modal-close" type="button" aria-label="Закрыть" data-order-modal-close>&times;</button>
        <div class="order-modal-body" data-order-modal-body></div>
      </div>
    `;

    document.body.appendChild(wrapper);
    return wrapper;
  }

  function initOrderModal() {
    const modal = createModal();
    const body = modal.querySelector('[data-order-modal-body]');
    const shell = renderInlineOrderForm(body, {});

    if (!shell) {
      return;
    }

    const openModal = function (prefill) {
      applyPrefill(shell, prefill || {});
      showFormState(shell, 'form');
      setMessage(shell, '');
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    };

    const closeModal = function () {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-order-modal-close]')) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-open-order-modal]');
      if (!trigger) {
        return;
      }

      event.preventDefault();
      const prefill = {
        service: normalizeService(trigger.getAttribute('data-order-service') || ''),
        comment: trigger.getAttribute('data-order-comment') || ''
      };
      openModal(prefill);
    });

    window.OrderFormModal = {
      open: openModal,
      close: closeModal
    };
  }

  function initInlineForms() {
    const customSignTarget = document.getElementById('customSignOrderFormMount');
    if (customSignTarget) {
      renderInlineOrderForm(customSignTarget, { service: 'custom-sign' });
    }

    const printTarget = document.getElementById('printOrderFormMount');
    if (printTarget) {
      renderInlineOrderForm(printTarget, { service: '3d-print' });
    }

    const modelingTarget = document.getElementById('modelingOrderFormMount');
    if (modelingTarget) {
      renderInlineOrderForm(modelingTarget, { service: 'modeling' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initInlineForms();
    initOrderModal();
  });
})();
