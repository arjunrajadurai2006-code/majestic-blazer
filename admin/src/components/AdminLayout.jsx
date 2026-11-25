import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import logo from '../assets/majestic-blazer-logo.jpeg';
import AdminHeader from './AdminHeader';
import styles from './AdminLayout.module.css';

export const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/orders', label: 'Orders' },
  { to: '/customers', label: 'Customers' },
  { to: '/payments', label: 'Payments' },
  { to: '/coupons', label: 'Coupons' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
];

// Guards every admin route: redirects to /login unless a valid admin session exists.
export default function AdminLayout() {
  const { admin, loading, logout } = useAuth();
  const { settings } = useSettings();
  const storeName = settings?.store_name || 'Majestic Blazer';
  const [sidebarSignOutModal, setSidebarSignOutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const signOutTriggerRef = useRef(null);
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!sidebarSignOutModal) return undefined;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !signingOut) {
        setSidebarSignOutModal(false);
        signOutTriggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarSignOutModal, signingOut]);

  if (loading) return null;
  if (!admin) return <Navigate to="/login" replace />;

  const handleSidebarSignOut = async () => {
    try {
      setSigningOut(true);
      await logout();
      navigate('/login', { 
        replace: true,
        state: { message: 'You have been signed out of the Atelier Portal.' }
      });
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
      setSidebarSignOutModal(false);
    }
  };

  return (
    <div className={styles.shell}>
      <a href="#admin-main-content" className="skip-link">Skip to main content</a>
      <aside className={styles.sidebar}>
        <Link to="/" title="Atelier Dashboard" className={styles.logoLink}>
          <img src={logo} alt="Majestic Blazer" className={styles.logo} />
        </Link>
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
        <button 
          ref={signOutTriggerRef}
          type="button"
          className={styles.logout} 
          onClick={() => {
            setMobileMenuOpen(false);
            setSidebarSignOutModal(true);
          }}
          title="Sign out of Atelier Console"
        >
          <LogOut size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Sign out
        </button>
      </aside>

      <div className={styles.mainWrapper}>
        <AdminHeader />
        <main id="admin-main-content" tabIndex={-1} className={styles.content}>
          <Outlet />
        </main>
      </div>

      {/* Confirmation Modal for Sidebar Sign Out */}
      {sidebarSignOutModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
          onClick={() => !signingOut && setSidebarSignOutModal(false)}
        >
          <div 
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E5E5',
              borderRadius: '4px',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-signout-title"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff6b6b'
              }}>
                <AlertCircle size={22} />
              </div>
              <h2 id="admin-signout-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: '#111111', margin: 0 }}>
                Confirm Sign Out
              </h2>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#666666', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Are you sure you want to end your active administrative session for <strong style={{ color: '#111111' }}>{admin?.email}</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                ref={cancelBtnRef}
                type="button"
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#F7F7F7',
                  border: '1px solid #E5E5E5',
                  color: '#111111',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setSidebarSignOutModal(false);
                  signOutTriggerRef.current?.focus();
                }}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#e02424',
                  border: '1px solid #c81e1e',
                  color: '#ffffff',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={handleSidebarSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Sign Out Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
