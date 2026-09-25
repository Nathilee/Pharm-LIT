import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

const dbFile = process.env.DB_FILE || path.join(config.dataDir, 'pharmlit.db');
export const db = new DatabaseSync(dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','pharmacist','admin')),
    address       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    slug  TEXT NOT NULL UNIQUE,
    icon  TEXT NOT NULL DEFAULT 'medkit',
    color TEXT NOT NULL DEFAULT '#0E9F6E'
  );

  CREATE TABLE IF NOT EXISTS products (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL,
    generic_name          TEXT,
    description           TEXT,
    category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    manufacturer          TEXT,
    dosage_form           TEXT,
    strength              TEXT,
    pack_size             TEXT,
    price                 INTEGER NOT NULL CHECK (price >= 0),
    stock                 INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    requires_prescription INTEGER NOT NULL DEFAULT 0,
    image_url             TEXT,
    featured              INTEGER NOT NULL DEFAULT 0,
    active                INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name    TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    patient_name TEXT,
    doctor_name  TEXT,
    notes        TEXT,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    review_note  TEXT,
    reviewed_by  INTEGER REFERENCES users(id),
    reviewed_at  TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id),
    status            TEXT NOT NULL CHECK (status IN (
                        'awaiting_prescription','pending_payment','processing',
                        'out_for_delivery','delivered','cancelled')),
    payment_method    TEXT NOT NULL CHECK (payment_method IN ('paystack','cash_on_delivery')),
    payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','failed','refunded')),
    payment_reference TEXT UNIQUE,
    paid_at           TEXT,
    subtotal          INTEGER NOT NULL,
    delivery_fee      INTEGER NOT NULL,
    total             INTEGER NOT NULL,
    delivery_name     TEXT NOT NULL,
    delivery_phone    TEXT NOT NULL,
    delivery_address  TEXT NOT NULL,
    notes             TEXT,
    prescription_id   INTEGER REFERENCES prescriptions(id),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id              INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id            INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name                  TEXT NOT NULL,
    unit_price            INTEGER NOT NULL,
    quantity              INTEGER NOT NULL CHECK (quantity > 0),
    requires_prescription INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions(user_id);
`);

/** Run fn inside a transaction; rolls back on throw. Nested calls join the outer transaction. */
let txDepth = 0;
export function tx(fn) {
  if (txDepth > 0) return fn();
  db.exec('BEGIN IMMEDIATE');
  txDepth++;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    txDepth--;
  }
}

/** node:sqlite returns null-prototype objects; normalise + convert flags to booleans. */
export function toProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    genericName: row.generic_name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name ?? undefined,
    categorySlug: row.category_slug ?? undefined,
    categoryColor: row.category_color ?? undefined,
    categoryIcon: row.category_icon ?? undefined,
    manufacturer: row.manufacturer,
    dosageForm: row.dosage_form,
    strength: row.strength,
    packSize: row.pack_size,
    price: row.price,
    stock: row.stock,
    requiresPrescription: !!row.requires_prescription,
    imageUrl: row.image_url,
    featured: !!row.featured,
    active: !!row.active,
  };
}

export function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    address: row.address,
    createdAt: row.created_at,
  };
}

export function toPrescription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    patientName: row.patient_name,
    doctorName: row.doctor_name,
    notes: row.notes,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    imageUrl: `/api/prescriptions/${row.id}/file`,
  };
}

export function toOrder(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.user_name ?? undefined,
    customerEmail: row.user_email ?? undefined,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
    paidAt: row.paid_at,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    deliveryName: row.delivery_name,
    deliveryPhone: row.delivery_phone,
    deliveryAddress: row.delivery_address,
    notes: row.notes,
    prescriptionId: row.prescription_id,
    prescriptionStatus: row.prescription_status ?? null,
    itemCount: row.item_count ?? items.reduce((n, i) => n + i.quantity, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      unitPrice: i.unit_price,
      quantity: i.quantity,
      requiresPrescription: !!i.requires_prescription,
    })),
  };
}
