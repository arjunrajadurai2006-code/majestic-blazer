import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Search, ShoppingBag, Heart, User, Menu, X, ChevronDown, 
  Package, Calendar, LogOut, AlertCircle
} from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import styles from './Header.module.css';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop Blazers' },
  { to: '/contact', label: 'Boutique & Contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { success } = useToast();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const linkClass = ({ isActive }) => (isActive ? `${styles.navLink} ${styles.navActive}` : styles.navLink);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAccountDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAccountDropdownOpen(false);
        setConfirmSignOutOpen(false);
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleOpenSignOutModal = () => {
    setAccountDropdownOpen(false);
    setMobileMenuOpen(false);
    setConfirmSignOutOpen(true);
  };

  const handleConfirmSignOut = async () => {
    try {
      setSigningOut(true);
      await logout();
      success('You have been signed out successfully.');
      navigate('/login', { 
        replace: true,
        state: { message: 'You have been signed out successfully. We look forward to your return.' }
      });
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
      setConfirmSignOutOpen(false);
    }
  };

  const firstName = user?.fullName ? user.fullName.split(' ')[0] : 'Patron';

  return (
    <>
      {/* Sticky Top Header: Announcement Bar + Navigation Bar */}
      <div className={styles.stickyHeader}>
        {/* 1. Slim Announcement Bar */}
        <div className={styles.announcement}>
          <div className={`container ${styles.announcementInner}`}>
            <a href="tel:8903238882" className={styles.announcementText}>
              BESPOKE & TAILORING ENQUIRIES: 8903238882
            </a>
          </div>
        </div>

        {/* 2. Main Navigation Header */}
        <header className={styles.header}>
          <div className={`container ${styles.bar}`}>
            {/* Left: Logo & Navigation Links */}
            <div className={styles.navLeft}>
              <button
                type="button"
                className={styles.mobileToggle}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
                onClick={() => setMobileMenuOpen((v) => !v)}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>

              <Logo variant="header" onClick={closeMobileMenu} />

              <nav className={styles.desktopNav} aria-label="Main Navigation">
                <ul className={styles.navLinks}>
                  {NAV.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end} className={linkClass}>
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Right: Search, Wishlist, Bag, and Account Access */}
            <div className={styles.navRight}>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setSearchOpen(true)}
                aria-label="Search collection"
                title="Search collection"
              >
                <Search size={19} />
              </button>

              <NavLink
                to="/wishlist"
                className={styles.iconBtn}
                aria-label={wishlistCount > 0 ? `Wishlist (${wishlistCount} items)` : 'Wishlist'}
                title="Wishlist"
              >
                <Heart
                  size={19}
                  fill={wishlistCount > 0 ? '#E53945' : 'none'}
                  color={wishlistCount > 0 ? '#E53945' : 'currentColor'}
                />
                {wishlistCount > 0 && <span className={`${styles.badge} ${styles.wishlistBadge}`}>{wishlistCount}</span>}
              </NavLink>

              <NavLink to="/cart" className={styles.iconBtn} aria-label="Shopping Bag" title="Cart">
                <ShoppingBag size={19} />
                {itemCount > 0 && <span className={styles.badge}>{itemCount}</span>}
              </NavLink>

              {/* Account access control (Desktop) */}
              <div className={styles.desktopAccount}>
                {user ? (
                  <div className={styles.accountWrapper} ref={dropdownRef}>
                    <button
                      type="button"
                      className={`${styles.accountTrigger} ${accountDropdownOpen ? styles.accountTriggerOpen : ''}`}
                      onClick={() => setAccountDropdownOpen((prev) => !prev)}
                      aria-expanded={accountDropdownOpen}
                      aria-haspopup="true"
                      aria-label="Patron account menu"
                    >
                      <User size={16} />
                      <span className={styles.userLabel}>{firstName}</span>
                      <ChevronDown size={13} className={accountDropdownOpen ? styles.chevronRotated : styles.chevron} />
                    </button>

                    {accountDropdownOpen && (
                      <div className={styles.accountDropdown} role="menu">
                        <div className={styles.dropdownHeader}>
                          <div className={styles.dropdownName}>{user.fullName}</div>
                          <div className={styles.dropdownEmail}>{user.email}</div>
                        </div>

                        <NavLink
                          to="/profile"
                          className={styles.dropdownItem}
                          onClick={() => setAccountDropdownOpen(false)}
                          role="menuitem"
                        >
                          <User size={15} />
                          <span>Profile</span>
                        </NavLink>

                        <NavLink
                          to="/orders"
                          className={styles.dropdownItem}
                          onClick={() => setAccountDropdownOpen(false)}
                          role="menuitem"
                        >
                          <Package size={15} />
                          <span>My Orders</span>
                        </NavLink>

                        <NavLink
                          to="/wishlist"
                          className={styles.dropdownItem}
                          onClick={() => setAccountDropdownOpen(false)}
                          role="menuitem"
                        >
                          <Heart
                            size={15}
                            fill={wishlistCount > 0 ? '#E53945' : 'none'}
                            color={wishlistCount > 0 ? '#E53945' : 'currentColor'}
                          />
                          <span>Wishlist</span>
                          {wishlistCount > 0 && <span className={styles.dropdownWishCount}>({wishlistCount})</span>}
                        </NavLink>

                        <div className={styles.dropdownDivider} />

                        <button
                          type="button"
                          className={`${styles.dropdownItem} ${styles.dropdownSignOut}`}
                          onClick={handleOpenSignOutModal}
                          role="menuitem"
                        >
                          <LogOut size={15} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.authGroup}>
                    <NavLink to="/login" className={styles.signInBtn}>
                      Sign In
                    </NavLink>
                    <NavLink to="/register" className={styles.registerBtn}>
                      Create Account
                    </NavLink>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile / Tablet Drawer & Backdrop (Rendered outside header to avoid backdrop-filter trapping) */}
      {mobileMenuOpen && (
        <div className={styles.mobileBackdrop} onClick={closeMobileMenu}>
          <div className={styles.mobileDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileDrawerHeader}>
              <Logo variant="header" onClick={closeMobileMenu} />
              <button
                type="button"
                className={styles.mobileDrawerClose}
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.mobileDrawerBody}>
              <nav className={styles.mobileNavLinks} aria-label="Mobile Navigation">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? `${styles.mobileLink} ${styles.mobileLinkActive}` : styles.mobileLink
                    }
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className={styles.mobileDivider} />

              {/* Mobile Account Section */}
              <div className={styles.mobileAccountSection}>
                {user ? (
                  <>
                    <div className={styles.mobileUserCard}>
                      <div className={styles.mobileAvatar}>
                        <User size={18} />
                      </div>
                      <div className={styles.mobileUserDetails}>
                        <span className={styles.mobileUserName}>{user.fullName}</span>
                        <span className={styles.mobileUserEmail}>{user.email}</span>
                      </div>
                    </div>

                    <div className={styles.mobileAccountLinks}>
                      <NavLink to="/profile" className={styles.mobileSubLink} onClick={closeMobileMenu}>
                        <User size={16} /> Profile
                      </NavLink>
                      <NavLink to="/orders" className={styles.mobileSubLink} onClick={closeMobileMenu}>
                        <Package size={16} /> My Orders
                      </NavLink>
                      <NavLink to="/wishlist" className={styles.mobileSubLink} onClick={closeMobileMenu}>
                        <Heart
                          size={16}
                          fill={wishlistCount > 0 ? '#E53945' : 'none'}
                          color={wishlistCount > 0 ? '#E53945' : 'currentColor'}
                        />
                        <span>Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ''}</span>
                      </NavLink>
                    </div>

                    <button
                      type="button"
                      className={styles.mobileSignOutBtn}
                      onClick={handleOpenSignOutModal}
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </>
                ) : (
                  <div className={styles.mobileAuthActions}>
                    <NavLink to="/login" className={styles.mobileSignInBtn} onClick={closeMobileMenu}>
                      Sign In
                    </NavLink>
                    <NavLink to="/register" className={styles.mobileRegisterBtn} onClick={closeMobileMenu}>
                      Create Account
                    </NavLink>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Modal Overlay */}
      {searchOpen && (
        <div className={styles.searchOverlay} onClick={() => setSearchOpen(false)}>
          <div className={styles.searchModal} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <Search size={22} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search velvet, tuxedos, peak lapels, navy blazers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className={styles.searchInput}
              />
              <button type="button" onClick={() => setSearchOpen(false)} className={styles.closeSearch} aria-label="Close search">
                <X size={20} />
              </button>
            </form>
            <div className={styles.searchSuggestions}>
              <span>Popular:</span>
              <button type="button" onClick={() => { navigate('/shop?search=Velvet'); setSearchOpen(false); }}>Velvet</button>
              <button type="button" onClick={() => { navigate('/shop?search=Tuxedo'); setSearchOpen(false); }}>Tuxedos</button>
              <button type="button" onClick={() => { navigate('/shop?search=Double-Breasted'); setSearchOpen(false); }}>Double-Breasted</button>
              <button type="button" onClick={() => { navigate('/shop?search=Jacquard'); setSearchOpen(false); }}>Jacquard</button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Sign Out Confirmation Modal */}
      {confirmSignOutOpen && (
        <div 
          className={styles.modalOverlay}
          onClick={() => !signingOut && setConfirmSignOutOpen(false)}
        >
          <div 
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalIcon}>
                <AlertCircle size={22} />
              </div>
              <h2 id="customer-modal-title" className={styles.modalTitle}>
                Confirm Sign Out
              </h2>
            </div>

            <p className={styles.modalBody}>
              Are you sure you want to sign out of your Majestic Blazer account (<strong>{user?.email}</strong>)?
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setConfirmSignOutOpen(false)}
                disabled={signingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleConfirmSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
