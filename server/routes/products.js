const express = require('express');
const { db } = require('../db');

const router = express.Router();

const allowedCategory = new Set(['cafes', 'shops', 'beauty', 'flowers', 'offices', 'other']);
const allowedType = new Set(['volumetric-letters', 'ready-sign', 'logo', 'sign', 'other']);

function normalizePublicProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    type: row.type,
    description: row.description,
    short_description: row.short_description,
    price_from: row.price_from,
    height: row.height,
    depth: row.depth,
    width: row.width,
    material: row.material,
    color: row.color,
    lighting: row.lighting,
    font: row.font,
    mounting: row.mounting,
    image: row.image,
    is_active: row.is_active,
    sort_order: row.sort_order,
    updated_at: row.updated_at
  };
}

router.get('/', (req, res) => {
  try {
    const clauses = ['is_active = 1'];
    const params = [];

    const category = String(req.query.category || '').trim();
    const type = String(req.query.type || '').trim();
    const lighting = String(req.query.lighting || '').trim();

    if (category) {
      if (!allowedCategory.has(category)) {
        return res.status(400).json({ error: 'Invalid category filter' });
      }
      clauses.push('category = ?');
      params.push(category);
    }

    if (type) {
      if (!allowedType.has(type)) {
        return res.status(400).json({ error: 'Invalid type filter' });
      }
      clauses.push('type = ?');
      params.push(type);
    }

    if (lighting) {
      clauses.push('lighting = ?');
      params.push(lighting);
    }

    const sql = `
      SELECT
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
        updated_at
      FROM products
      WHERE ${clauses.join(' AND ')}
      ORDER BY sort_order ASC, id ASC
    `;

    const products = db.prepare(sql).all(...params).map(normalizePublicProduct);
    return res.json(products);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

router.get('/:slug', (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();

    if (!slug) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = db
      .prepare(
        `
        SELECT
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
          updated_at
        FROM products
        WHERE slug = ? AND is_active = 1
        LIMIT 1
      `
      )
      .get(slug);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json(normalizePublicProduct(product));
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

module.exports = router;
