const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db } = require('../db');
const { router: authRouter, requireAdmin } = require('./auth');

const router = express.Router();

const allowedStatuses = new Set(['new', 'in_progress', 'completed', 'cancelled']);
const allowedServices = new Set(['custom-sign', '3d-print', 'modeling', 'prototyping', 'other']);

const serviceLabels = {
  'custom-sign': 'Вывеска',
  '3d-print': '3D-печать',
  modeling: '3D-моделирование',
  prototyping: 'Прототипирование',
  other: 'Другое'
};

const allowedProductCategories = new Set(['cafes', 'shops', 'beauty', 'flowers', 'offices', 'other']);
const allowedProductTypes = new Set(['volumetric-letters', 'ready-sign', 'logo', 'sign', 'other']);
const allowedStatusFilter = new Set(['all', 'published', 'hidden']);

const productsUploadDir = path.resolve(__dirname, '..', 'uploads', 'products');
fs.mkdirSync(productsUploadDir, { recursive: true });

const productImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productsUploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const safeExtension = extension || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExtension}`);
  }
});

const productImageUpload = multer({
  storage: productImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Допустимы только jpg, jpeg, png и webp'));
    }

    return cb(null, true);
  }
});

function normalizeInt(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed);
}

function normalizeProductPayload(body) {
  const slug = String(body.slug || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const data = {
    name: String(body.name || '').trim(),
    slug,
    category: String(body.category || '').trim(),
    type: String(body.type || '').trim(),
    short_description: String(body.short_description || '').trim(),
    description: String(body.description || '').trim(),
    price_from: normalizeInt(body.price_from, 0),
    height: normalizeInt(body.height, null),
    width: normalizeInt(body.width, null),
    depth: normalizeInt(body.depth, null),
    material: String(body.material || '').trim(),
    color: String(body.color || '').trim(),
    lighting: String(body.lighting || '').trim(),
    font: String(body.font || '').trim(),
    mounting: String(body.mounting || '').trim(),
    sort_order: normalizeInt(body.sort_order, 1000),
    is_active: String(body.is_active || '').trim()
  };

  data.is_active = ['1', 'true', 'on', 'yes'].includes(data.is_active.toLowerCase()) ? 1 : 0;

  return data;
}

function validateProductPayload(payload, { requireSlug = true } = {}) {
  if (!payload.name) {
    return 'Название обязательно';
  }

  if (requireSlug && !payload.slug) {
    return 'Slug обязателен';
  }

  if (!allowedProductCategories.has(payload.category)) {
    return 'Некорректная категория';
  }

  if (!allowedProductTypes.has(payload.type)) {
    return 'Некорректный тип';
  }

  if (!Number.isInteger(payload.price_from) || payload.price_from < 0) {
    return 'Цена должна быть числом от 0';
  }

  if (!Number.isInteger(payload.sort_order) || payload.sort_order < 0) {
    return 'Порядок сортировки должен быть числом от 0';
  }

  return null;
}

function normalizeProductRow(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    type: row.type,
    short_description: row.short_description,
    description: row.description,
    price_from: row.price_from,
    height: row.height,
    width: row.width,
    depth: row.depth,
    material: row.material,
    color: row.color,
    lighting: row.lighting,
    font: row.font,
    mounting: row.mounting,
    image: row.image,
    is_active: row.is_active,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeOrderRow(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    name: row.name,
    phone: row.phone,
    email: row.email,
    service: row.service,
    service_label: serviceLabels[row.service] || row.service,
    quantity: row.quantity,
    comment: row.comment,
    source_page: row.source_page,
    file_path: row.file_path,
    status: row.status
  };
}

function buildOrdersWhere(query) {
  const clauses = [];
  const params = [];

  const status = String(query.status || '').trim();
  const service = String(query.service || '').trim();
  const search = String(query.search || '').trim();

  if (status && status !== 'all') {
    if (!allowedStatuses.has(status)) {
      return { error: 'Invalid status filter' };
    }

    clauses.push('status = ?');
    params.push(status);
  }

  if (service && service !== 'all') {
    if (!allowedServices.has(service)) {
      return { error: 'Invalid service filter' };
    }

    clauses.push('service = ?');
    params.push(service);
  }

  if (search) {
    clauses.push("(LOWER(name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(COALESCE(comment, '')) LIKE ?)");
    const pattern = `%${search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function getOrderFileAbsolutePath(filePath) {
  if (!filePath) {
    return null;
  }

  const filename = path.basename(filePath);

  if (!filename) {
    return null;
  }

  return path.resolve(__dirname, '..', 'uploads', 'orders', filename);
}

router.use('/', authRouter);
router.use(requireAdmin);

router.get('/orders', (req, res) => {
  const whereResult = buildOrdersWhere(req.query);

  if (whereResult.error) {
    return res.status(400).json({ error: whereResult.error });
  }

  const orders = db
    .prepare(
      `
      SELECT
        id,
        created_at,
        name,
        phone,
        email,
        service,
        quantity,
        comment,
        source_page,
        file_path,
        status
      FROM requests
      ${whereResult.whereSql}
      ORDER BY datetime(created_at) DESC, id DESC
    `
    )
    .all(...whereResult.params)
    .map(normalizeOrderRow);

  const totals = db.prepare(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
      FROM requests
    `
  ).get();

  return res.json({
    orders,
    stats: {
      total: totals.total || 0,
      new: totals.new_count || 0,
      in_progress: totals.in_progress_count || 0,
      completed: totals.completed_count || 0
    }
  });
});

router.get('/orders/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const row = db
    .prepare(
      `
      SELECT
        id,
        created_at,
        name,
        phone,
        email,
        service,
        quantity,
        comment,
        source_page,
        file_path,
        status
      FROM requests
      WHERE id = ?
    `
    )
    .get(id);

  if (!row) {
    return res.status(404).json({ error: 'Order not found' });
  }

  return res.json({ order: normalizeOrderRow(row) });
});

router.patch('/orders/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || '').trim();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const result = db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }

  return res.json({ ok: true, status });
});

router.delete('/orders/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const order = db.prepare('SELECT file_path FROM requests WHERE id = ?').get(id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const result = db.prepare('DELETE FROM requests WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const absoluteFilePath = getOrderFileAbsolutePath(order.file_path);

  if (absoluteFilePath && fs.existsSync(absoluteFilePath)) {
    try {
      fs.unlinkSync(absoluteFilePath);
    } catch (_err) {
      // If file removal fails, request stays deleted and cleanup can be retried manually.
    }
  }

  return res.json({ ok: true });
});

router.get('/orders/:id/file', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const order = db.prepare('SELECT file_path FROM requests WHERE id = ?').get(id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (!order.file_path) {
    return res.status(404).json({ error: 'File not found' });
  }

  const absoluteFilePath = getOrderFileAbsolutePath(order.file_path);

  if (!absoluteFilePath || !fs.existsSync(absoluteFilePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  return res.download(absoluteFilePath, path.basename(absoluteFilePath));
});

router.get('/products', (req, res) => {
  try {
    const status = String(req.query.status || 'all').trim();
    const category = String(req.query.category || 'all').trim();
    const search = String(req.query.search || '').trim().toLowerCase();

    if (!allowedStatusFilter.has(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    const clauses = [];
    const params = [];

    if (status === 'published') {
      clauses.push('is_active = 1');
    }

    if (status === 'hidden') {
      clauses.push('is_active = 0');
    }

    if (category && category !== 'all') {
      if (!allowedProductCategories.has(category)) {
        return res.status(400).json({ error: 'Invalid category filter' });
      }

      clauses.push('category = ?');
      params.push(category);
    }

    if (search) {
      clauses.push('LOWER(name) LIKE ?');
      params.push(`%${search}%`);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const products = db
      .prepare(
        `
        SELECT
          id,
          name,
          slug,
          category,
          type,
          short_description,
          description,
          price_from,
          height,
          width,
          depth,
          material,
          color,
          lighting,
          font,
          mounting,
          image,
          is_active,
          sort_order,
          created_at,
          updated_at
        FROM products
        ${whereSql}
        ORDER BY sort_order ASC, id ASC
      `
      )
      .all(...params)
      .map(normalizeProductRow);

    return res.json({ products });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

router.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  try {
    const product = db
      .prepare(
        `
        SELECT
          id,
          name,
          slug,
          category,
          type,
          short_description,
          description,
          price_from,
          height,
          width,
          depth,
          material,
          color,
          lighting,
          font,
          mounting,
          image,
          is_active,
          sort_order,
          created_at,
          updated_at
        FROM products
        WHERE id = ?
      `
      )
      .get(id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ product: normalizeProductRow(product) });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

router.post('/products', productImageUpload.single('image'), (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body);
    const validationError = validateProductPayload(payload);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(payload.slug);
    if (existing) {
      return res.status(400).json({ error: 'Slug уже используется' });
    }

    const image = req.file ? `products/${req.file.filename}` : null;

    const result = db
      .prepare(
        `
        INSERT INTO products (
          name,
          slug,
          category,
          type,
          short_description,
          description,
          price_from,
          height,
          width,
          depth,
          material,
          color,
          lighting,
          font,
          mounting,
          image,
          is_active,
          sort_order,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      )
      .run(
        payload.name,
        payload.slug,
        payload.category,
        payload.type,
        payload.short_description || null,
        payload.description || null,
        payload.price_from,
        payload.height,
        payload.width,
        payload.depth,
        payload.material || null,
        payload.color || null,
        payload.lighting || null,
        payload.font || null,
        payload.mounting || null,
        image,
        payload.is_active,
        payload.sort_order
      );

    return res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', productImageUpload.single('image'), (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  try {
    const payload = normalizeProductPayload(req.body);
    const validationError = validateProductPayload(payload);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const current = db.prepare('SELECT id, image FROM products WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const slugOwner = db.prepare('SELECT id FROM products WHERE slug = ?').get(payload.slug);
    if (slugOwner && slugOwner.id !== id) {
      return res.status(400).json({ error: 'Slug уже используется' });
    }

    const image = req.file ? `products/${req.file.filename}` : current.image;

    db
      .prepare(
        `
        UPDATE products
        SET
          name = ?,
          slug = ?,
          category = ?,
          type = ?,
          short_description = ?,
          description = ?,
          price_from = ?,
          height = ?,
          width = ?,
          depth = ?,
          material = ?,
          color = ?,
          lighting = ?,
          font = ?,
          mounting = ?,
          image = ?,
          is_active = ?,
          sort_order = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(
        payload.name,
        payload.slug,
        payload.category,
        payload.type,
        payload.short_description || null,
        payload.description || null,
        payload.price_from,
        payload.height,
        payload.width,
        payload.depth,
        payload.material || null,
        payload.color || null,
        payload.lighting || null,
        payload.font || null,
        payload.mounting || null,
        image,
        payload.is_active,
        payload.sort_order,
        id
      );

    return res.json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

router.patch('/products/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const isActive = Number(req.body.is_active);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  if (![0, 1].includes(isActive)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const result = db
      .prepare('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(isActive, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ ok: true, is_active: isActive });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to update product status' });
  }
});

router.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id' });
  }

  try {
    const product = db.prepare('SELECT id, is_active FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.is_active === 1) {
      db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
      return res.json({ ok: true, mode: 'hidden' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return res.json({ ok: true, mode: 'deleted' });
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл слишком большой. Максимум 10 МБ' });
    }

    return res.status(400).json({ error: 'Ошибка загрузки изображения' });
  }

  return res.status(400).json({ error: err.message || 'Некорректные данные' });
});

module.exports = router;
