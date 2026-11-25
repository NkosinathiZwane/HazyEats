import { useState } from 'react';
import { api } from '../api.js';
import { useAction, usePoll } from '../hooks.js';
import { ErrorText, Loading, Tabs } from '../components/ui.jsx';
import { dateTime, money } from '../util.js';

function OrderCard({ o, act }) {
  const set = (status) => act.run(() => api.post(`/store/orders/${o.id}/status`, { status }));
  return (
    <div className="order-card">
      <div className="row between">
        <div>
          <strong>{o.code}</strong> for {o.buyerName} <span className="muted small">({dateTime(o.createdAt)})</span>
          <div className="order-items">
            {o.items.map((i, n) => <div key={n}>{i.qty} x {i.name}</div>)}
            {o.notes && <div>Note: {o.notes}</div>}
            <div>Your part: <strong className="gold-text">{money(o.subtotalCents)}</strong></div>
          </div>
        </div>
        <div>
          {o.status === 'cancelled' && <span className="badge badge-cancelled">Cancelled</span>}
          {o.status !== 'cancelled' && o.storeStatus === 'pending' && o.status !== 'delivered' &&
            <button className="btn-gold" disabled={act.busy} onClick={() => set('preparing')}>Accept and start preparing</button>}
          {o.status !== 'cancelled' && o.storeStatus === 'preparing' &&
            <button className="btn-gold" disabled={act.busy} onClick={() => set('ready')}>Mark ready for pickup</button>}
          {o.status !== 'cancelled' && o.storeStatus === 'ready' &&
            <span className="badge badge-ready">{o.status === 'ready_for_pickup' ? 'Ready, waiting for driver' : o.status === 'out_for_delivery' ? 'Collected by driver' : 'Ready, waiting on the other stores'}</span>}
        </div>
      </div>
    </div>
  );
}

function MenuRow({ item, act, reload }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState((item.priceCents / 100).toString());
  const save = async () => { if (await act.run(() => api.patch(`/store/menu/${item.id}`, { name, price: Number(price) }))) setEdit(false); };
  return (
    <tr>
      <td>{edit ? <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Item name" /> : item.name}</td>
      <td style={{ width: 120 }}>{edit ? <input type="number" step="0.5" min="1" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price in rand" /> : money(item.priceCents)}</td>
      <td><span className={`badge ${item.available ? 'badge-ready' : 'badge-delivered'}`}>{item.available ? 'On sale' : 'Sold out'}</span></td>
      <td>
        <div className="row">
          {edit
            ? <><button className="btn-gold btn-sm" disabled={act.busy} onClick={save}>Save</button>
                <button className="btn-outline btn-sm" onClick={() => setEdit(false)}>Cancel</button></>
            : <><button className="btn-outline btn-sm" onClick={() => setEdit(true)}>Edit</button>
                <button className="btn-outline btn-sm" disabled={act.busy}
                  onClick={() => act.run(() => api.patch(`/store/menu/${item.id}`, { available: !item.available }))}>
                  {item.available ? 'Mark sold out' : 'Back on sale'}</button>
                <button className="btn-danger btn-sm" disabled={act.busy}
                  onClick={() => window.confirm(`Delete ${item.name}?`) && act.run(() => api.del(`/store/menu/${item.id}`))}>Delete</button></>}
        </div>
      </td>
    </tr>
  );
}

export default function StoreDashboard() {
  const [tab, setTab] = useState('orders');
  const me = usePoll(() => api.get('/store/me'), 15000);
  const orders = usePoll(() => api.get('/store/orders'), 5000);
  const reloadAll = async () => { await Promise.all([me.reload(), orders.reload()]); };
  const act = useAction(reloadAll);
  const [dish, setDish] = useState({ name: '', price: '' });

  if (me.error) return <><h2>Store dashboard</h2><ErrorText>{me.error}</ErrorText></>;
  if (!me.data) return <Loading />;
  const { store, stats } = me.data;
  const list = orders.data?.orders || [];
  const groups = [
    ['New orders', list.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered' && o.storeStatus === 'pending')],
    ['In the kitchen', list.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered' && o.storeStatus === 'preparing')],
    ['Waiting for driver', list.filter((o) => ['placed', 'preparing', 'ready_for_pickup'].includes(o.status) && o.storeStatus === 'ready')],
    ['History', list.filter((o) => ['delivered', 'cancelled', 'out_for_delivery'].includes(o.status))],
  ];

  async function addItem(e) {
    e.preventDefault();
    if (await act.run(() => api.post('/store/menu', { name: dish.name, price: Number(dish.price) }))) setDish({ name: '', price: '' });
  }

  return (
    <>
      <div className="store-head">
        <div>
          <h2>Store console: <span className="gold-text">{store.name}</span></h2>
          <span className={`badge ${store.status === 'approved' ? 'badge-ready' : 'badge-pending'}`}>
            {{ approved: 'Live on HazyEats', pending: 'Waiting for admin approval', hidden: 'Hidden by admin' }[store.status]}
          </span>
        </div>
        <button className={store.isOpen ? 'btn-outline' : 'btn-gold'} disabled={act.busy}
          onClick={() => act.run(() => api.patch('/store/me', { isOpen: !store.isOpen }))}>
          {store.isOpen ? 'Open: tap to close for orders' : 'Closed: tap to reopen'}
        </button>
      </div>
      {store.status === 'pending' && (
        <div className="banner">Your store is not visible to customers yet. Build your menu now. An admin will approve it soon.</div>
      )}
      <div className="stat-grid">
        <div className="stat-card"><div className="muted small">Orders delivered</div><div className="stat-val">{stats.delivered}</div></div>
        <div className="stat-card"><div className="muted small">Sales so far</div><div className="stat-val gold-text">{money(stats.earningsCents)}</div></div>
        <div className="stat-card"><div className="muted small">Menu items</div><div className="stat-val">{store.menu.length}</div></div>
      </div>
      <ErrorText>{act.error || orders.error}</ErrorText>
      <Tabs tabs={[['orders', 'Orders'], ['menu', 'Menu']]} value={tab} onChange={setTab} />

      {tab === 'orders' && groups.map(([title, rows]) => (
        <div key={title}>
          <h3 className="section-title">{title} ({rows.length})</h3>
          {rows.length === 0 && <p className="muted small">Nothing here right now.</p>}
          {rows.map((o) => <OrderCard key={o.id} o={o} act={act} />)}
        </div>
      ))}

      {tab === 'menu' && (
        <>
          <form className="menu-add" onSubmit={addItem} style={{ marginBottom: 20 }}>
            <div className="form-group" style={{ margin: 0 }}><label htmlFor="dn">New item</label>
              <input id="dn" required value={dish.name} onChange={(e) => setDish({ ...dish, name: e.target.value })} placeholder="e.g. Quarter mutton bunny chow" /></div>
            <div className="form-group" style={{ margin: 0 }}><label htmlFor="dp">Price (rand)</label>
              <input id="dp" required type="number" min="1" step="0.5" value={dish.price} onChange={(e) => setDish({ ...dish, price: e.target.value })} /></div>
            <button className="btn-gold" disabled={act.busy}>Add to menu</button>
          </form>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {store.menu.length === 0 && <tr><td colSpan="4" className="muted">No items yet. Add your first dish above.</td></tr>}
                {store.menu.map((item) => <MenuRow key={item.id} item={item} act={act} />)}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
