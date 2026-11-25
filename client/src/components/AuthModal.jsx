import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, ErrorText } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { useConfig } from '../hooks.js';
import { CATEGORIES } from '../util.js';

const GIS = 'https://accounts.google.com/gsi/client';
let gisPromise;
const loadGoogle = () => (gisPromise ||= new Promise((resolve, reject) => {
  if (window.google?.accounts) return resolve();
  const s = document.createElement('script');
  s.src = GIS; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Google script blocked'));
  document.head.appendChild(s);
}));

const DEMOS = [
  ['Customer', 'buyer@hazyeats.demo'], ['Driver', 'driver@hazyeats.demo'],
  ['KFC store', 'store@hazyeats.demo'], ['Admin', 'admin@hazyeats.demo'],
];

export default function AuthModal() {
  const { auth, closeAuth, openAuth } = useUI();
  const { login, signup, google } = useAuth();
  const cfg = useConfig();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', role: 'buyer', vehicle: '', storeName: '', category: 'Community' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleBox = useRef(null);
  const roleRef = useRef('buyer');
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  const mode = auth?.mode;
  useEffect(() => { if (auth) { setF((c) => ({ ...c, role: auth.role || 'buyer' })); setError(''); } }, [auth?.mode, auth?.role]); // eslint-disable-line
  roleRef.current = f.role;

  useEffect(() => {
    if (!auth || !cfg.googleClientId || !googleBox.current) return;
    let cancelled = false;
    loadGoogle().then(() => {
      if (cancelled || !googleBox.current) return;
      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: async ({ credential }) => {
          try {
            await google(credential, roleRef.current === 'driver' ? 'driver' : 'buyer');
            closeAuth(); nav('/dashboard');
          } catch (e) { setError(e.message); }
        },
      });
      window.google.accounts.id.renderButton(googleBox.current, { theme: 'outline', size: 'large', width: 340, text: 'continue_with' });
    }).catch(() => setError('Google sign-in is blocked in this browser. Use email and password instead.'));
    return () => { cancelled = true; };
  }, [!!auth, cfg.googleClientId]); // eslint-disable-line

  if (!auth) return null;
  const isSignup = mode === 'signup';

  async function finish(fn) {
    setBusy(true); setError('');
    try { await fn(); closeAuth(); nav('/dashboard'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const submit = (e) => {
    e.preventDefault();
    finish(() => (isSignup
      ? signup({
        name: f.name, email: f.email, password: f.password, phone: f.phone, role: f.role,
        vehicle: f.role === 'driver' ? f.vehicle : undefined,
        storeName: f.role === 'store' ? f.storeName : undefined,
        category: f.role === 'store' ? f.category : undefined,
      })
      : login(f.email, f.password)));
  };

  return (
    <Modal title={isSignup ? 'Create your HazyEats account' : 'Sign in to HazyEats'} onClose={closeAuth}>
      {auth.message && <div className="banner">{auth.message}</div>}
      {cfg.googleClientId
        ? <div ref={googleBox} style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, minHeight: 44 }} />
        : <p className="muted small" style={{ marginBottom: 6 }}>Google sign-in appears here once a Google Client ID is added to the server settings.</p>}
      <div className="divider">OR USE EMAIL AND PASSWORD</div>
      <ErrorText>{error}</ErrorText>

      <form onSubmit={submit}>
        {isSignup && (
          <>
            <div className="form-group">
              <label htmlFor="role">I want to</label>
              <select id="role" value={f.role} onChange={set('role')}>
                <option value="buyer">Order food (customer)</option>
                <option value="driver">Deliver orders (car or motorbike)</option>
                <option value="store">Sell food (store or community vendor)</option>
              </select>
            </div>
            <div className="form-group"><label htmlFor="nm">Full name</label>
              <input id="nm" required value={f.name} onChange={set('name')} autoComplete="name" /></div>
            <div className="form-group"><label htmlFor="tel">Phone number (WhatsApp or call)</label>
              <input id="tel" type="tel" required value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="e.g. 072 555 1234" /></div>
            {f.role === 'driver' && (
              <div className="form-group"><label htmlFor="veh">Vehicle type and registration</label>
                <input id="veh" required value={f.vehicle} onChange={set('vehicle')} placeholder="e.g. Honda Ace 125 bike or VW Polo MP 442 GP" /></div>
            )}
            {f.role === 'store' && (
              <>
                <div className="form-group"><label htmlFor="sn">Store or business name</label>
                  <input id="sn" required value={f.storeName} onChange={set('storeName')} placeholder="e.g. Shabalala Kota Hub" /></div>
                <div className="form-group"><label htmlFor="cat">Category</label>
                  <select id="cat" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
                <p className="muted small" style={{ marginBottom: 12 }}>New stores go live after a HazyEats admin approves them.</p>
              </>
            )}
          </>
        )}
        <div className="form-group"><label htmlFor="em">Email address</label>
          <input id="em" type="email" required value={f.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" /></div>
        <div className="form-group"><label htmlFor="pw">Password{isSignup ? ' (at least 8 characters)' : ''}</label>
          <input id="pw" type="password" required minLength={isSignup ? 8 : undefined} value={f.password} onChange={set('password')}
            autoComplete={isSignup ? 'new-password' : 'current-password'} /></div>
        <button type="submit" className="btn-gold" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="muted small" style={{ textAlign: 'center', marginTop: 14 }}>
        {isSignup ? 'Already have an account? ' : 'New to HazyEats? '}
        <button className="link-btn gold-text" onClick={() => openAuth(isSignup ? 'signin' : 'signup', f.role)}>
          {isSignup ? 'Sign in' : 'Create an account'}
        </button>
      </p>

      {cfg.demo && !isSignup && (
        <div className="demo-box">
          <strong>Demo accounts</strong> (password Demo@1234). One tap to sign in:
          <div className="row">
            {DEMOS.map(([label, email]) => (
              <button key={email} type="button" className="btn-outline btn-sm" disabled={busy}
                onClick={() => finish(() => login(email, 'Demo@1234'))}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
