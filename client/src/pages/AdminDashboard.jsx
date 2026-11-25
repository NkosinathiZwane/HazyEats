import { useState } from 'react';
import { api } from '../api.js';
import { useAction, usePoll } from '../hooks.js';
import { ErrorText, Loading, Tabs } from '../components/ui.jsx';
import { CATEGORIES, STATUS_BADGE, STATUS_LABEL, dateTime, money } from '../util.js';

function Overview({ act }) {
  const { data, reload } = usePoll(() => api.get('/admin/overview'), 8000);
  const [v, setV] = useState({ name: '', category: 'Community', dishName: '', price: '' });
  const [ok, setOk] = useState('');
  const run = useAction(reload);
  if (!data) return <Loading />;

  async function onboard(e) {
    e.preventDefault(); setOk('');
    if (await run.run(() => api.post('/admin/stores', { ...v, price: Number(v.price) }))) {
      setOk(`${v.name} is now live on HazyEats.`); setV({ name: '', category: 'Community', dishName: '', price: '' });
    }
  }
  const stat = (label, value, gold) => (
    <div className="stat-card"><div className="muted small">{label}</div><div className={`stat-val ${gold ? 'gold-text' : ''}`}>{value}</div></div>
  );
  return (
    <>
      <div className="stat-grid">
        {stat('Total sales (GMV)', money(data.gmvCents), true)}
        {stat('Orders', data.orders)}
        {stat('Active orders', data.active)}
        {stat('Delivered', data.delivered)}
        {stat('Live stores', data.liveStores)}
        {stat('Stores to approve', data.pendingStores)}
        {stat('Customers', data.users.buyer || 0)}
        {stat('Drivers', data.users.driver || 0)}
      </div>
      <div className="order-card" style={{ maxWidth: 540 }}>
        <h3 style={{ marginBottom: 12 }}>Onboard a Shabalala or Hazyview vendor</h3>
        <ErrorText>{run.error}</ErrorText>
        {ok && <div className="form-ok">{ok}</div>}
        <form onSubmit={onboard}>
          <div className="form-group"><label htmlFor="vn">Vendor or business name</label>
            <input id="vn" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Shabalala Bunny Chow Express" /></div>
          <div className="form-group"><label htmlFor="vc">Category</label>
            <select id="vc" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="form-group"><label htmlFor="vd">Signature dish</label>
            <input id="vd" required value={v.dishName} onChange={(e) => setV({ ...v, dishName: e.target.value })} placeholder="e.g. Quarter mutton bunny chow" /></div>
          <div className="form-group"><label htmlFor="vp">Price (rand)</label>
            <input id="vp" required type="number" min="1" step="0.5" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></div>
          <button className="btn-gold" disabled={run.busy}>Add vendor and publish</button>
        </form>
      </div>
    </>
  );
}

function StoreRow({ s, act }) {
  const [owner, setOwner] = useState(s.ownerEmail || '');
  const patch = (body) => act.run(() => api.patch(`/admin/stores/${s.id}`, body));
  return (
    <tr>
      <td><strong>{s.name}</strong><div className="muted small">{s.category}{s.isCommunity ? ' (local)' : ''} &bull; {s.items} items</div></td>
      <td><span className={`badge ${s.status === 'approved' ? 'badge-ready' : 'badge-pending'}`}>{s.status}</span></td>
      <td>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="owner@email.com" aria-label={`Owner email for ${s.name}`} />
          <button className="btn-outline btn-sm" disabled={act.busy || owner === (s.ownerEmail || '')} onClick={() => patch({ ownerEmail: owner })}>Save</button>
        </div>
      </td>
      <td>
        {s.status !== 'approved' && <button className="btn-gold btn-sm" disabled={act.busy} onClick={() => patch({ status: 'approved' })}>Approve</button>}
        {s.status === 'approved' && <button className="btn-outline btn-sm" disabled={act.busy} onClick={() => patch({ status: 'hidden' })}>Hide</button>}
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const stores = usePoll(() => api.get('/admin/stores'), 10000);
  const users = usePoll(() => api.get('/admin/users'), 15000);
  const orders = usePoll(() => api.get('/admin/orders'), 6000);
  const act = useAction(async () => { await Promise.all([stores.reload(), users.reload()]); });
  const pending = stores.data?.stores.filter((s) => s.status === 'pending').length || 0;

  return (
    <>
      <h2>ZikCode <span className="gold-text">admin command center</span></h2>
      <div style={{ height: 16 }} />
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['stores', `Stores${pending ? ` (${pending} to approve)` : ''}`], ['users', 'Users'], ['orders', 'Orders']]} />
      <ErrorText>{act.error}</ErrorText>

      {tab === 'overview' && <Overview />}

      {tab === 'stores' && (!stores.data ? <Loading /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Store</th><th>Status</th><th>Owner account (store login email)</th><th>Action</th></tr></thead>
          <tbody>{stores.data.stores.map((s) => <StoreRow key={s.id + (s.ownerEmail || '')} s={s} act={act} />)}</tbody>
        </table></div>
      ))}

      {tab === 'users' && (!users.data ? <Loading /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>{users.data.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}<div className="muted small">{u.phone}</div></td><td>{u.email}</td><td>{u.role}</td><td>{dateTime(u.createdAt)}</td>
              <td>{u.role === 'admin' ? <span className="badge badge-info">admin</span>
                : <button className={u.status === 'active' ? 'btn-danger btn-sm' : 'btn-gold btn-sm'} disabled={act.busy}
                    onClick={() => act.run(() => api.patch(`/admin/users/${u.id}`, { status: u.status === 'active' ? 'suspended' : 'active' }))}>
                    {u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ))}

      {tab === 'orders' && (!orders.data ? <Loading /> : (
        <>
          {orders.data.orders.length === 0 && <p className="muted">No orders yet.</p>}
          {orders.data.orders.map((o) => (
            <div className="order-card" key={o.id}>
              <div className="row between">
                <strong>{o.code} &bull; {o.stores.map((s) => s.name).join(' + ')}</strong>
                <span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </div>
              <div className="order-items">
                Customer {o.buyerName} &bull; {o.address} &bull; {dateTime(o.createdAt)}<br />
                Driver: {o.driver ? o.driver.name : 'not assigned'} &bull; Total <strong className="gold-text">{money(o.totalCents)}</strong>
              </div>
            </div>
          ))}
        </>
      ))}
    </>
  );
}
