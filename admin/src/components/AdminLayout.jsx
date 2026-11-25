import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  const [sidebarSignOutModal, setSidebarSignOutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);
  const hamburgerBtnRef = useRef(null);
  const closeDrawerBtnRef = useRef(null);

  const closeMobileMenu = useCallback((restoreFocus = false) => {
    setMobileMenuOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => hamburgerBtnRef.current?.focus());
    }
  }, []);

  // Close mobile drawer automatically on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scroll, manage focus, Escape, and Tab trap for mobile drawer
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeDrawerBtnRef.current?.focus());

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMobileMenu(true);
        return;
      }
      if (e.key === 'Tab' && sidebarRef.current) {
        const focusables = sidebarRef.current.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

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

      {mobileMenuOpen && (
        <div
          className={styles.backdrop}
          onClick={() => closeMobileMenu(true)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        id="admin-navigation-drawer"
        aria-label="Admin navigation"
        className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <Link
            to="/"
            title="Atelier Dashboard"
            className={styles.logoLink}
            onClick={() => closeMobileMenu(false)}
          >
            <img src={logo} alt="Majestic Blazer" className={styles.logo} />
          </Link>
          <button
            ref={closeDrawerBtnRef}
            type="button"
            className={styles.closeDrawerBtn}
            onClick={() => closeMobileMenu(true)}
            aria-label="Close navigation menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Admin">
          <ul className={styles.nav}>
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
                  onClick={() => closeMobileMenu(false)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className={styles.logout}
          onClick={() => {
            setMobileMenuOpen(false);
            setSidebarSignOutModal(true);
          }}
          title="Sign out of Atelier Console"
        >
          <LogOut size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} aria-hidden="true" />
          Sign out
        </button>
      </aside>

      <div className={styles.mainWrapper}>
        <AdminHeader
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileNav={() => setMobileMenuOpen((prev) => !prev)}
          hamburgerBtnRef={hamburgerBtnRef}
        />
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: '#111111', margin: 0 }}>
                Confirm Sign Out
              </h2>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#666666', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Are you sure you want to end your active administrative session for <strong style={{ color: '#111111' }}>{admin?.email}</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
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
                onClick={() => setSidebarSignOutModal(false)}
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
