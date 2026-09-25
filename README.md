# Pharm-LIT

Pharm-LIT is an online pharmacy. Customers can browse medicines, upload prescriptions and pay with **Mobile Money** (MTN MoMo, Telecel Cash, AirtelTigo Money) or card through **Paystack**. Pay on delivery is also available. Pharmacy staff get an admin dashboard in the same app, where they review prescriptions, handle orders and manage stock.

| Part | Tech | Folder |
| --- | --- | --- |
| Mobile app (Android, iOS and web) | Expo SDK 57, React Native, Expo Router, TypeScript | [`mobile/`](mobile) |
| API | Node.js 22, Express 5, SQLite (`node:sqlite`), JWT auth, Paystack | [`backend/`](backend) |

## Features

**Customers**
- Browse by category, search by brand or generic name, and filter for over-the-counter or prescription (Rx) items
- Product pages show strength, form, pack size, stock level and related products
- The cart is saved on the device. Delivery costs GH₵15 and is free above GH₵300
- Upload a prescription by taking a photo with the camera or choosing one from the gallery
- Checkout collects delivery details and a prescription (if the cart needs one), then offers **Mobile Money / Card (Paystack)** or **Pay on delivery**
- Order tracking goes: *Awaiting prescription check → Awaiting payment → Being prepared → Out for delivery → Delivered*
- Customers can cancel an order before it is dispatched. The items go back into stock

**Pharmacists and admins** (open *Account → Admin dashboard*)
- The dashboard shows revenue, orders waiting to be packed, prescriptions to review, low stock and best sellers
- **Prescription review:** zoom into the photo, see which orders it is linked to, then approve or reject it with a reason. Approving lets the customer pay. Rejecting cancels the order and restocks the items
- **Orders:** filter by status, mark as out for delivery, mark as delivered (for pay-on-delivery orders this also records the cash as collected), or cancel. Cancelling a paid order flags it as *refund due*
- **Products and stock:** create, edit or hide products, set the Rx flag and featured items, and adjust stock quickly
- **Users and roles** (admin only): promote users to pharmacist or admin
- Pharmacists can review prescriptions, handle orders and change stock. Only admins can edit product details and manage staff

**Safety rules the server enforces**
- Rx items cannot be ordered without a prescription. Orders that need one cannot be paid until a pharmacist approves the prescription
- Prices and stock are always recalculated on the server. Stock is reserved when an order is placed so two people can't buy the last pack
- Paystack payments are confirmed with the server-side verify API **and** a signed webhook (HMAC-SHA512). The amount paid is checked against the order total
- Prescription images are private. Only the customer who uploaded them and pharmacy staff can open them

## Quick start

Requires **Node.js 22.13 or newer**.

```bash
npm run setup          # install backend + mobile dependencies

# Terminal 1 – API on http://localhost:4000 (creates the database and sample catalogue on first run)
npm run api

# Terminal 2 – the app
npm run app            # press "a" for Android, "i" for iOS, "w" for web, or scan the QR code with Expo Go
```

When the app runs in Expo Go on your phone, it finds the API automatically at your computer's IP on port 4000. Your phone and computer must be on the same Wi-Fi network.

**Single-server preview.** This builds the web version of the app and has the API serve it on port 4000:

```bash
npm run preview
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `ama@example.com` | `password123` |
| Admin | `admin@pharmlit.com` | `admin123` |

To reset the sample data, run `npm --prefix backend run seed`.

## Payments (Paystack Mobile Money)

With no Paystack key set, the API runs in **demo mode**. Checkout opens a simulated Mobile Money page and no real money moves. To accept real payments:

1. Create a Paystack account (Ghana) and enable the Mobile Money channel.
2. Copy `backend/.env.example` to `backend/.env` and set:
   ```ini
   PAYSTACK_SECRET_KEY=sk_live_xxx     # or sk_test_xxx while testing
   PUBLIC_URL=https://api.your-domain.com
   JWT_SECRET=<long random string>
   ```
3. In the Paystack dashboard, set the webhook URL to `https://api.your-domain.com/api/payments/paystack/webhook`.

How a payment works:

1. The app calls `POST /api/payments/paystack/initialize` and gets back a Paystack checkout URL.
2. The customer pays in Paystack's secure page, which opens in an in-app browser. They choose their network and approve the MoMo prompt.
3. Paystack redirects back into the app (`pharmlit://order/:id`). The app then calls `GET /api/payments/paystack/verify/:reference`.
4. The webhook also marks the order as paid, even if the customer closes the app before being redirected.

## Going to production

- **API:** deploy `backend/` to any Node host (Render, Railway, Fly.io or a VPS). Keep `backend/data/` (the SQLite database) and `backend/uploads/` (prescription images) on a persistent disk and back them up. Set `NODE_ENV=production`, `JWT_SECRET`, `PUBLIC_URL` and the Paystack keys.
- **App:** set `EXPO_PUBLIC_API_URL=https://api.your-domain.com`. Then build with EAS (`npx eas-cli@latest build -p android` or `-p ios`) and submit to Google Play and the App Store (`npx eas-cli@latest submit`).
- **Regulation (Ghana):** online pharmacies need a Pharmacy Council licence and a superintendent pharmacist. Check the current rules for e-pharmacy and for controlled medicines (for example, tramadol) before launch.
- **Ideas for next steps:** SMS/push notifications for order updates (Hubtel or Expo Notifications), delivery rider tracking, GhanaPost GPS address lookup, automatic Paystack refunds, and product photos.

## API overview

| Method & path | Who | Purpose |
| --- | --- | --- |
| `POST /api/auth/register` · `POST /api/auth/login` · `GET/PATCH /api/auth/me` | anyone / user | Accounts |
| `GET /api/categories` · `GET /api/products?q=&category=&rx=&sort=` · `GET /api/products/:id` | anyone | Catalogue |
| `POST /api/orders/quote` · `GET /api/orders/settings` | anyone | Live prices, stock and delivery fee |
| `POST /api/orders` · `GET /api/orders` · `GET /api/orders/:id` · `POST /api/orders/:id/cancel` | customer | Orders |
| `GET/POST /api/prescriptions` · `GET /api/prescriptions/:id/file` | customer / staff | Prescriptions |
| `POST /api/payments/paystack/initialize` · `GET /api/payments/paystack/verify/:ref` · `POST /api/payments/paystack/webhook` | customer / Paystack | Payments |
| `GET /api/admin/stats` · `/api/admin/orders` · `/api/admin/prescriptions` · `/api/admin/products` · `/api/admin/users` | staff | Admin |

Money is stored as integers in pesewas (`1500` = GH₵15.00).

## Development

```bash
npm test          # API integration tests (full order → prescription → payment → delivery flow)
npm run check     # mobile typecheck + lint
```
