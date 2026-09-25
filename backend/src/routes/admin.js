import { Router } from 'express';
import { db, toPrescription, toProduct, toUser, tx } from '../db.js';
import { HttpError, requireAdmin, requireStaff } from '../auth.js';
import { ORDER_SELECT, applyPrescriptionDecision, getOrder, updateOrderStatus } from '../orders-service.js';
import { PRODUCT_SELECT } from './catalog.js';

const router = Router();
router.use(requireStaff);

// ---------- Dashboard ----------
router.get('/stats', (_req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const revenue = one(`SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE payment_status = 'paid'`).v;
  const revenueToday = one(
    `SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE payment_status = 'paid' AND date(paid_at) = date('now')`,
  ).v;
  const ordersByStatus = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all().map((r) => [r.status, r.n]),
  );
  const lowStock = db
    .prepare(`${PRODUCT_SELECT} WHERE p.active = 1 AND p.stock <= 20 ORDER BY p.stock ASC LIMIT 10`)
    .all()
    .map(toProduct);
  const recentOrders = db
    .prepare(`${ORDER_SELECT} ORDER BY o.id DESC LIMIT 5`)
    .all()
    .map((r) => getOrder(r.id));
  const topProducts = db
    .prepare(
      `SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.quantity * oi.unit_price) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' GROUP BY oi.name ORDER BY qty DESC LIMIT 5`,
    )
    .all()
    .map((r) => ({ name: r.name, quantity: r.qty, revenue: r.revenue }));
  res.json({
    revenue,
    revenueToday,
    totalOrders: one('SELECT COUNT(*) AS n FROM orders').n,
    ordersByStatus,
    pendingPrescriptions: one(`SELECT COUNT(*) AS n FROM prescriptions WHERE status = 'pending'`).n,
    customers: one(`SELECT COUNT(*) AS n FROM users WHERE role = 'customer'`).n,
    products: one('SELECT COUNT(*) AS n FROM products WHERE active = 1').n,
    lowStock,
    recentOrders,
    topProducts,
  });
});

// ---------- Products ----------
router.get('/products', (req, res) => {
  const q = req.query.q ? `%${String(req.query.q).trim()}%` : null;
  const rows = q
    ? db.prepare(`${PRODUCT_SELECT} WHERE p.name LIKE ? OR p.generic_name LIKE ? ORDER BY p.name`).all(q, q)
    : db.prepare(`${PRODUCT_SELECT} ORDER BY p.active DESC, p.name`).all();
  res.json({ products: rows.map(toProduct) });
});

function productFields(body, { partial }) {
  const b = body || {};
  const out = {};
  const str = (k, col, required = false) => {
    if (b[k] === undefined) {
      if (required && !partial) throw new HttpError(400, `${k} is required`);
      return;
    }
    const v = b[k] === null ? null : String(b[k]).trim();
    if (required && !v) throw new HttpError(400, `${k} is required`);
    out[col] = v || null;
  };
  const int = (k, col, required = false) => {
    if (b[k] === undefined) {
      if (required && !partial) throw new HttpError(400, `${k} is required`);
      return;
    }
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `${k} must be a whole number ≥ 0`);
    out[col] = n;
  };
  const bool = (k, col) => {
    if (b[k] !== undefined) out[col] = b[k] ? 1 : 0;
  };
  str('name', 'name', true);
  str('genericName', 'generic_name');
  str('description', 'description');
  str('manufacturer', 'manufacturer');
  str('dosageForm', 'dosage_form');
  str('strength', 'strength');
  str('packSize', 'pack_size');
  str('imageUrl', 'image_url');
  int('price', 'price', true);
  int('stock', 'stock', true);
  if (b.categoryId !== undefined) out.category_id = b.categoryId ? Number(b.categoryId) : null;
  bool('requiresPrescription', 'requires_prescription');
  bool('featured', 'featured');
  bool('active', 'active');
  return out;
}

