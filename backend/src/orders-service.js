import { config } from './config.js';
import { db, toOrder, tx } from './db.js';
import { HttpError } from './auth.js';

export const ORDER_SELECT = `
  SELECT o.*, u.name AS user_name, u.email AS user_email, p.status AS prescription_status,
         (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
  FROM orders o
  JOIN users u ON u.id = o.user_id
  LEFT JOIN prescriptions p ON p.id = o.prescription_id`;

export function getOrder(id) {
  const row = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id);
  if (!row) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(id);
  return toOrder(row, items);
}

export function deliveryFeeFor(subtotal) {
  return subtotal >= config.freeDeliveryThreshold || subtotal === 0 ? 0 : config.deliveryFee;
}

/**
 * Validate a cart against the catalogue and compute totals.
 * items: [{ productId, quantity }]
 */
export function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty');
  const merged = new Map();
  for (const it of items) {
    const id = Number(it.productId);
    const qty = Math.floor(Number(it.quantity));
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 100) {
      throw new HttpError(400, 'Invalid cart item');
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const lines = [];
  const problems = [];
  for (const [productId, quantity] of merged) {
    const p = getProduct.get(productId);
    if (!p) {
      problems.push({ productId, message: 'This product is no longer available' });
      continue;
    }
    if (p.stock < quantity) {
      problems.push({
        productId,
        message: p.stock === 0 ? `${p.name} is out of stock` : `Only ${p.stock} of ${p.name} left in stock`,
      });
    }
    lines.push({
      productId,
      name: p.name,
      unitPrice: p.price,
      quantity,
      requiresPrescription: !!p.requires_prescription,
      lineTotal: p.price * quantity,
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const deliveryFee = deliveryFeeFor(subtotal);
  return {
    lines,
    problems,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    requiresPrescription: lines.some((l) => l.requiresPrescription),
  };
}

export function createOrder(user, body) {
  const { items, paymentMethod, prescriptionId, delivery = {}, notes } = body || {};
  if (!['paystack', 'cash_on_delivery'].includes(paymentMethod)) {
    throw new HttpError(400, 'Choose a payment method');
  }
  const name = String(delivery.name || user.name || '').trim();
  const phone = String(delivery.phone || '').trim();
  const address = String(delivery.address || '').trim();
  if (!name || !address) throw new HttpError(400, 'Delivery name and address are required');
  if (!/^\+?[0-9 ]{9,15}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number');

  return tx(() => {
    const quote = priceCart(items);
    if (quote.problems.length) throw new HttpError(409, quote.problems[0].message, quote.problems);

    let rx = null;
    if (quote.requiresPrescription) {
      if (!prescriptionId) {
        throw new HttpError(400, 'Some items need a prescription. Please attach a prescription to continue.');
      }
      rx = db.prepare('SELECT * FROM prescriptions WHERE id = ? AND user_id = ?').get(Number(prescriptionId), user.id);
      if (!rx) throw new HttpError(400, 'Prescription not found');
      if (rx.status === 'rejected') throw new HttpError(400, 'That prescription was rejected. Please upload a new one.');
    }

    let status;
    if (rx && rx.status === 'pending') status = 'awaiting_prescription';
    else status = paymentMethod === 'paystack' ? 'pending_payment' : 'processing';

    const result = db
      .prepare(
        `INSERT INTO orders (user_id, status, payment_method, subtotal, delivery_fee, total,
           delivery_name, delivery_phone, delivery_address, notes, prescription_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id, status, paymentMethod, quote.subtotal, quote.deliveryFee, quote.total,
        name, phone, address, notes ? String(notes).slice(0, 500) : null, rx ? rx.id : null,
      );
    const orderId = Number(result.lastInsertRowid);

    const insItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, name, unit_price, quantity, requires_prescription)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    // Reserve stock now so two customers cannot buy the last pack.
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    for (const l of quote.lines) {
      insItem.run(orderId, l.productId, l.name, l.unitPrice, l.quantity, l.requiresPrescription ? 1 : 0);
      const r = decStock.run(l.quantity, l.productId, l.quantity);
      if (r.changes === 0) throw new HttpError(409, `${l.name} just went out of stock`);
    }

    // Save the delivery details on the profile for next time.
    db.prepare('UPDATE users SET phone = COALESCE(phone, ?), address = ? WHERE id = ?').run(phone, address, user.id);

    return getOrder(orderId);
  });
}

function restoreStock(orderId) {
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
  const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const i of items) if (i.product_id) inc.run(i.quantity, i.product_id);
}

export function cancelOrder(orderId, { reason } = {}) {
  return tx(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o) throw new HttpError(404, 'Order not found');
    if (['cancelled', 'delivered'].includes(o.status)) throw new HttpError(400, `Order is already ${o.status}`);
    if (o.status === 'out_for_delivery') throw new HttpError(400, 'Order is already out for delivery');
    restoreStock(orderId);
    db.prepare(
      `UPDATE orders SET status = 'cancelled',
         payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
         notes = CASE WHEN ? IS NULL THEN notes ELSE COALESCE(notes || ' | ', '') || ? END,
         updated_at = datetime('now') WHERE id = ?`,
    ).run(reason ?? null, reason ?? null, orderId);
    return getOrder(orderId);
  });
}

const STAFF_TRANSITIONS = {
  processing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  pending_payment: ['cancelled'],
  awaiting_prescription: ['cancelled'],
};

export function updateOrderStatus(orderId, next) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!o) throw new HttpError(404, 'Order not found');
  if (!(STAFF_TRANSITIONS[o.status] || []).includes(next)) {
    throw new HttpError(400, `Cannot move an order from "${o.status}" to "${next}"`);
  }
  if (next === 'cancelled') return cancelOrder(orderId, { reason: 'Cancelled by pharmacy' });
  db.prepare(
    `UPDATE orders SET status = ?,
       payment_status = CASE WHEN ? = 'delivered' AND payment_method = 'cash_on_delivery' THEN 'paid' ELSE payment_status END,
       paid_at = CASE WHEN ? = 'delivered' AND payment_method = 'cash_on_delivery' THEN datetime('now') ELSE paid_at END,
       updated_at = datetime('now') WHERE id = ?`,
  ).run(next, next, next, orderId);
  return getOrder(orderId);
}

/** Called when a payment provider confirms payment. Idempotent. */
export function markOrderPaid(reference, amountPaid) {
  return tx(() => {
    const o = db.prepare('SELECT * FROM orders WHERE payment_reference = ?').get(reference);
    if (!o) throw new HttpError(404, 'Unknown payment reference');
    if (o.payment_status === 'paid') return getOrder(o.id);
    if (amountPaid != null && Number(amountPaid) < o.total) {
      db.prepare(`UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(o.id);
      throw new HttpError(400, 'Amount paid does not match order total');
    }
    db.prepare(
      `UPDATE orders SET payment_status = 'paid', paid_at = datetime('now'),
         status = CASE WHEN status = 'pending_payment' THEN 'processing' ELSE status END,
         updated_at = datetime('now') WHERE id = ?`,
    ).run(o.id);
    return getOrder(o.id);
  });
}

/** Pharmacist decision on a prescription moves linked orders forward (or cancels them). */
export function applyPrescriptionDecision(prescriptionId, status) {
  const waiting = db
    .prepare(`SELECT id, payment_method FROM orders WHERE prescription_id = ? AND status = 'awaiting_prescription'`)
    .all(prescriptionId);
  for (const o of waiting) {
    if (status === 'approved') {
      const next = o.payment_method === 'paystack' ? 'pending_payment' : 'processing';
      db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(next, o.id);
    } else if (status === 'rejected') {
      cancelOrder(o.id, { reason: 'Prescription rejected' });
    }
  }
}
