import { Router } from 'express';
import { config, isDemoPayments } from '../config.js';
import { db } from '../db.js';
import { HttpError, requireAuth } from '../auth.js';
import { ORDER_SELECT, cancelOrder, createOrder, getOrder, priceCart } from '../orders-service.js';

const router = Router();

/** Store settings the app needs for checkout. */
router.get('/settings', (_req, res) => {
  res.json({
    currency: config.paystack.currency,
    deliveryFee: config.deliveryFee,
    freeDeliveryThreshold: config.freeDeliveryThreshold,
    demoPayments: isDemoPayments(),
  });
});

/** Price a cart without placing an order (live stock + totals). */
router.post('/quote', (req, res) => {
  res.json(priceCart(req.body?.items));
});

router.post('/', requireAuth, (req, res) => {
  res.status(201).json({ order: createOrder(req.user, req.body) });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.id DESC`).all(req.user.id);
  res.json({ orders: rows.map((r) => getOrder(r.id)) });
});

function ownOrder(req) {
  const order = getOrder(Number(req.params.id));
  const isStaff = ['admin', 'pharmacist'].includes(req.user.role);
  if (!order || (order.userId !== req.user.id && !isStaff)) throw new HttpError(404, 'Order not found');
  return order;
}

router.get('/:id', requireAuth, (req, res) => {
  res.json({ order: ownOrder(req) });
});

router.post('/:id/cancel', requireAuth, (req, res) => {
  const order = ownOrder(req);
  if (!['awaiting_prescription', 'pending_payment', 'processing'].includes(order.status)) {
    throw new HttpError(400, 'This order can no longer be cancelled');
  }
  res.json({ order: cancelOrder(order.id, { reason: 'Cancelled by customer' }) });
});

export default router;
