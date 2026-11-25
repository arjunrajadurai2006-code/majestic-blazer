import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ExternalLink, LogOut, Settings, LayoutDashboard, 
  AlertCircle, Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CUSTOMER_APP_URL } from '../config/urls';
import logo from '../assets/majestic-blazer-logo.jpeg';
import styles from './AdminHeader.module.css';

export default function AdminHeader({ mobileMenuOpen = false, onToggleMobileNav, hamburgerBtnRef }) {
  const { admin, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setConfirmModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenSignOutModal = () => {
    setDropdownOpen(false);
    setConfirmModalOpen(true);
  };

  const handleConfirmSignOut = async () => {
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
      setConfirmModalOpen(false);
    }
  };

  const initials = admin?.fullName
    ? admin.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    : 'AD';

  const storefrontUrl = CUSTOMER_APP_URL;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftSection}>
          <button
            ref={hamburgerBtnRef}
            type="button"
            className={styles.hamburgerBtn}
            onClick={onToggleMobileNav}
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-navigation-drawer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <Menu size={22} aria-hidden="true" />
          </button>

          <Link to="/" title="Atelier Dashboard" className={styles.mobileLogoLink}>
            <img src={logo} alt="Majestic Blazer" className={styles.mobileLogo} />
          </Link>

          <div className={styles.atelierBadge}>
            <span className={styles.pulseDot} />
            <span>Sathy Road Atelier &bull; Admin Console</span>
          </div>
        </div>

        <div className={styles.rightSection}>
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.storefrontLink}
            title="Open customer storefront in a new window"
          >
            <ExternalLink size={14} />
            <span>View Boutique</span>
          </a>

          {/* Account Menu Control */}
          <div className={styles.accountControl} ref={dropdownRef}>
            <button
              type="button"
              className={`${styles.accountButton} ${dropdownOpen ? styles.accountButtonOpen : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="Admin account menu"
            >
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.accountInfo}>
                <span className={styles.accountName}>{admin?.fullName || 'Administrator'}</span>
                <span className={styles.accountRole}>Atelier Admin</span>
              </div>
              <ChevronDown size={14} color="#aaa" />
            </button>

            {/* Dropdown Popover */}
            {dropdownOpen && (
              <div className={styles.dropdownMenu} role="menu">
                <div className={styles.menuHeader}>
                  <div className={styles.menuHeaderName}>{admin?.fullName || 'Atelier Admin'}</div>
                  <div className={styles.menuHeaderEmail}>{admin?.email || 'admin@majesticblazer.com'}</div>
                  <span className={styles.menuRoleBadge}>Master Access</span>
                </div>

                <Link
                  to="/"
                  className={styles.menuItem}
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                >
                  <LayoutDashboard size={15} />
                  <span>Executive Overview</span>
                </Link>

                <Link
                  to="/settings"
                  className={styles.menuItem}
                  onClick={() => setDropdownOpen(false)}
                  role="menuitem"
                >
                  <Settings size={15} />
                  <span>Store & Tax Policies</span>
                </Link>

                <div className={styles.menuDivider} />

                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.signOutItem}`}
                  onClick={handleOpenSignOutModal}
                  role="menuitem"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => !signingOut && setConfirmModalOpen(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-signout-title"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <AlertCircle size={22} />
              </div>
              <h2 id="modal-signout-title" className={styles.modalTitle}>
                Confirm Sign Out
              </h2>
            </div>

            <p className={styles.modalBody}>
              Are you sure you want to end your active administrative session for{' '}
              <strong style={{ color: '#111111' }}>{admin?.email}</strong>? You will need to sign in again to access the management portal.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setConfirmModalOpen(false)}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSignOutBtn}
                onClick={handleConfirmSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Sign Out Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
