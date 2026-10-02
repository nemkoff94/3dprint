const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbRelativePath = process.env.DB_PATH || 'data/3delo.sqlite';
const dbPath = path.resolve(__dirname, '..', dbRelativePath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      type TEXT NOT NULL DEFAULT 'ready-sign',
      description TEXT,
      short_description TEXT,
      price_from INTEGER NOT NULL DEFAULT 0,
      height INTEGER,
      depth INTEGER,
      width INTEGER,
      material TEXT,
      color TEXT,
      lighting TEXT,
      font TEXT,
      mounting TEXT,
      image TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      service TEXT NOT NULL,
      comment TEXT,
      total_price INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Новый',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN (
        'Новый',
        'В работе',
        'Ожидает оплаты',
        'Изготовление',
        'Готов',
        'Выдан',
        'Отменён'
      ))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      title TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      service TEXT NOT NULL,
      quantity INTEGER,
      comment TEXT,
      source_page TEXT NOT NULL DEFAULT '/',
      file_path TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      CHECK (service IN ('custom-sign', '3d-print', 'modeling', 'other')),
      CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS calculator_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status_created
      ON orders(status, created_at);

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);

    CREATE INDEX IF NOT EXISTS idx_requests_status_created
      ON requests(status, created_at);
  `);
}

function getTableColumns(tableName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => row.name);
}

function ensureProductsSchema() {
  let columns = new Set(getTableColumns('products'));

  if (columns.has('category_id')) {
    db.exec('PRAGMA foreign_keys = OFF');

    db.exec(`
      CREATE TABLE IF NOT EXISTS products_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        type TEXT NOT NULL DEFAULT 'ready-sign',
        description TEXT,
        short_description TEXT,
        price_from INTEGER NOT NULL DEFAULT 0,
        height INTEGER,
        depth INTEGER,
        width INTEGER,
        material TEXT,
        color TEXT,
        lighting TEXT,
        font TEXT,
        mounting TEXT,
        image TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 1000,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO products_v2 (
        id,
        slug,
        name,
        category,
        type,
        description,
        short_description,
        price_from,
        height,
        depth,
        width,
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
      SELECT
        p.id,
        CASE WHEN p.slug = 'cvety' THEN 'tsvety' ELSE p.slug END AS slug,
        p.name,
        CASE c.slug
          WHEN 'kofeynya' THEN 'cafes'
          WHEN 'cvety' THEN 'flowers'
          WHEN 'salon-krasoty' THEN 'beauty'
          ELSE 'other'
        END AS category,
        'volumetric-letters' AS type,
        p.description,
        p.description AS short_description,
        COALESCE(p.price, 0) AS price_from,
        p.height_mm AS height,
        p.depth_mm AS depth,
        p.width_mm AS width,
        COALESCE(p.material, 'PLA') AS material,
        NULL AS color,
        'Опционально' AS lighting,
        NULL AS font,
        NULL AS mounting,
        CASE
          WHEN p.image_path LIKE '/uploads/%' THEN REPLACE(p.image_path, '/uploads/', '')
          ELSE p.image_path
        END AS image,
        COALESCE(p.is_active, 1) AS is_active,
        p.id AS sort_order,
        COALESCE(p.created_at, CURRENT_TIMESTAMP) AS created_at,
        COALESCE(p.updated_at, CURRENT_TIMESTAMP) AS updated_at
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id;

      DROP TABLE products;
      ALTER TABLE products_v2 RENAME TO products;
    `);

    db.exec('PRAGMA foreign_keys = ON');
    columns = new Set(getTableColumns('products'));
  }

  const addColumnStatements = [
    "ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'other'",
    "ALTER TABLE products ADD COLUMN type TEXT NOT NULL DEFAULT 'ready-sign'",
    'ALTER TABLE products ADD COLUMN short_description TEXT',
    'ALTER TABLE products ADD COLUMN price_from INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN height INTEGER',
    'ALTER TABLE products ADD COLUMN depth INTEGER',
    'ALTER TABLE products ADD COLUMN width INTEGER',
    'ALTER TABLE products ADD COLUMN color TEXT',
    'ALTER TABLE products ADD COLUMN lighting TEXT',
    'ALTER TABLE products ADD COLUMN font TEXT',
    'ALTER TABLE products ADD COLUMN mounting TEXT',
    'ALTER TABLE products ADD COLUMN image TEXT',
    'ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000'
  ];

  const columnNames = [
    'category',
    'type',
    'short_description',
    'price_from',
    'height',
    'depth',
    'width',
    'color',
    'lighting',
    'font',
    'mounting',
    'image',
    'sort_order'
  ];

  for (let i = 0; i < columnNames.length; i += 1) {
    if (!columns.has(columnNames[i])) {
      db.exec(addColumnStatements[i]);
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_active_sort
      ON products(is_active, sort_order, id);

    CREATE INDEX IF NOT EXISTS idx_products_slug_active
      ON products(slug, is_active);
  `);
}

