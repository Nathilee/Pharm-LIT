import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config, isDemoPayments } from './config.js';
import { HttpError } from './auth.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import prescriptionRoutes from './routes/prescriptions.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(cors());
  app.use(
    express.json({
      limit: '10mb', // prescription photos are sent as base64
      verify: (req, _res, buf) => {
        req.rawBody = buf; // needed to check Paystack webhook signatures
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, demoPayments: isDemoPayments() }));
  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api/prescriptions', prescriptionRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // Serve the exported web build of the app (npm run build:web in /mobile), if present.
  if (fs.existsSync(path.join(config.webDir, 'index.html'))) {
    app.use(express.static(config.webDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(config.webDir, 'index.html')));
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('Pharm-LIT API is running. Build the app with `npm run build:web` in /mobile to serve it here.'),
    );
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 && !(err instanceof HttpError) ? 'Something went wrong. Please try again.' : err.message,
      details: err.details,
    });
  });

  return app;
}
