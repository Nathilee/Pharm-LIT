import { config, isDemoPayments } from './config.js';
import { createApp } from './app.js';
import { seed } from './seed.js';

seed(); // creates the admin account + sample catalogue on first run

createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`Pharm-LIT API listening on http://0.0.0.0:${config.port}`);
  if (isDemoPayments()) console.log('Payments: DEMO mode (set PAYSTACK_SECRET_KEY for real Paystack payments)');
});
