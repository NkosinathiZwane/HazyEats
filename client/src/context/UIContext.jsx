import { createContext, useContext, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }) {
  const [auth, setAuth] = useState(null);       // { mode, role, message } or null
  const [cartOpen, setCartOpen] = useState(false);
  const [menuStore, setMenuStore] = useState(null);

  const value = useMemo(() => ({
    auth, cartOpen, menuStore,
    openAuth: (mode = 'signin', role = 'buyer', message = '') => setAuth({ mode, role, message }),
    closeAuth: () => setAuth(null),
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    openMenu: (store) => setMenuStore(store),
    closeMenu: () => setMenuStore(null),
  }), [auth, cartOpen, menuStore]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
