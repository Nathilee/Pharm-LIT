import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// Load backend/.env if present (Node >= 20.12 has a built-in loader).
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;

export const config = {
  port: Number(env.PORT) || 4000,
  jwtSecret: env.JWT_SECRET || 'dev-only-insecure-secret',
  dataDir: env.DATA_DIR || path.join(ROOT, 'data'),
  uploadsDir: env.UPLOADS_DIR || path.join(ROOT, 'uploads'),
  webDir: env.WEB_DIR || path.resolve(ROOT, '..', 'mobile', 'dist'),
  publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
  paystack: {
    secretKey: env.PAYSTACK_SECRET_KEY || '',
    currency: env.PAYSTACK_CURRENCY || 'GHS',
  },
  admin: {
    email: env.ADMIN_EMAIL || 'admin@pharmlit.com',
    password: env.ADMIN_PASSWORD || 'admin123',
  },
  // Money is stored in the minor unit (pesewas). 1500 = GH₵15.00
  deliveryFee: Number(env.DELIVERY_FEE) || 1500,
  freeDeliveryThreshold: Number(env.FREE_DELIVERY_THRESHOLD) || 30000,
};

export const isDemoPayments = () => !config.paystack.secretKey;

if (config.jwtSecret === 'dev-only-insecure-secret' && env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
