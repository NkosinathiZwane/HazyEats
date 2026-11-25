import { Router } from 'express';
import { z } from 'zod';
import { db, slugify } from '../db.js';
import { HttpError, parse } from '../http.js';
import { requireRole } from '../auth.js';
import { orderBase } from '../orders.js';

const router = Router();
router.use(requireRole('admin'));

const CATEGORIES = ['Fast food', 'Pizza', 'Restaurant', 'Groceries', 'Community'];

router.get('/overview', (_req, res) => {
  const o = db.prepare(`SELECT COUNT(*) AS orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_cents END), 0) AS gmv,
      SUM(status = 'delivered') AS delivered,
      SUM(status IN ('placed','preparing','ready_for_pickup','out_for_delivery')) AS active
      FROM orders`).get();
  const users = Object.fromEntries(db.prepare('SELECT role, COUNT(*) AS n FROM users GROUP BY role').all().map((r) => [r.role, r.n]));
  const stores = db.prepare(`SELECT SUM(status = 'approved') AS live, SUM(status = 'pending') AS pending FROM stores`).get();
  res.json({
    gmvCents: o.gmv, orders: o.orders, delivered: o.delivered || 0, active: o.active || 0,
    users, liveStores: stores.live || 0, pendingStores: stores.pending || 0,
  });
});

router.get('/stores', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.email AS owner_email, u.name AS owner_name,
           (SELECT COUNT(*) FROM menu_items m WHERE m.store_id = s.id) AS items
    FROM stores s LEFT JOIN users u ON u.id = s.owner_id ORDER BY s.rowid`).all();
  res.json({
    stores: rows.map((s) => ({
      id: s.id, name: s.name, category: s.category, status: s.status, isOpen: !!s.is_open,
      isCommunity: !!s.is_community, items: s.items, ownerEmail: s.owner_email, ownerName: s.owner_name,
    })),
  });
});

router.patch('/stores/:id', (req, res) => {
  const d = parse(z.object({
    status: z.enum(['pending', 'approved', 'hidden']).optional(),
    ownerEmail: z.string().trim().toLowerCase().max(120).optional(),
  }), req.body);
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) throw new HttpError(404, 'Store not found.');
  if (d.status) db.prepare('UPDATE stores SET status = ? WHERE id = ?').run(d.status, store.id);
  if (d.ownerEmail !== undefined) {
    if (d.ownerEmail === '') {
      db.prepare('UPDATE stores SET owner_id = NULL WHERE id = ?').run(store.id);
    } else {
      const u = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'store'").get(d.ownerEmail);
      if (!u) throw new HttpError(404, 'No store account uses that email. The owner must sign up as a store first.');
      const other = db.prepare('SELECT name FROM stores WHERE owner_id = ? AND id != ?').get(u.id, store.id);
      if (other) throw new HttpError(409, `That account already runs ${other.name}.`);
      db.prepare('UPDATE stores SET owner_id = ? WHERE id = ?').run(u.id, store.id);
    }
  }
  res.json({ ok: true });
});

router.post('/stores', (req, res) => {
  const d = parse(z.object({
    name: z.string().trim().min(2).max(80),
    category: z.enum(CATEGORIES),
    dishName: z.string().trim().min(2).max(100),
    price: z.number().positive().max(5000),
  }), req.body);
  const id = slugify(d.name);
  db.transaction(() => {
    db.prepare(`INSERT INTO stores (id, name, category, eta, is_community, status) VALUES (?,?,?,?,?, 'approved')`)
      .run(id, d.name, d.category, '25-40 min', d.category === 'Community' ? 1 : 0);
    db.prepare('INSERT INTO menu_items (store_id, name, price_cents) VALUES (?,?,?)').run(id, d.dishName, Math.round(d.price * 100));
  })();
  res.status(201).json({ id });
});

router.get('/users', (_req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, phone, status, created_at FROM users ORDER BY id DESC LIMIT 500').all();
  res.json({ users: rows.map((u) => ({ ...u, createdAt: u.created_at.replace(' ', 'T') + 'Z', created_at: undefined })) });
});

router.patch('/users/:id', (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['active', 'suspended']) }), req.body);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) throw new HttpError(404, 'User not found.');
  if (u.role === 'admin') throw new HttpError(403, 'Admin accounts cannot be suspended here.');
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, u.id);
  res.json({ ok: true });
});

router.get('/orders', (_req, res) => {
  const ids = db.prepare('SELECT id FROM orders ORDER BY id DESC LIMIT 100').all();
  res.json({ orders: ids.map((r) => orderBase(r.id)).map(({ driverId, buyerId, ...o }) => o) });
});

export default router;