function migrateLegacyProductsData() {
  const columns = new Set(getTableColumns('products'));

  if (columns.has('price')) {
    db.exec('UPDATE products SET price_from = price WHERE (price_from IS NULL OR price_from = 0) AND price IS NOT NULL');
  }

  if (columns.has('height_mm')) {
    db.exec('UPDATE products SET height = height_mm WHERE height IS NULL AND height_mm IS NOT NULL');
  }

  if (columns.has('depth_mm')) {
    db.exec('UPDATE products SET depth = depth_mm WHERE depth IS NULL AND depth_mm IS NOT NULL');
  }

  if (columns.has('width_mm')) {
    db.exec('UPDATE products SET width = width_mm WHERE width IS NULL AND width_mm IS NOT NULL');
  }

  if (columns.has('image_path')) {
    db.exec("UPDATE products SET image = REPLACE(image_path, '/uploads/', '') WHERE (image IS NULL OR image = '') AND image_path IS NOT NULL");
  }

  if (columns.has('category_id')) {
    db.exec(`
      UPDATE products
      SET category = CASE (
        SELECT slug FROM categories WHERE categories.id = products.category_id
      )
        WHEN 'kofeynya' THEN 'cafes'
        WHEN 'cvety' THEN 'flowers'
        WHEN 'salon-krasoty' THEN 'beauty'
        ELSE 'other'
      END
      WHERE category IS NULL OR category = '' OR category = 'other'
    `);
  }

  db.exec("UPDATE products SET type = 'volumetric-letters' WHERE type IS NULL OR type = '' OR type = 'ready-sign'");
  db.exec("UPDATE products SET lighting = 'Опционально' WHERE lighting IS NULL OR lighting = ''");
  db.exec("UPDATE products SET material = 'PLA' WHERE material IS NULL OR material = ''");
  db.exec("UPDATE products SET short_description = description WHERE (short_description IS NULL OR short_description = '') AND description IS NOT NULL");
  db.exec("UPDATE products SET category = 'other' WHERE category IS NULL OR category = ''");
  db.exec("UPDATE products SET slug = 'tsvety' WHERE slug = 'cvety' AND NOT EXISTS (SELECT 1 FROM products p2 WHERE p2.slug = 'tsvety')");
}

