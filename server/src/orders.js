import { db, iso } from './db.js';

// Full order record, including every store's progress. Views below strip what each role may not see.
export function orderBase(id) {
  const o = db.prepare(`
    SELECT o.*, b.name AS buyer_name, b.phone AS buyer_phone,
           d.name AS driver_name, d.phone AS driver_phone, d.vehicle AS driver_vehicle
    FROM orders o
    JOIN users b ON b.id = o.buyer_id
    LEFT JOIN users d ON d.id = o.driver_id
    WHERE o.id = ?`).get(id);
  if (!o) return null;
  const stores = db.prepare(`
    SELECT os.store_id AS storeId, s.name, os.status
    FROM order_stores os JOIN stores s ON s.id = os.store_id
    WHERE os.order_id = ? ORDER BY s.rowid`).all(id);
  const items = db.prepare(`
    SELECT oi.store_id AS storeId, s.name AS storeName, oi.name, oi.qty, oi.price_cents AS priceCents
    FROM order_items oi JOIN stores s ON s.id = oi.store_id
    WHERE oi.order_id = ? ORDER BY oi.id`).all(id);
  return {
    id: o.id, code: o.code, status: o.status, address: o.address, notes: o.notes,
    subtotalCents: o.subtotal_cents, deliveryFeeCents: o.delivery_fee_cents, totalCents: o.total_cents,
    createdAt: iso(o.created_at), deliveredAt: iso(o.delivered_at),
    driverId: o.driver_id, buyerId: o.buyer_id,
    buyerName: o.buyer_name, buyerPhone: o.phone || o.buyer_phone,
    driver: o.driver_id ? { name: o.driver_name, phone: o.driver_phone, vehicle: o.driver_vehicle } : null,
    stores, items,
  };
}

export const forBuyer = (o) => {
  const { driverId, buyerId, ...rest } = o;
  return rest;
};

export function forStore(o, storeId) {
  const items = o.items.filter((i) => i.storeId === storeId);
  return {
    id: o.id, code: o.code, status: o.status, createdAt: o.createdAt, notes: o.notes,
    buyerName: o.buyerName,
    storeStatus: o.stores.find((s) => s.storeId === storeId)?.status,
    items,
    subtotalCents: items.reduce((sum, i) => sum + i.priceCents * i.qty, 0),
  };
}

export function forDriver(o, driverId) {
  const mine = o.driverId === driverId;
  return {
    id: o.id, code: o.code, status: o.status, address: o.address, notes: o.notes,
    buyerName: o.buyerName, buyerPhone: mine ? o.buyerPhone : null,
    deliveryFeeCents: o.deliveryFeeCents, createdAt: o.createdAt, deliveredAt: o.deliveredAt,
    stores: o.stores, mine,
    itemCount: o.items.reduce((n, i) => n + i.qty, 0),
  };
}

export function recomputeStatus(orderId) {
  const rows = db.prepare('SELECT status FROM order_stores WHERE order_id = ?').all(orderId);
  const allReady = rows.length > 0 && rows.every((r) => r.status === 'ready');
  const anyStarted = rows.some((r) => r.status !== 'pending');
  const next = allReady ? 'ready_for_pickup' : anyStarted ? 'preparing' : 'placed';
  db.prepare(`UPDATE orders SET status = ?
              WHERE id = ? AND status IN ('placed','preparing','ready_for_pickup')`).run(next, orderId);
}
