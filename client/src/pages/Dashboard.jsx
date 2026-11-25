import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { Loading } from '../components/ui.jsx';
import BuyerDashboard from './BuyerDashboard.jsx';
import StoreDashboard from './StoreDashboard.jsx';
import DriverDashboard from './DriverDashboard.jsx';
import AdminDashboard from './AdminDashboard.jsx';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { openAuth } = useUI();
  if (loading) return <section className="dashboard-panel"><Loading /></section>;
  if (!user) {
    return (
      <section className="dashboard-panel">
        <h2>Sign in to see your dashboard</h2>
        <p className="muted" style={{ margin: '10px 0 18px' }}>Your orders, deliveries and store tools are tied to your account.</p>
        <button className="btn-gold" onClick={() => openAuth('signin')}>Sign in</button>
      </section>
    );
  }
  const View = { buyer: BuyerDashboard, store: StoreDashboard, driver: DriverDashboard, admin: AdminDashboard }[user.role];
  return <section className="dashboard-panel"><View /></section>;
}