function seedInitialData() {
  const categories = [
    { name: 'Кофейня', slug: 'kofeynya' },
    { name: 'Цветы', slug: 'cvety' },
    { name: 'Салон красоты', slug: 'salon-krasoty' }
  ];

  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)'
  );

  for (const category of categories) {
    insertCategory.run(category.name, category.slug);
  }

  const settings = [
    { key: 'base_material_price', value: '1.0' },
    { key: 'lighting_multiplier', value: '1.25' }
  ];

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO calculator_settings (setting_key, setting_value) VALUES (?, ?)'
  );

  for (const setting of settings) {
    insertSetting.run(setting.key, setting.value);
  }

  const initialProducts = [
    {
      slug: 'kofeynya',
      name: 'КОФЕЙНЯ',
      category: 'cafes',
      type: 'volumetric-letters',
      shortDescription: 'Объёмная надпись для кафе, кофейни или ресторана.',
      description:
        'Готовая объёмная надпись для кафе, кофейни или ресторана. Можно адаптировать размеры, цвет, способ крепления и подсветку под конкретное место установки.',
      priceFrom: 12900,
      height: 300,
      depth: 60,
      width: null,
      material: 'PLA',
      color: 'Белый',
      lighting: 'Опционально',
      font: 'Без засечек',
      mounting: 'На дистанционные держатели',
      image: null,
      isActive: 1,
      sortOrder: 1
    },
    {
      slug: 'tsvety',
      name: 'ЦВЕТЫ',
      category: 'flowers',
      type: 'volumetric-letters',
      shortDescription: 'Готовая объёмная надпись для цветочного магазина или студии.',
      description:
        'Готовая объёмная надпись для цветочного магазина или студии. Подходит для фасада, витрины и интерьерной зоны.',
      priceFrom: 11900,
      height: 300,
      depth: 60,
      width: null,
      material: 'PLA',
      color: 'Белый',
      lighting: 'Опционально',
      font: 'Без засечек',
      mounting: 'На дистанционные держатели',
      image: null,
      isActive: 1,
      sortOrder: 2
    },
    {
      slug: 'salon-krasoty',
      name: 'САЛОН КРАСОТЫ',
      category: 'beauty',
      type: 'volumetric-letters',
      shortDescription: 'Объёмная надпись для салона красоты или студии.',
      description:
        'Объёмная надпись для салона красоты или студии. Подбираем размеры букв, цвет, шрифт и вариант подсветки.',
      priceFrom: 14900,
      height: 300,
      depth: 60,
      width: null,
      material: 'PLA',
      color: 'Белый',
      lighting: 'Опционально',
      font: 'Без засечек',
      mounting: 'На дистанционные держатели',
      image: null,
      isActive: 1,
      sortOrder: 3
    },
    {
      slug: 'barber',
      name: 'BARBER',
      category: 'beauty',
      type: 'volumetric-letters',
      shortDescription: 'Лаконичная объёмная вывеска для барбершопа.',
      description:
        'Лаконичная объёмная вывеска для барбершопа. Подходит для входной группы и витрины, возможна адаптация под бренд.',
      priceFrom: 13900,
      height: 300,
      depth: 60,
      width: null,
      material: 'PLA',
      color: 'Белый',
      lighting: 'Опционально',
      font: 'Без засечек',
      mounting: 'На дистанционные держатели',
      image: null,
      isActive: 1,
      sortOrder: 4
    },
    {
      slug: 'coffee',
      name: 'COFFEE',
      category: 'cafes',
      type: 'volumetric-letters',
      shortDescription: 'Объёмная надпись для кофейни или coffee point.',
      description:
        'Объёмная надпись для кофейни или coffee point. Хорошо работает для компактных фасадов и интерьерных зон.',
      priceFrom: 11900,
      height: 300,
      depth: 60,
      width: null,
      material: 'PLA',
      color: 'Белый',
      lighting: 'Опционально',
      font: 'Без засечек',
      mounting: 'На дистанционные держатели',
      image: null,
      isActive: 1,
      sortOrder: 5
    },
    {
      slug: 'open',
      name: 'OPEN',
      category: 'other',
      type: 'ready-sign',
      shortDescription: 'Небольшая объёмная вывеска для входной группы или витрины.',
      description:
        'Небольшая объёмная вывеска для входной группы или витрины. Компактное решение для быстрой навигации клиентов.',
      priceFrom: 7900,
      height: 200,
      depth: 50,
      width: null,
      material: 'PLA',
      color: 'Белый',
      lighting: 'Опционально',
      font: 'Без засечек',
      mounting: 'На дистанционные держатели',
      image: null,
      isActive: 1,
      sortOrder: 6
    }
  ];

  const upsertProduct = db.prepare(`
    INSERT INTO products (
      slug,
      name,
      category,
      type,
      description,
      short_description,
      price_from,
      height,
      depth,
      width,
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
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      type = excluded.type,
      description = excluded.description,
      short_description = excluded.short_description,
      price_from = excluded.price_from,
      height = excluded.height,
      depth = excluded.depth,
      width = excluded.width,
      material = excluded.material,
      color = excluded.color,
      lighting = excluded.lighting,
      font = excluded.font,
      mounting = excluded.mounting,
      image = COALESCE(products.image, excluded.image),
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const product of initialProducts) {
    upsertProduct.run(
      product.slug,
      product.name,
      product.category,
      product.type,
      product.description,
      product.shortDescription,
      product.priceFrom,
      product.height,
      product.depth,
      product.width,
      product.material,
      product.color,
      product.lighting,
      product.font,
      product.mounting,
      product.image,
      product.isActive,
      product.sortOrder
    );
  }
}

function seedAdminUserFromEnv() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const existing = db
    .prepare('SELECT id FROM admin_users WHERE email = ?')
    .get(email);

  if (existing) {
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 12);

  db.prepare(
    'INSERT INTO admin_users (email, password_hash) VALUES (?, ?)'
  ).run(email, passwordHash);

  console.log(`Admin user created: ${email}`);
}

function initDatabase() {
  initSchema();
  ensureProductsSchema();
  migrateLegacyProductsData();
  seedInitialData();
  seedAdminUserFromEnv();
}

initDatabase();

module.exports = { db };
