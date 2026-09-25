import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pharmlit-'));
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.WEB_DIR = path.join(tmp, 'no-web');
process.env.PAYSTACK_SECRET_KEY = '';

let server;
let base;

before(async () => {
  const { seed } = await import('../src/seed.js');
  const { createApp } = await import('../src/app.js');
  seed();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
}

const PNG_1PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('full shopping, prescription and payment flow', async () => {
  // Catalogue
  const cats = await api('GET', '/api/categories');
  assert.equal(cats.status, 200);
  assert.ok(cats.body.categories.length >= 5);

  const search = await api('GET', '/api/products?q=paracetamol');
  assert.ok(search.body.products.length >= 1);
  const para = search.body.products.find((p) => p.name.startsWith('Paracetamol'));
  const amox = (await api('GET', '/api/products?q=amoxicillin')).body.products[0];
  assert.equal(amox.requiresPrescription, true);

  // Register customer
  const reg = await api('POST', '/api/auth/register', {
    body: { name: 'Kofi Test', email: 'kofi@test.com', password: 'secret12', phone: '0241112222' },
  });
  assert.equal(reg.status, 201);
  const token = reg.body.token;

  // Quote
  const quote = await api('POST', '/api/orders/quote', {
    body: { items: [{ productId: para.id, quantity: 2 }, { productId: amox.id, quantity: 1 }] },
  });
  assert.equal(quote.body.subtotal, para.price * 2 + amox.price);
  assert.equal(quote.body.requiresPrescription, true);

  const delivery = { name: 'Kofi Test', phone: '0241112222', address: 'East Legon, Accra' };

  // Rx item without prescription is refused
  const noRx = await api('POST', '/api/orders', {
    token,
    body: { items: [{ productId: amox.id, quantity: 1 }], paymentMethod: 'paystack', delivery },
  });
  assert.equal(noRx.status, 400);

  // Upload prescription
  const up = await api('POST', '/api/prescriptions', {
    token,
    body: { fileBase64: `data:image/png;base64,${PNG_1PX}`, doctorName: 'Dr. Owusu' },
  });
  assert.equal(up.status, 201);
  const rxId = up.body.prescription.id;

  const file = await fetch(`${base}/api/prescriptions/${rxId}/file?token=${token}`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/png');

  // Order waits for pharmacist
  const created = await api('POST', '/api/orders', {
    token,
    body: {
      items: [{ productId: para.id, quantity: 2 }, { productId: amox.id, quantity: 1 }],
      paymentMethod: 'paystack',
      prescriptionId: rxId,
      delivery,
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const order = created.body.order;
  assert.equal(order.status, 'awaiting_prescription');

  // Stock reserved
  const paraAfter = (await api('GET', `/api/products/${para.id}`)).body.product;
  assert.equal(paraAfter.stock, para.stock - 2);

  // Cannot pay yet
  const early = await api('POST', '/api/payments/paystack/initialize', { token, body: { orderId: order.id } });
  assert.equal(early.status, 400);

  // Admin approves prescription
  const adminLogin = await api('POST', '/api/auth/login', {
    body: { email: 'admin@pharmlit.com', password: 'admin123' },
  });
  const adminToken = adminLogin.body.token;
  const customerTriesAdmin = await api('GET', '/api/admin/stats', { token });
  assert.equal(customerTriesAdmin.status, 403);

  const pending = await api('GET', '/api/admin/prescriptions?status=pending', { token: adminToken });
  assert.equal(pending.body.prescriptions[0].id, rxId);
  const approve = await api('PATCH', `/api/admin/prescriptions/${rxId}`, {
    token: adminToken,
    body: { status: 'approved' },
  });
  assert.equal(approve.status, 200);
  assert.equal((await api('GET', `/api/orders/${order.id}`, { token })).body.order.status, 'pending_payment');

  // Pay via demo checkout
  const init = await api('POST', '/api/payments/paystack/initialize', {
    token,
    body: { orderId: order.id, returnUrl: 'pharmlit://order/' + order.id },
  });
  assert.equal(init.status, 200);
  assert.equal(init.body.demo, true);
  const page = await fetch(init.body.authorizationUrl);
  assert.match(await page.text(), /MTN MoMo/);

  const callbackUrl = new URL(init.body.authorizationUrl).searchParams.get('callbackUrl');
  const complete = await fetch(`${base}/api/payments/demo/complete`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ reference: init.body.reference, callbackUrl, outcome: 'success' }),
  });
  assert.equal(complete.status, 303);
  const cb = await fetch(base + complete.headers.get('location'), { redirect: 'manual' });
  assert.equal(cb.status, 302);
  assert.match(cb.headers.get('location'), /^pharmlit:\/\/order\/\d+\?reference=.*paid=true/);

  const verify = await api('GET', `/api/payments/paystack/verify/${init.body.reference}`, { token });
  assert.equal(verify.body.paid, true);
  assert.equal(verify.body.order.status, 'processing');

  // Staff moves it through delivery
  const out = await api('PATCH', `/api/admin/orders/${order.id}/status`, {
    token: adminToken,
    body: { status: 'out_for_delivery' },
  });
  assert.equal(out.body.order.status, 'out_for_delivery');
  const bad = await api('PATCH', `/api/admin/orders/${order.id}/status`, {
    token: adminToken,
    body: { status: 'processing' },
  });
  assert.equal(bad.status, 400);
  const done = await api('PATCH', `/api/admin/orders/${order.id}/status`, {
    token: adminToken,
    body: { status: 'delivered' },
  });
  assert.equal(done.body.order.status, 'delivered');

  const stats = await api('GET', '/api/admin/stats', { token: adminToken });
  assert.equal(stats.body.revenue, order.total);
});

test('cash on delivery order can be cancelled and stock is restored', async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: 'ama@example.com', password: 'password123' } });
  const token = login.body.token;
  const ors = (await api('GET', '/api/products?q=ORS')).body.products[0];
  const created = await api('POST', '/api/orders', {
    token,
    body: {
      items: [{ productId: ors.id, quantity: 3 }],
      paymentMethod: 'cash_on_delivery',
      delivery: { name: 'Ama', phone: '0241234567', address: 'Osu, Accra' },
    },
  });
  assert.equal(created.body.order.status, 'processing');
  assert.equal(created.body.order.deliveryFee, 1500);
  const cancelled = await api('POST', `/api/orders/${created.body.order.id}/cancel`, { token });
  assert.equal(cancelled.body.order.status, 'cancelled');
  const after = (await api('GET', `/api/products/${ors.id}`)).body.product;
  assert.equal(after.stock, ors.stock);
});

test('cannot order more than is in stock', async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: 'ama@example.com', password: 'password123' } });
  const bp = (await api('GET', '/api/products?q=Blood Pressure')).body.products[0];
  const r = await api('POST', '/api/orders', {
    token: login.body.token,
    body: {
      items: [{ productId: bp.id, quantity: bp.stock + 1 }],
      paymentMethod: 'cash_on_delivery',
      delivery: { name: 'Ama', phone: '0241234567', address: 'Osu' },
    },
  });
  assert.equal(r.status, 409);
});
