import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/majestic-blazer-logo.jpeg';
import styles from './AdminLayout.module.css';

export const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/orders', label: 'Orders' },
  { to: '/rental-bookings', label: 'Rental bookings' },
  { to: '/customers', label: 'Customers' },
  { to: '/payments', label: 'Payments' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
];

// Guards every admin route: redirects to /login unless a valid admin session exists.
export default function AdminLayout() {
  const { admin, loading, logout } = useAuth();
  if (loading) return null;
  if (!admin) return <Navigate to="/login" replace />;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <img src={logo} alt="Majestic Blazer" className={styles.logo} />
        <nav aria-label="Admin">
          <ul className={styles.nav}>
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button className={styles.logout} onClick={logout}>Sign out</button>
      </aside>
      <main className={styles.content}><Outlet /></main>
    </div>
  );
}
