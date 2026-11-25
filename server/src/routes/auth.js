import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { config } from '../config.js';
import { db, slugify } from '../db.js';
import { HttpError, parse } from '../http.js';
import { startSession, endSession, publicUser, attachUser } from '../auth.js';

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: config.authRateLimit, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const CATEGORIES = ['Fast food', 'Pizza', 'Restaurant', 'Groceries', 'Community'];
const phone = z.string().trim().regex(/^[0-9+() -]{7,20}$/, 'Enter a valid phone number');
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  phone,
  role: z.enum(['buyer', 'driver', 'store'], { message: 'Choose customer, driver or store' }),
  vehicle: z.string().trim().max(80).optional(),
  storeName: z.string().trim().min(2).max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
});

router.post('/signup', limiter, (req, res) => {
  const d = parse(signupSchema, req.body);
  if (d.role === 'driver' && !d.vehicle) throw new HttpError(400, 'Enter your vehicle type and registration');
  if (d.role === 'store' && !d.storeName) throw new HttpError(400, 'Enter your store or business name');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(d.email)) {
    throw new HttpError(409, 'An account with this email already exists. Please sign in.');
  }
  const hash = bcrypt.hashSync(d.password, 11);
  const create = db.transaction(() => {
    const r = db.prepare(`INSERT INTO users (name, email, password_hash, role, phone, vehicle)
                          VALUES (?,?,?,?,?,?)`).run(d.name, d.email, hash, d.role, d.phone, d.vehicle || null);
    if (d.role === 'store') {
      const category = d.category || 'Community';
      db.prepare(`INSERT INTO stores (id, name, category, eta, is_community, owner_id, status)
                  VALUES (?,?,?,?,?,?, 'pending')`)
        .run(slugify(d.storeName), d.storeName, category, '25-40 min', category === 'Community' ? 1 : 0, r.lastInsertRowid);
    }
    return r.lastInsertRowid;
  });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(create());
  startSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', limiter, (req, res) => {
  const d = parse(z.object({ email, password: z.string().min(1).max(100) }), req.body);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(d.email);
  const ok = user?.password_hash && bcrypt.compareSync(d.password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid email or password.');
  if (user.status !== 'active') throw new HttpError(403, 'This account is suspended. Contact HazyEats support.');
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

let googleClient;
router.post('/google', limiter, async (req, res, next) => {
  try {
    if (!config.googleClientId) throw new HttpError(503, 'Google sign-in is not set up on this server yet.');
    const d = parse(z.object({
      credential: z.string().min(20),
      role: z.enum(['buyer', 'driver']).default('buyer'),
    }), req.body);
    googleClient ||= new OAuth2Client(config.googleClientId);
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: d.credential, audience: config.googleClientId });
      payload = ticket.getPayload();
    } catch {
      throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
    }
    if (!payload?.email || !payload.email_verified) throw new HttpError(400, 'Your Google email is not verified.');
    const mail = payload.email.toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, mail);
    if (user && user.status !== 'active') throw new HttpError(403, 'This account is suspended. Contact HazyEats support.');
    if (!user) {
      const r = db.prepare('INSERT INTO users (name, email, google_id, role) VALUES (?,?,?,?)')
        .run(payload.name || mail.split('@')[0], mail, payload.sub, d.role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    } else if (!user.google_id) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, user.id);
    }
    startSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

router.get('/me', attachUser, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
