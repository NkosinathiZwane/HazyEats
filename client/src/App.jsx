import { Navigate, Route, Routes } from 'react-router-dom';
import Splash from './components/Splash.jsx';
import Header from './components/Header.jsx';
import MenuModal from './components/MenuModal.jsx';
import CartModal from './components/CartModal.jsx';
import AuthModal from './components/AuthModal.jsx';
import Marketplace from './pages/Marketplace.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { useCart } from './context/CartContext.jsx';
import { useUI } from './context/UIContext.jsx';
import { useConfig } from './hooks.js';
import { money } from './util.js';

function CartFloat() {
  const { count, subtotalCents } = useCart();
  const { openCart } = useUI();
  const { deliveryFeeCents } = useConfig();
  if (!count) return null;
  return (
    <button className="cart-float visible" onClick={openCart} aria-label={`Open your bag, ${count} items`}>
      <span>🛍️ Black bag ({count})</span><span>&bull;</span><span>{money(subtotalCents + deliveryFeeCents)}</span>
    </button>
  );
}

export default function App() {
  return (
    <>
      <Splash />
      <Header />
      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CartFloat />
      <MenuModal />
      <CartModal />
      <AuthModal />
      <footer>
        <strong>HazyEats</strong> prototype by <span className="gold-text">ZikCode</span> &bull; Connecting Hazyview and Shabalala.<br />
        Accounts, menus and orders are stored on the HazyEats server.
      </footer>
    </>
  );
}
