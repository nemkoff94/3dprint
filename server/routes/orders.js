const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db } = require('../db');

const router = express.Router();

const allowedServices = new Set(['custom-sign', '3d-print', 'modeling', 'other']);
const allowedExtensions = new Set([
  '.stl',
  '.3mf',
  '.obj',
  '.step',
  '.stp',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png'
]);

const uploadDir = path.resolve(__dirname, '..', 'uploads', 'orders');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExtension = allowedExtensions.has(extension) ? extension : '.bin';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return cb(new Error('Неподдерживаемый тип файла'));
    }

    return cb(null, true);
  }
});

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPositiveIntegerString(value) {
  return /^\d{1,6}$/.test(value) && Number(value) > 0;
}

function toSourcePath(rawValue) {
  const normalized = normalizeString(rawValue);

  if (!normalized || !normalized.startsWith('/') || normalized.length > 255) {
    return '/';
  }

  return normalized;
}

function hasLengthOverflow(values) {
  return (
    values.name.length > 120 ||
    values.phone.length > 40 ||
    values.email.length > 160 ||
    values.comment.length > 4000
  );
}

function removeUploadedFile(file) {
  if (!file || !file.path) {
    return;
  }

  fs.unlink(file.path, () => {});
}

router.post('/', upload.single('file'), (req, res) => {
  const name = normalizeString(req.body.name);
  const phone = normalizeString(req.body.phone);
  const email = normalizeString(req.body.email);
  const service = normalizeString(req.body.service);
  const quantityRaw = normalizeString(req.body.quantity);
  const comment = normalizeString(req.body.comment);
  const sourcePage = toSourcePath(req.body.source_page);
  const consent = normalizeString(req.body.consent).toLowerCase();

  if (hasLengthOverflow({ name, phone, email, comment })) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: 'Некоторые поля превышают допустимую длину'
    });
  }

  if (!name || !phone) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: 'Укажите имя и телефон'
    });
  }

  if (!service || !allowedServices.has(service)) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: 'Выберите корректную услугу'
    });
  }

  if (email && !isValidEmail(email)) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: 'Укажите корректный email'
    });
  }

  if (quantityRaw && !isPositiveIntegerString(quantityRaw)) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: 'Количество должно быть положительным числом'
    });
  }

  if (!['true', '1', 'yes', 'on'].includes(consent)) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      success: false,
      message: 'Подтвердите согласие на обработку данных'
    });
  }

  const filePath = req.file ? `/uploads/orders/${req.file.filename}` : null;
  const quantity = quantityRaw ? Number(quantityRaw) : null;

  try {
    const insert = db.prepare(`
      INSERT INTO requests (
        name,
        phone,
        email,
        service,
        quantity,
        comment,
        source_page,
        file_path,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `);

    const result = insert.run(
      name,
      phone,
      email || null,
      service,
      quantity,
      comment || null,
      sourcePage,
      filePath
    );

    return res.status(201).json({
      success: true,
      message: 'Заявка успешно отправлена',
      id: result.lastInsertRowid
    });
  } catch (_err) {
    removeUploadedFile(req.file);
    return res.status(500).json({
      success: false,
      message: 'Не удалось сохранить заявку'
    });
  }
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Файл слишком большой. Максимум 20 МБ'
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Ошибка загрузки файла'
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || 'Некорректные данные заявки'
  });
});

module.exports = router;
