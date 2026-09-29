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

/**
 * Possible places the login token can arrive, in order of preference.
 * Some hosting proxies strip or overwrite the Authorization header, so the app
 * also sends X-Auth-Token; ?token= lets <Image> load private prescription files.
 */
function candidateTokens(req) {
  const out = [];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) out.push(header.slice(7));
  const custom = req.headers['x-auth-token'];
  if (typeof custom === 'string' && custom) out.push(custom);
  if (typeof req.query.token === 'string' && req.query.token) out.push(req.query.token);
  return [...new Set(out)];
}

/** Attaches req.user when a valid token is present; never rejects. */
export function optionalAuth(req, _res, next) {
  for (const token of candidateTokens(req)) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (row) {
        req.user = toUser(row);
        break;
      }
    } catch {
      /* try the next candidate */
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
