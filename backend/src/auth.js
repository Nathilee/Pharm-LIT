import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db, toUser } from './db.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  // Allows <Image source={{ uri: '...?token=' }}> for prescription images.
  if (typeof req.query.token === 'string') return req.query.token;
  return null;
}

/** Attaches req.user when a valid token is present; never rejects. */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (row) req.user = toUser(row);
    } catch {
      /* ignore invalid token */
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
    next();
  });
}

/** Staff = pharmacist or admin. */
export function requireRole(...roles) {
  return (req, res, next) =>
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this area'));
      next();
    });
}

export const requireStaff = requireRole('admin', 'pharmacist');
export const requireAdmin = requireRole('admin');
