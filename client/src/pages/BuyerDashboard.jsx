import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAction, usePoll } from '../hooks.js';
import { ErrorText, Loading, OrderSteps } from '../components/ui.jsx';
import { STATUS_BADGE, STATUS_LABEL, STORE_STEP, dateTime, money } from '../util.js';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data, error, reload } = usePoll(() => api.get('/orders/mine'));
  const act = useAction(reload);

  return (
    <>
      <h2>Welcome back, <span className="gold-text">{user.name}</span></h2>
      <p className="muted" style={{ margin: '6px 0 18px' }}>Follow your orders to Shabalala live. This page refreshes by itself.</p>
      <button className="btn-gold" style={{ marginBottom: 20 }} onClick={() => nav('/')}>+ Start a new order</button>
      <ErrorText>{error || act.error}</ErrorText>
      {!data && !error && <Loading />}
      {data?.orders.length === 0 && <p className="muted">No orders yet. Pick a store and fill your black bag.</p>}
      {data?.orders.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="row between">
            <strong>{o.code} &bull; {o.stores.map((s) => s.name).join(' + ')}</strong>
            <span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <OrderSteps status={o.status} />
          {o.status !== 'cancelled' && o.status !== 'delivered' && (
            <div className="chips-sm">
              {o.stores.map((s) => <span key={s.storeId} className={`chip-sm ${s.status}`}>{s.name}: {STORE_STEP[s.status]}</span>)}
            </div>
          )}
          <div className="order-items">
            {o.items.map((i, n) => <div key={n}>{i.qty} x {i.name} <span className="muted">({i.storeName})</span></div>)}
            <div style={{ marginTop: 6 }}>Deliver to: {o.address}</div>
            <div>Placed {dateTime(o.createdAt)} &bull; Total <strong className="gold-text">{money(o.totalCents)}</strong> cash on delivery</div>
            {o.driver && (
              <div style={{ marginTop: 6 }}>
                Your driver: <strong>{o.driver.name}</strong>{o.driver.vehicle ? ` (${o.driver.vehicle})` : ''}
                {o.driver.phone && <> &bull; <a href={`tel:${o.driver.phone}`}>{o.driver.phone}</a></>}
              </div>
            )}
          </div>
          {o.status === 'placed' && (
            <button className="btn-danger" style={{ marginTop: 12 }} disabled={act.busy}
              onClick={() => act.run(() => api.post(`/orders/${o.id}/cancel`))}>Cancel order</button>
          )}
        </div>
      ))}
    </>
  );
}
