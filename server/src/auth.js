import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError } from './http.js';

const COOKIE = 'he_token';

export function startSession(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function endSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function publicUser(u) {
  if (!u) return null;
  const out = {
    id: u.id, name: u.name, email: u.email, role: u.role,
    phone: u.phone, vehicle: u.vehicle, driverOnline: !!u.driver_online,
  };
  if (u.role === 'store') {
    const s = db.prepare('SELECT id, name, status FROM stores WHERE owner_id = ?').get(u.id);
    out.store = s || null;
  }
  return out;
}

// Loads the user from the cookie on every request so suspensions apply immediately.
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, config.jwtSecret);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sub);
      if (user && user.status === 'active') req.user = user;
    } catch { /* invalid or expired token: treat as signed out */ }
  }
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Your account type cannot do this.'));
    next();
  };
}
