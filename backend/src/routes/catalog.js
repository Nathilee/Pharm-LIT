import { Router } from 'express';
import { db, toProduct } from '../db.js';
import { HttpError } from '../auth.js';

const router = Router();

export const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.color AS category_color, c.icon AS category_icon
  FROM products p LEFT JOIN categories c ON c.id = p.category_id`;

router.get('/categories', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
       FROM categories c ORDER BY c.id`,
    )
    .all();
  res.json({
    categories: rows.map((r) => ({
      id: r.id, name: r.name, slug: r.slug, icon: r.icon, color: r.color, productCount: r.product_count,
    })),
  });
});

const SORTS = {
  name: 'p.name COLLATE NOCASE ASC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  newest: 'p.id DESC',
  popular: 'p.featured DESC, p.name COLLATE NOCASE ASC',
};

router.get('/products', (req, res) => {
  const { q, category, rx, featured, sort } = req.query;
  const where = ['p.active = 1'];
  const params = [];
  if (q) {
    where.push('(p.name LIKE ? OR p.generic_name LIKE ? OR p.manufacturer LIKE ?)');
    const like = `%${String(q).trim()}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('c.slug = ?');
    params.push(String(category));
  }
  if (rx === 'true' || rx === 'false') where.push(`p.requires_prescription = ${rx === 'true' ? 1 : 0}`);
  if (featured === 'true') where.push('p.featured = 1');
  const order = SORTS[sort] || SORTS.popular;
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const rows = db
    .prepare(`${PRODUCT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit}`)
    .all(...params);
  res.json({ products: rows.map(toProduct) });
});

router.get('/products/:id', (req, res) => {
  const row = db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.active = 1`).get(Number(req.params.id));
  if (!row) throw new HttpError(404, 'Product not found');
  const related = db
    .prepare(`${PRODUCT_SELECT} WHERE p.category_id = ? AND p.id != ? AND p.active = 1 ORDER BY p.featured DESC LIMIT 6`)
    .all(row.category_id, row.id);
  res.json({ product: toProduct(row), related: related.map(toProduct) });
});

export default router;
