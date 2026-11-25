import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { useConfig } from '../hooks.js';
import { CATEGORIES, money } from '../util.js';

function StoreCard({ store, fee, onOpen }) {
  const [broken, setBroken] = useState(false);
  return (
    <button className={`store-card ${store.isOpen ? '' : 'closed'}`} onClick={() => onOpen(store)}>
      <div className="store-banner">
        {store.logo && !broken
          ? <img src={store.logo} alt={`${store.name} logo`} className="store-logo-img" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          : <div style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center' }} className="gold-text">{store.name}</div>}
        {store.isCommunity && <span className="community-badge">SHABALALA LOCAL</span>}
        {!store.isOpen && <span className="closed-badge">Closed</span>}
      </div>
      <div className="store-info">
        <div className="store-title"><span>{store.name}</span></div>
        <div className="store-meta">{money(fee)} flat delivery &bull; {store.eta} &bull; {store.category}</div>
      </div>
    </button>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const { openAuth, openMenu } = useUI();
  const { deliveryFeeCents } = useConfig();
  const [stores, setStores] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const gridRef = useRef(null);

  useEffect(() => { api.get('/stores').then((d) => setStores(d.stores)).catch((e) => setError(e.message)); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (stores || []).filter((s) =>
      (category === 'All' || s.category === category) &&
      (!q || s.name.toLowerCase().includes(q) || s.menu.some((m) => m.name.toLowerCase().includes(q))));
  }, [stores, query, category]);

  return (
    <main>
      <section className="hero">
        <div>
          <h1>Everything Hazyview, <span className="gold-text">in one black bag.</span></h1>
          <p>Order from KFC, Chicken Licken, Debonairs, Woolworths Food and local Shabalala kota and fries vendors in a single checkout. One driver, one {money(deliveryFeeCents)} fee, delivered to your door.</p>
          <div className="hero-cta">
            <button className="btn-gold" onClick={() => (user ? gridRef.current?.scrollIntoView({ behavior: 'smooth' }) : openAuth('signup', 'buyer'))}>
              {user ? 'Browse stores' : 'Order now'}
            </button>
            {!user && <button className="btn-outline" onClick={() => openAuth('signup', 'driver')}>Drive and earn</button>}
            {!user && <button className="btn-outline" onClick={() => openAuth('signup', 'store')}>Partner store or vendor</button>}
          </div>
        </div>
        <div className="bag-showcase">
          <div className="luxury-bag">
            <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: 1 }} className="gold-text">HAZYEATS</span>
            <span style={{ fontSize: '0.6rem', color: '#888', marginTop: 2 }}>SHABALALA VIP</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Multi-store, single delivery</div>
          <div className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>Chains and local spots in one order</div>
        </div>
      </section>

      <section className="controls" ref={gridRef}>
        <input className="search-box" value={query} onChange={(e) => setQuery(e.target.value)}
          aria-label="Search stores and dishes" placeholder="Search KFC, kota, Mama Zodwa, pizza, chips..." />
        <div className="chips">
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </section>

      <section className="grid">
        {error && <div className="notice">Could not load stores: {error}</div>}
        {!error && !stores && <div className="notice">Loading stores...</div>}
        {stores && shown.length === 0 && <div className="notice">Nothing matches that search. Try another dish or clear the filter.</div>}
        {shown.map((s) => <StoreCard key={s.id} store={s} fee={deliveryFeeCents} onOpen={openMenu} />)}
      </section>
    </main>
  );
}
