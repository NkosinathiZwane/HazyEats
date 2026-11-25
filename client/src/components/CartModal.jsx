import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, ErrorText } from './ui.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { useConfig } from '../hooks.js';
import { money } from '../util.js';

const ADDR_KEY = 'hazyeats_address';

export default function CartModal() {
  const { cartOpen, closeCart, openAuth } = useUI();
  const { user } = useAuth();
  const cart = useCart();
  const { deliveryFeeCents } = useConfig();
  const nav = useNavigate();
  const [address, setAddress] = useState(() => localStorage.getItem(ADDR_KEY) || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cartOpen) return null;

  const total = cart.subtotalCents + (cart.count ? deliveryFeeCents : 0);

  async function placeOrder() {
    setError('');
    if (!user) { closeCart(); openAuth('signin', 'buyer', 'Sign in or create an account to place your order.'); return; }
    if (user.role !== 'buyer') { setError('Only customer accounts can place orders. Log out and sign up as a customer.'); return; }
    setBusy(true);
    try {
      await api.post('/orders', {
        items: cart.items.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
        address, phone: phone || undefined, notes: notes || undefined,
      });
      try { localStorage.setItem(ADDR_KEY, address); } catch { /* ignore */ }
      cart.clear();
      closeCart();
      nav('/dashboard');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={<>Your <span className="gold-text">HazyEats</span> black bag</>} onClose={closeCart}>
      {cart.items.length === 0 && <p className="muted">Your black bag is empty. Open a store and add something.</p>}
      {cart.items.map((item) => (
        <div className="menu-item" key={item.menuItemId}>
          <div>
            <div className="gold-text" style={{ fontSize: '0.75rem' }}>{item.storeName}</div>
            <div style={{ fontWeight: 700 }}>{item.name}</div>
            <div className="muted small">{money(item.priceCents * item.qty)}</div>
          </div>
          <div className="qty">
            <button aria-label={`Remove one ${item.name}`} onClick={() => cart.setQty(item.menuItemId, item.qty - 1)}>-</button>
            <span>{item.qty}</span>
            <button aria-label={`Add one ${item.name}`} onClick={() => cart.setQty(item.menuItemId, item.qty + 1)}>+</button>
          </div>
        </div>
      ))}

      {cart.items.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <div className="row between muted" style={{ marginBottom: 6 }}>
            <span>Items</span><span>{money(cart.subtotalCents)}</span>
          </div>
          <div className="row between muted" style={{ marginBottom: 6 }}>
            <span>One driver, all stores (flat delivery)</span><span>{money(deliveryFeeCents)}</span>
          </div>
          <div className="row between" style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 14 }}>
            <span>Total</span><span className="gold-text">{money(total)}</span>
          </div>
          <div className="form-group">
            <label htmlFor="addr">Delivery address in Shabalala / Hazyview</label>
            <input id="addr" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. House 412, Shabalala Trust (near the primary school)" />
          </div>
          <div className="form-group">
            <label htmlFor="ph">Phone number for the driver</label>
            <input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 072 555 1234" />
          </div>
          <div className="form-group">
            <label htmlFor="nt">Note for the stores or driver (optional)</label>
            <input id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="e.g. No atchar, blue gate" />
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>Pay cash to the driver on delivery.</p>
          <ErrorText>{error}</ErrorText>
          <button className="btn-gold" style={{ width: '100%' }} disabled={busy} onClick={placeOrder}>
            {busy ? 'Placing order...' : user ? 'Place order' : 'Sign in to place order'}
          </button>
        </div>
      )}
    </Modal>
  );
}
