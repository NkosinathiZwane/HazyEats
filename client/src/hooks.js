import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

let configCache;
export function useConfig() {
  const [cfg, setCfg] = useState(configCache || { googleClientId: '', deliveryFeeCents: 2000, demo: false });
  useEffect(() => {
    if (configCache) return;
    api.get('/config').then((c) => { configCache = c; setCfg(c); }).catch(() => {});
  }, []);
  return cfg;
}

// Loads data now and refreshes it every few seconds so dashboards update without a page reload.
export function usePoll(load, ms = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const loader = useRef(load);
  loader.current = load;
  const reload = useCallback(async () => {
    try { setData(await loader.current()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    reload();
    const t = setInterval(() => { if (!document.hidden) reload(); }, ms);
    return () => clearInterval(t);
  }, [reload, ms]);
  return { data, error, reload };
}

// Runs an action, reports its error, then refreshes the data on screen.
export function useAction(reload) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true); setError('');
    try { await fn(); await reload(); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }, [reload]);
  return { run, error, busy, setError };
}
