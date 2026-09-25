import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, toUser } from '../db.js';
import { HttpError, requireAuth, signToken } from '../auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim() || null;
  const password = String(req.body?.password || '');
  if (name.length < 2) throw new HttpError(400, 'Please enter your full name');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const r = db
    .prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)')
    .run(name, email, phone, bcrypt.hashSync(password, 10));
  const user = toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid));
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  const user = toUser(row);
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.patch('/me', requireAuth, (req, res) => {
  const { name, phone, address } = req.body || {};
  db.prepare(
    `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?`,
  ).run(name?.trim() || null, phone?.trim() || null, address?.trim() || null, req.user.id);
  res.json({ user: toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

export default router;
