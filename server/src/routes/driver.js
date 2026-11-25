import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError, parse } from '../http.js';
import { requireRole } from '../auth.js';
import { orderBase, forDriver } from '../orders.js';

const router = Router();
router.use(requireRole('driver'));

router.get('/overview', (req, res) => {
  const me = req.user;
  const view = (rows) => rows.map((r) => forDriver(orderBase(r.id), me.id));
  const board = me.driver_online
    ? db.prepare(`SELECT id FROM orders WHERE driver_id IS NULL AND status IN ('placed','preparing','ready_for_pickup')
                  ORDER BY (status = 'ready_for_pickup') DESC, id`).all()
    : [];
  const active = db.prepare("SELECT id FROM orders WHERE driver_id = ? AND status = 'out_for_delivery' ORDER BY id").all(me.id);
  const history = db.prepare("SELECT id FROM orders WHERE driver_id = ? AND status = 'delivered' ORDER BY id DESC LIMIT 50").all(me.id);
  const totals = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(delivery_fee_cents),0) AS earned
                             FROM orders WHERE driver_id = ? AND status = 'delivered'`).get(me.id);
  res.json({
    online: !!me.driver_online,
    board: view(board), active: view(active), history: view(history),
    stats: { deliveries: totals.n, earningsCents: totals.earned },
  });
});

router.patch('/me', (req, res) => {
  const { online } = parse(z.object({ online: z.boolean() }), req.body);
  db.prepare('UPDATE users SET driver_online = ? WHERE id = ?').run(online ? 1 : 0, req.user.id);
  res.json({ online });
});

router.post('/orders/:id/accept', (req, res) => {
  const id = Number(req.params.id);
  if (!req.user.driver_online) throw new HttpError(409, 'Go online to accept deliveries.');
  const busy = db.prepare("SELECT 1 FROM orders WHERE driver_id = ? AND status = 'out_for_delivery'").get(req.user.id);
  if (busy) throw new HttpError(409, 'Finish your current delivery before accepting another.');
  // Single atomic statement: only one driver can win, and only when every store is ready.
  const r = db.prepare(`UPDATE orders SET driver_id = ?, status = 'out_for_delivery'
                        WHERE id = ? AND driver_id IS NULL AND status = 'ready_for_pickup'`).run(req.user.id, id);
  if (!r.changes) throw new HttpError(409, 'This delivery is not available. A store may still be preparing it, or another driver took it.');
  res.json({ order: forDriver(orderBase(id), req.user.id) });
});

router.post('/orders/:id/deliver', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare(`UPDATE orders SET status = 'delivered', delivered_at = datetime('now')
                        WHERE id = ? AND driver_id = ? AND status = 'out_for_delivery'`).run(id, req.user.id);
  if (!r.changes) throw new HttpError(409, 'This delivery is not in progress for you.');
  res.json({ order: forDriver(orderBase(id), req.user.id) });
});

export default router;
