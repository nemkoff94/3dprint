const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/settings', (req, res) => {
  const rows = db
    .prepare('SELECT setting_key, setting_value FROM calculator_settings ORDER BY setting_key')
    .all();

  const settings = rows.reduce((acc, row) => {
    acc[row.setting_key] = row.setting_value;
    return acc;
  }, {});

  res.json(settings);
});

module.exports = router;
