import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError, parse } from '../http.js';
import { requireRole } from '../auth.js';
import { orderBase, forStore, recomputeStatus } from '../orders.js';
import { storeJson, menuJson } from './stores.js';

const router = Router();
router.use(requireRole('store'));
router.use((req, _res, next) => {
  req.store = db.prepare('SELECT * FROM stores WHERE owner_id = ?').get(req.user.id);
  if (!req.store) return next(new HttpError(404, 'No store is linked to this account yet. Ask a HazyEats admin to assign one.'));
  next();
});

const price = z.number().positive('Price must be more than R0').max(5000).transform((r) => Math.round(r * 100));

router.get('/me', (req, res) => {
  const menu = db.prepare('SELECT * FROM menu_items WHERE store_id = ? ORDER BY id').all(req.store.id).map(menuJson);
  const stats = db.prepare(`
    SELECT COUNT(DISTINCT o.id) AS delivered,
           COALESCE(SUM(oi.price_cents * oi.qty), 0) AS earnings
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status = 'delivered' AND oi.store_id = ?`).get(req.store.id);
  res.json({ store: storeJson(req.store, menu), stats: { delivered: stats.delivered, earningsCents: stats.earnings } });
});

router.patch('/me', (req, res) => {
  const d = parse(z.object({ isOpen: z.boolean().optional(), eta: z.string().trim().min(3).max(20).optional() }), req.body);
  if (d.isOpen !== undefined) db.prepare('UPDATE stores SET is_open = ? WHERE id = ?').run(d.isOpen ? 1 : 0, req.store.id);
  if (d.eta) db.prepare('UPDATE stores SET eta = ? WHERE id = ?').run(d.eta, req.store.id);
  res.json({ ok: true });
});

const itemSchema = z.object({ name: z.string().trim().min(2, 'Enter an item name').max(100), price });

router.post('/menu', (req, res) => {
  const d = parse(itemSchema, req.body);
  const r = db.prepare('INSERT INTO menu_items (store_id, name, price_cents) VALUES (?,?,?)').run(req.store.id, d.name, d.price);
  res.status(201).json({ item: menuJson(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(r.lastInsertRowid)) });
});

router.patch('/menu/:id', (req, res) => {
  const d = parse(itemSchema.partial().extend({ available: z.boolean().optional() }), req.body);
  const cur = db.prepare('SELECT * FROM menu_items WHERE id = ? AND store_id = ?').get(Number(req.params.id), req.store.id);
  if (!cur) throw new HttpError(404, 'Menu item not found.');
  db.prepare('UPDATE menu_items SET name = ?, price_cents = ?, available = ? WHERE id = ?')
    .run(d.name ?? cur.name, d.price ?? cur.price_cents, d.available === undefined ? cur.available : d.available ? 1 : 0, cur.id);
  res.json({ item: menuJson(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(cur.id)) });
});

router.delete('/menu/:id', (req, res) => {
  const r = db.prepare('DELETE FROM menu_items WHERE id = ? AND store_id = ?').run(Number(req.params.id), req.store.id);
  if (!r.changes) throw new HttpError(404, 'Menu item not found.');
  res.json({ ok: true });
});

router.get('/orders', (req, res) => {
  const ids = db.prepare(`SELECT o.id FROM orders o JOIN order_stores os ON os.order_id = o.id
                          WHERE os.store_id = ? ORDER BY o.id DESC LIMIT 100`).all(req.store.id);
  res.json({ orders: ids.map((r) => forStore(orderBase(r.id), req.store.id)) });
});

router.post('/orders/:id/status', (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['preparing', 'ready']) }), req.body);
  const id = Number(req.params.id);
  const before = status === 'preparing' ? 'pending' : 'preparing';
  const change = db.transaction(() => {
    const r = db.prepare(`
      UPDATE order_stores SET status = ?
      WHERE order_id = ? AND store_id = ? AND status = ?
        AND (SELECT status FROM orders WHERE id = ?) IN ('placed','preparing')`)
      .run(status, id, req.store.id, before, id);
    if (r.changes) recomputeStatus(id);
    return r.changes;
  })();
  if (!change) throw new HttpError(409, status === 'preparing'
    ? 'This order is not waiting for you to accept it.'
    : 'Accept the order first, or it has already been collected or cancelled.');
  res.json({ order: forStore(orderBase(id), req.store.id) });
});

export default router;
