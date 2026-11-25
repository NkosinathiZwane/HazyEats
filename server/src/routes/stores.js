import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

export const storeJson = (s, menu) => ({
  id: s.id, name: s.name, category: s.category, eta: s.eta, logo: s.logo,
  isCommunity: !!s.is_community, isOpen: !!s.is_open, status: s.status, menu,
});

export const menuJson = (m) => ({ id: m.id, name: m.name, priceCents: m.price_cents, available: !!m.available });

router.get('/', (_req, res) => {
  const stores = db.prepare("SELECT * FROM stores WHERE status = 'approved' ORDER BY rowid").all();
  const items = db.prepare('SELECT * FROM menu_items WHERE available = 1 ORDER BY id').all();
  const byStore = new Map();
  for (const m of items) {
    if (!byStore.has(m.store_id)) byStore.set(m.store_id, []);
    byStore.get(m.store_id).push(menuJson(m));
  }
  res.json({ stores: stores.map((s) => storeJson(s, byStore.get(s.id) || [])) });
});

export default router;
