import { api } from '../api.js';
import { useAction, usePoll } from '../hooks.js';
import { ErrorText, Loading } from '../components/ui.jsx';
import { STORE_STEP, dateTime, money } from '../util.js';

export default function DriverDashboard() {
  const { data, error, reload } = usePoll(() => api.get('/driver/overview'), 4000);
  const act = useAction(reload);
  if (error && !data) return <><h2>Driver dashboard</h2><ErrorText>{error}</ErrorText></>;
  if (!data) return <Loading />;
  const busy = data.active.length > 0;

  return (
    <>
      <div className="store-head">
        <div>
          <h2>Driver dispatch</h2>
          <p className="muted small" style={{ marginTop: 4 }}>A pickup unlocks once every store in the order marks its food ready.</p>
        </div>
        <button className={data.online ? 'btn-outline' : 'btn-gold'} disabled={act.busy}
          onClick={() => act.run(() => api.patch('/driver/me', { online: !data.online }))}>
          {data.online ? 'Online: tap to go offline' : 'Offline: tap to go online'}
        </button>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><div className="muted small">Deliveries completed</div><div className="stat-val">{data.stats.deliveries}</div></div>
        <div className="stat-card"><div className="muted small">Total earned</div><div className="stat-val gold-text">{money(data.stats.earningsCents)}</div></div>
      </div>
      <ErrorText>{act.error || error}</ErrorText>

      {data.active.map((o) => (
        <div className="order-card" key={o.id} style={{ borderColor: '#d4af37' }}>
          <h3 style={{ marginBottom: 8 }}>Your delivery: {o.code}</h3>
          <div className="order-items">
            <div>Route: <strong>{o.stores.map((s) => s.name).join(' to ')} to the customer</strong></div>
            <div>Drop-off: <strong>{o.address}</strong></div>
            <div>Customer: {o.buyerName}{o.buyerPhone && <> &bull; <a href={`tel:${o.buyerPhone}`}>{o.buyerPhone}</a></>}</div>
            {o.notes && <div>Note: {o.notes}</div>}
            <div>Collect cash on delivery. You keep the <strong className="gold-text">{money(o.deliveryFeeCents)}</strong> delivery fee.</div>
          </div>
          <button className="btn-gold" style={{ marginTop: 12 }} disabled={act.busy}
            onClick={() => act.run(() => api.post(`/driver/orders/${o.id}/deliver`))}>Confirm delivered to customer</button>
        </div>
      ))}

      <h3 className="section-title">Available deliveries</h3>
      {!data.online && <p className="muted">You are offline. Go online to see deliveries.</p>}
      {data.online && data.board.length === 0 && <p className="muted">No orders waiting right now. New ones appear here automatically.</p>}
      {data.board.map((o) => {
        const ready = o.status === 'ready_for_pickup';
        return (
          <div className="order-card" key={o.id}>
            <div className="row between">
              <div>
                <strong>{o.code}</strong> &bull; {o.itemCount} items &bull; fee {money(o.deliveryFeeCents)}
                <div className="order-items">Route: {o.stores.map((s) => s.name).join(' to ')} to {o.address}</div>
                <div className="chips-sm">
                  {o.stores.map((s) => <span key={s.storeId} className={`chip-sm ${s.status}`}>{s.name}: {STORE_STEP[s.status]}</span>)}
                </div>
              </div>
              {ready
                ? <button className="btn-gold" disabled={act.busy || busy} onClick={() => act.run(() => api.post(`/driver/orders/${o.id}/accept`))}>
                    {busy ? 'Finish your delivery first' : `Accept pickup (${money(o.deliveryFeeCents)})`}</button>
                : <span className="badge badge-pending">Waiting on stores</span>}
            </div>
          </div>
        );
      })}

      <h3 className="section-title">Completed deliveries</h3>
      {data.history.length === 0 && <p className="muted small">Your finished deliveries will be listed here.</p>}
      {data.history.map((o) => (
        <div className="order-card" key={o.id}>
          <div className="row between">
            <span><strong>{o.code}</strong> &bull; {o.stores.map((s) => s.name).join(' + ')} <span className="muted small">{dateTime(o.deliveredAt)}</span></span>
            <span className="badge badge-delivered">Delivered ({money(o.deliveryFeeCents)} earned)</span>
          </div>
        </div>
      ))}
    </>
  );
}
