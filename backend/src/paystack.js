import crypto from 'node:crypto';
import { config, isDemoPayments } from './config.js';
import { HttpError } from './auth.js';

const API = 'https://api.paystack.co';

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${config.paystack.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new HttpError(502, json.message || 'Payment provider error');
  }
  return json.data;
}

/**
 * Start a Paystack checkout. Paystack's hosted page lets Ghanaian customers pay with
 * MTN MoMo, Telecel Cash, AirtelTigo Money or card.
 */
export async function initializeTransaction({ email, amount, reference, callbackUrl, metadata }) {
  if (isDemoPayments()) return null;
  return call('POST', '/transaction/initialize', {
    email,
    amount, // minor unit (pesewas)
    currency: config.paystack.currency,
    reference,
    callback_url: callbackUrl,
    channels: ['mobile_money', 'card'],
    metadata,
  });
}

export async function verifyTransaction(reference) {
  if (isDemoPayments()) return null;
  return call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

export function isValidWebhookSignature(rawBody, signature) {
  if (!config.paystack.secretKey || !rawBody || !signature) return false;
  const hash = crypto.createHmac('sha512', config.paystack.secretKey).update(rawBody).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
