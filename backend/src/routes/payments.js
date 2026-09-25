import { Router } from 'express';
import { config, isDemoPayments } from '../config.js';
import { db } from '../db.js';
import { HttpError, requireAuth } from '../auth.js';
import { getOrder, markOrderPaid } from '../orders-service.js';
import { initializeTransaction, isValidWebhookSignature, verifyTransaction } from '../paystack.js';

const router = Router();

function baseUrl(req) {
  return config.publicUrl || `${req.protocol}://${req.get('host')}`;
}

/** Only redirect back into our own app / site (prevents open redirects). */
function safeReturnUrl(req, url) {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    if (['pharmlit:', 'exp:', 'exps:'].includes(u.protocol)) return u.toString();
    if (['http:', 'https:'].includes(u.protocol)) {
      const host = new URL(baseUrl(req)).host;
      if (u.host === host || u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.toString();
    }
  } catch {
    /* fall through */
  }
  return null;
}

function withParams(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (minor) => `GH₵${(minor / 100).toFixed(2)}`;

/**
 * Step 1 — the app asks for a checkout URL for an order.
 * Body: { orderId, returnUrl }   returnUrl = deep link / page to come back to after paying.
 */
router.post('/paystack/initialize', requireAuth, async (req, res) => {
  const order = getOrder(Number(req.body?.orderId));
  if (!order || order.userId !== req.user.id) throw new HttpError(404, 'Order not found');
  if (order.paymentMethod !== 'paystack') throw new HttpError(400, 'This order is pay on delivery');
  if (order.paymentStatus === 'paid') throw new HttpError(400, 'This order has already been paid');
  if (order.status === 'awaiting_prescription') {
    throw new HttpError(400, 'A pharmacist must approve your prescription before you can pay');
  }
  if (order.status !== 'pending_payment') throw new HttpError(400, 'This order cannot be paid');

  const reference = `PL-${order.id}-${Date.now().toString(36)}`;
  db.prepare(`UPDATE orders SET payment_reference = ?, updated_at = datetime('now') WHERE id = ?`).run(reference, order.id);

  const returnUrl = safeReturnUrl(req, req.body?.returnUrl);
  const callbackUrl = withParams(`${baseUrl(req)}/api/payments/paystack/callback`, returnUrl ? { returnUrl } : {});

  if (isDemoPayments()) {
    const demoUrl = withParams(`${baseUrl(req)}/api/payments/demo/checkout`, { reference, callbackUrl });
    return res.json({ authorizationUrl: demoUrl, reference, demo: true });
  }

  const data = await initializeTransaction({
    email: req.user.email,
    amount: order.total,
    reference,
    callbackUrl,
    metadata: { order_id: order.id, customer_name: req.user.name, phone: order.deliveryPhone },
  });
  res.json({ authorizationUrl: data.authorization_url, reference: data.reference, demo: false });
});

async function confirm(reference) {
  if (isDemoPayments()) {
    // In demo mode the demo checkout page marks the order paid itself.
    const o = db.prepare('SELECT id FROM orders WHERE payment_reference = ?').get(reference);
    if (!o) throw new HttpError(404, 'Unknown payment reference');
    return getOrder(o.id);
  }
  const data = await verifyTransaction(reference);
  if (data.status === 'success' && data.currency === config.paystack.currency) {
    return markOrderPaid(reference, data.amount);
  }
  const o = db.prepare('SELECT id FROM orders WHERE payment_reference = ?').get(reference);
  if (!o) throw new HttpError(404, 'Unknown payment reference');
  return getOrder(o.id);
}

/** Step 2 — the app checks the result after the customer returns. */
router.get('/paystack/verify/:reference', requireAuth, async (req, res) => {
  const order = await confirm(req.params.reference);
  if (order.userId !== req.user.id) throw new HttpError(404, 'Order not found');
  res.json({ order, paid: order.paymentStatus === 'paid' });
});

/** Paystack redirects the customer's browser here after checkout. */
router.get('/paystack/callback', async (req, res) => {
  const reference = String(req.query.reference || req.query.trxref || '');
  let paid = false;
  let orderId = null;
  try {
    const order = await confirm(reference);
    paid = order.paymentStatus === 'paid';
    orderId = order.id;
  } catch {
    /* show generic page below */
  }
  const returnUrl = safeReturnUrl(req, req.query.returnUrl);
  if (returnUrl) return res.redirect(withParams(returnUrl, { reference, paid: String(paid) }));
  res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="font-family:system-ui;text-align:center;padding:48px">
    <h2>${paid ? 'Payment successful ✅' : 'Payment not completed'}</h2>
    <p>${orderId ? `Order #${orderId}. ` : ''}You can now return to the Pharm-LIT app.</p></body>`);
});

/** Server-to-server confirmation from Paystack (set this URL in your Paystack dashboard). */
router.post('/paystack/webhook', (req, res) => {
  if (!isValidWebhookSignature(req.rawBody, req.headers['x-paystack-signature'])) {
    return res.sendStatus(401);
  }
  const event = req.body;
  if (event?.event === 'charge.success' && event.data?.currency === config.paystack.currency) {
    try {
      markOrderPaid(event.data.reference, event.data.amount);
    } catch (err) {
      console.warn('Webhook could not mark order paid:', err.message);
    }
  }
  res.sendStatus(200);
});

// ---------------------------------------------------------------------------
// Demo checkout — used when PAYSTACK_SECRET_KEY is not set, so the full flow
// can be tried without a Paystack account. Mimics the mobile-money screen.
// ---------------------------------------------------------------------------
router.get('/demo/checkout', (req, res) => {
  if (!isDemoPayments()) throw new HttpError(404, 'Not found');
  const reference = String(req.query.reference || '');
  const o = db.prepare('SELECT * FROM orders WHERE payment_reference = ?').get(reference);
  if (!o) throw new HttpError(404, 'Unknown payment reference');
  const callbackUrl = String(req.query.callbackUrl || '');
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay ${money(o.total)} · Pharm-LIT</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#eef2f5;color:#0b1f33}
  .card{max-width:420px;margin:32px auto;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);overflow:hidden}
  .top{padding:20px 24px;border-bottom:1px solid #eef0f3;display:flex;justify-content:space-between;align-items:center}
  .amt{font-size:22px;font-weight:700}.muted{color:#6b7785;font-size:13px}
  .body{padding:24px}.banner{background:#fff8e1;color:#8a6100;font-size:12px;padding:10px 12px;border-radius:8px;margin-bottom:18px}
  label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}
  .nets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .nets input{display:none}.nets span{display:block;text-align:center;padding:12px 4px;border:2px solid #e3e7ec;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer}
  .nets input:checked+span{border-color:#0E9F6E;background:#ecfdf5}
  input[type=tel]{width:100%;padding:12px;border:1px solid #d6dbe1;border-radius:10px;font-size:16px}
  button{width:100%;margin-top:22px;padding:14px;border:0;border-radius:10px;background:#0E9F6E;color:#fff;font-size:16px;font-weight:700;cursor:pointer}
  .cancel{background:none;color:#6b7785;margin-top:8px;font-weight:500}
</style></head><body>
<div class="card">
  <div class="top"><div><div class="muted">Pharm-LIT · Order #${o.id}</div><div class="amt">${money(o.total)}</div></div><div class="muted">${escapeHtml(reference)}</div></div>
  <div class="body">
    <div class="banner"><b>Demo checkout.</b> No real money moves. Add a PAYSTACK_SECRET_KEY on the server to use real Paystack Mobile Money.</div>
    <form method="post" action="/api/payments/demo/complete">
      <input type="hidden" name="reference" value="${escapeHtml(reference)}">
      <input type="hidden" name="callbackUrl" value="${escapeHtml(callbackUrl)}">
      <label>Mobile money network</label>
      <div class="nets">
        <label><input type="radio" name="network" value="mtn" checked><span>MTN MoMo</span></label>
        <label><input type="radio" name="network" value="telecel"><span>Telecel Cash</span></label>
        <label><input type="radio" name="network" value="airteltigo"><span>AirtelTigo</span></label>
      </div>
      <label for="phone">Mobile money number</label>
      <input id="phone" type="tel" name="phone" value="${escapeHtml(o.delivery_phone)}" required>
      <button type="submit" name="outcome" value="success">Pay ${money(o.total)}</button>
      <button type="submit" name="outcome" value="cancel" class="cancel" formnovalidate>Cancel payment</button>
    </form>
  </div>
</div></body></html>`);
});

router.post('/demo/complete', (req, res) => {
  if (!isDemoPayments()) throw new HttpError(404, 'Not found');
  const reference = String(req.body?.reference || '');
  if (req.body?.outcome === 'success') markOrderPaid(reference, null);
  const cb = String(req.body?.callbackUrl || '');
  let target = `/api/payments/paystack/callback?reference=${encodeURIComponent(reference)}`;
  try {
    const u = new URL(cb);
    if (u.pathname === '/api/payments/paystack/callback') {
      u.searchParams.set('reference', reference);
      target = u.pathname + u.search; // keep it relative → same host
    }
  } catch {
    /* use default */
  }
  res.redirect(303, target);
});

export default router;
