document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('printRequestForm');
  const status = document.getElementById('printFormStatus');
  const fileInput = document.getElementById('modelFile');
  const fileHint = document.getElementById('fileHint');

  if (fileInput && fileHint) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        fileHint.textContent = 'Можно оставить поле пустым, если модели пока нет.';
        return;
      }

      fileHint.textContent = `Выбран файл: ${file.name}. Проверим формат и модель перед расчётом.`;
    });
  }

  if (!form || !status) {
    return;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const task = String(formData.get('task') || '').trim();
    const quantity = String(formData.get('quantity') || '').trim();

    if (!name || !phone || !task || !quantity) {
      status.textContent = 'Заполните обязательные поля: имя, телефон, задача и количество.';
      status.classList.add('error-text');
      return;
    }

    status.textContent = 'Заявка зафиксирована в интерфейсе. Реальную отправку подключим на следующем этапе.';
    status.classList.remove('error-text');
  });
});
