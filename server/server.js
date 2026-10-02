require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

require('./db');

const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const calculatorRoutes = require('./routes/calculator');
const { requireAdmin } = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const port = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const uploadDir = path.resolve(__dirname, 'uploads');
const productImagesDir = path.resolve(__dirname, 'uploads', 'products');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(productImagesDir, { recursive: true });

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(path.resolve(__dirname, '..', 'public')));
app.use('/vendor/three', express.static(path.resolve(__dirname, '..', 'node_modules', 'three')));
app.use('/admin-assets', express.static(path.resolve(__dirname, '..', 'admin')));
app.use('/uploads/products', express.static(productImagesDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeExtension = extension || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only jpeg, png and webp files are allowed'));
    }

    return cb(null, true);
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

app.get('/catalog', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'catalog.html'));
});

app.get('/catalog/:slug', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'catalog.html'));
});

app.get('/calculator', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'calculator.html'));
});

app.get('/custom-sign', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'custom-sign.html'));
});

app.get('/3d-print', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', '3d-print.html'));
});

app.get('/modeling', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'public', 'modeling.html'));
});

app.get('/admin/login', (_req, res) => {
  res.redirect('/admin/');
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/orders');
  }

  res.sendFile(path.resolve(__dirname, '..', 'admin', 'index.html'));
});

app.get('/admin/orders', requireAdmin, (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'admin', 'orders.html'));
});

app.get('/admin/products', requireAdmin, (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'admin', 'products.html'));
});

app.get('/admin/product.html', requireAdmin, (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'admin', 'product.html'));
});

app.get('/admin/order.html', requireAdmin, (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'admin', 'order.html'));
});

app.use('/api/admin', adminRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/calculator', calculatorRoutes);

app.post('/api/uploads/image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image is required' });
  }

  return res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`
  });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message || 'Unexpected error' });
  }

  return res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`3Delo server running at http://localhost:${port}`);
});
