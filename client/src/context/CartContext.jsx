import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const useCart = () => useContext(Ctx);
const KEY = 'hazyeats_cart_v4';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

// The bag lives in the browser until checkout. The server re-prices every item when the order is placed.
export function CartProvider({ children }) {
  const [items, setItems] = useState(read);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } }, [items]);

  const value = useMemo(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotalCents: items.reduce((s, i) => s + i.priceCents * i.qty, 0),
    add: (item) => setItems((cur) => cur.some((i) => i.menuItemId === item.menuItemId)
      ? cur.map((i) => (i.menuItemId === item.menuItemId ? { ...i, qty: Math.min(20, i.qty + 1) } : i))
      : [...cur, { ...item, qty: 1 }]),
    setQty: (id, qty) => setItems((cur) => (qty <= 0
      ? cur.filter((i) => i.menuItemId !== id)
      : cur.map((i) => (i.menuItemId === id ? { ...i, qty: Math.min(20, qty) } : i)))),
    clear: () => setItems([]),
  }), [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
