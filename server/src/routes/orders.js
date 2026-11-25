import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError, parse } from '../http.js';
import { requireRole } from '../auth.js';
import { orderBase, forBuyer } from '../orders.js';

const router = Router();
router.use(requireRole('buyer'));

const createSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.number().int().positive(),
    qty: z.number().int().min(1).max(20),
  })).min(1, 'Your bag is empty').max(50),
  address: z.string().trim().min(5, 'Enter your delivery address').max(300),
  phone: z.string().trim().regex(/^[0-9+() -]{7,20}$/, 'Enter a valid phone number').optional(),
  notes: z.string().trim().max(300).optional(),
});

router.post('/', (req, res) => {
  const d = parse(createSchema, req.body);

  // Merge duplicate lines, then price everything from the database. Client prices are never trusted.
  const qtyById = new Map();
  for (const i of d.items) qtyById.set(i.menuItemId, Math.min(20, (qtyById.get(i.menuItemId) || 0) + i.qty));

  const lines = [];
  for (const [id, qty] of qtyById) {
    const row = db.prepare(`
      SELECT m.id, m.name, m.price_cents, m.available, s.id AS store_id, s.name AS store_name, s.status, s.is_open
      FROM menu_items m JOIN stores s ON s.id = m.store_id WHERE m.id = ?`).get(id);
    if (!row || row.status !== 'approved') throw new HttpError(400, 'An item in your bag is no longer on the menu.');
    if (!row.is_open) throw new HttpError(400, `${row.store_name} is closed right now. Remove its items to continue.`);
    if (!row.available) throw new HttpError(400, `${row.name} is sold out. Remove it to continue.`);
    lines.push({ ...row, qty });
  }

  const subtotal = lines.reduce((s, l) => s + l.price_cents * l.qty, 0);
  const fee = config.deliveryFeeCents;
  const storeIds = [...new Set(lines.map((l) => l.store_id))];

  const place = db.transaction(() => {
    const r = db.prepare(`INSERT INTO orders (buyer_id, address, phone, notes, subtotal_cents, delivery_fee_cents, total_cents)
                          VALUES (?,?,?,?,?,?,?)`)
      .run(req.user.id, d.address, d.phone || req.user.phone || null, d.notes || null, subtotal, fee, subtotal + fee);
    const id = r.lastInsertRowid;
    db.prepare('UPDATE orders SET code = ? WHERE id = ?').run(`HE-${1000 + Number(id)}`, id);
    for (const s of storeIds) db.prepare('INSERT INTO order_stores (order_id, store_id) VALUES (?,?)').run(id, s);
    for (const l of lines) {
      db.prepare(`INSERT INTO order_items (order_id, store_id, menu_item_id, name, price_cents, qty)
                  VALUES (?,?,?,?,?,?)`).run(id, l.store_id, l.id, l.name, l.price_cents, l.qty);
    }
    return id;
  });
  res.status(201).json({ order: forBuyer(orderBase(place())) });
});

router.get('/mine', (req, res) => {
  const ids = db.prepare('SELECT id FROM orders WHERE buyer_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);
  res.json({ orders: ids.map((r) => forBuyer(orderBase(r.id))) });
});

router.post('/:id/cancel', (req, res) => {
  const r = db.prepare(`UPDATE orders SET status = 'cancelled'
                        WHERE id = ? AND buyer_id = ? AND status = 'placed'`).run(Number(req.params.id), req.user.id);
  if (!r.changes) throw new HttpError(409, 'This order can no longer be cancelled because a store has started preparing it.');
  res.json({ order: forBuyer(orderBase(Number(req.params.id))) });
});

export default router;
