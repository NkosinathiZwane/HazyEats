import { Modal } from './ui.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { money } from '../util.js';

export default function MenuModal() {
  const { menuStore: store, closeMenu } = useUI();
  const cart = useCart();
  if (!store) return null;
  const inBag = (id) => cart.items.find((i) => i.menuItemId === id)?.qty || 0;

  return (
    <Modal title={<>{store.name} <span className="gold-text">Menu</span></>} onClose={closeMenu}>
      <p className="muted small" style={{ marginBottom: 14 }}>
        {store.category}. Combine items from several stores in one delivery.
      </p>
      {!store.isOpen && <div className="form-error">{store.name} is closed right now. You can browse, but not order.</div>}
      {store.menu.length === 0 && <p className="muted">This store has no items on its menu yet.</p>}
      {store.menu.map((item) => (
        <div className="menu-item" key={item.id}>
          <div>
            <div style={{ fontWeight: 700 }}>{item.name}</div>
            <div className="gold-text" style={{ fontSize: '0.92rem' }}>{money(item.priceCents)}</div>
          </div>
          <button className="btn-gold btn-sm" disabled={!store.isOpen}
            onClick={() => cart.add({ menuItemId: item.id, storeId: store.id, storeName: store.name, name: item.name, priceCents: item.priceCents })}>
            {inBag(item.id) ? `Add another (${inBag(item.id)})` : '+ Add'}
          </button>
        </div>
      ))}
    </Modal>
  );
}
