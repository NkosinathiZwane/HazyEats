import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { openAuth } = useUI();
  const nav = useNavigate();
  const roleLabel = { buyer: 'My orders', driver: 'Driver dashboard', store: 'Store dashboard', admin: 'Admin dashboard' };

  return (
    <header>
      <div className="brand" onClick={() => nav('/')} role="link" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && nav('/')}>
        <div className="bag-icon">🛍️</div>
        <span>Hazy<span className="gold-text">Eats</span></span>
      </div>
      <div className="nav-actions">
        {!user ? (
          <>
            <button className="btn-outline" onClick={() => openAuth('signin')}>Sign in</button>
            <button className="btn-gold" onClick={() => openAuth('signup')}>Sign up</button>
          </>
        ) : (
          <>
            <button className="btn-outline" onClick={() => nav('/')}>Browse stores</button>
            <button className="btn-gold" onClick={() => nav('/dashboard')}>{roleLabel[user.role]}</button>
            <button className="btn-outline" onClick={async () => { await logout(); nav('/'); }}>Log out</button>
          </>
        )}
      </div>
    </header>
  );
}
