const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }

  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.redirect('/admin/');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

router.post('/login', (req, res) => {
  const login = String(req.body.login || '').trim();
  const password = String(req.body.password || '');
  const envLogin = String(process.env.ADMIN_LOGIN || process.env.ADMIN_EMAIL || '').trim();
  const envPassword = String(process.env.ADMIN_PASSWORD || '');

  if (!envLogin || !envPassword) {
    return res.status(500).json({ error: 'Admin credentials are not configured' });
  }

  if (!safeEqual(login, envLogin) || !safeEqual(password, envPassword)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.isAdmin = true;
  req.session.adminLogin = envLogin;

  return res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.json({
    login: req.session.adminLogin
  });
});

module.exports = { router, requireAdmin };