router.post('/products', requireAdmin, (req, res) => {
  const f = productFields(req.body, { partial: false });
  const cols = Object.keys(f);
  const r = db
    .prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...Object.values(f));
  res.status(201).json({ product: toProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(r.lastInsertRowid)) });
});

router.patch('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const f = productFields(req.body, { partial: true });
  // Pharmacists may only adjust stock; admins can edit everything.
  if (req.user.role !== 'admin' && Object.keys(f).some((k) => k !== 'stock')) {
    throw new HttpError(403, 'Only admins can edit product details');
  }
  if (Object.keys(f).length) {
    const r = db
      .prepare(`UPDATE products SET ${Object.keys(f).map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...Object.values(f), id);
    if (r.changes === 0) throw new HttpError(404, 'Product not found');
  }
  res.json({ product: toProduct(db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).get(id)) });
});

/** Soft delete: keeps order history intact. */
router.delete('/products/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ---------- Categories ----------
router.post('/categories', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) throw new HttpError(400, 'name is required');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const r = db
    .prepare('INSERT INTO categories (name, slug, icon, color) VALUES (?, ?, ?, ?)')
    .run(name, slug, req.body?.icon || 'medkit', req.body?.color || '#0E9F6E');
  res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid) });
});

// ---------- Orders ----------
router.get('/orders', (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare(`${ORDER_SELECT} WHERE o.status = ? ORDER BY o.id DESC LIMIT 200`).all(String(status))
    : db.prepare(`${ORDER_SELECT} ORDER BY o.id DESC LIMIT 200`).all();
  res.json({ orders: rows.map((r) => getOrder(r.id)) });
});

router.patch('/orders/:id/status', (req, res) => {
  res.json({ order: updateOrderStatus(Number(req.params.id), String(req.body?.status || '')) });
});

// ---------- Prescriptions ----------
router.get('/prescriptions', (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const sql = `SELECT p.*, u.name AS user_name, u.email AS user_email
               FROM prescriptions p JOIN users u ON u.id = p.user_id
               ${status ? 'WHERE p.status = ?' : ''}
               ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.id DESC LIMIT 200`;
  const rows = status ? db.prepare(sql).all(status) : db.prepare(sql).all();
  const ordersFor = db.prepare(`SELECT id, status, total FROM orders WHERE prescription_id = ? ORDER BY id DESC`);
  res.json({
    prescriptions: rows.map((r) => ({
      ...toPrescription(r),
      orders: ordersFor.all(r.id).map((o) => ({ id: o.id, status: o.status, total: o.total })),
    })),
  });
});

router.patch('/prescriptions/:id', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!['approved', 'rejected'].includes(status)) throw new HttpError(400, 'status must be approved or rejected');
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
  if (status === 'rejected' && !note) throw new HttpError(400, 'Please give the customer a reason for rejecting');
  tx(() => {
    const r = db
      .prepare(
        `UPDATE prescriptions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
      )
      .run(status, note, req.user.id, id);
    if (r.changes === 0) throw new HttpError(404, 'Prescription not found');
    applyPrescriptionDecision(id, status);
  });
  const row = db
    .prepare(`SELECT p.*, u.name AS user_name, u.email AS user_email FROM prescriptions p JOIN users u ON u.id = p.user_id WHERE p.id = ?`)
    .get(id);
  res.json({ prescription: toPrescription(row) });
});

// ---------- Users ----------
router.get('/users', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count FROM users u ORDER BY u.id DESC`,
    )
    .all();
  res.json({ users: rows.map((r) => ({ ...toUser(r), orderCount: r.order_count })) });
});

router.patch('/users/:id/role', requireAdmin, (req, res) => {
  const role = String(req.body?.role || '');
  if (!['customer', 'pharmacist', 'admin'].includes(role)) throw new HttpError(400, 'Invalid role');
  const id = Number(req.params.id);
  if (id === req.user.id) throw new HttpError(400, 'You cannot change your own role');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  res.json({ user: toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

export default router;
