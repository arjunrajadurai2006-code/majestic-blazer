import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Heart, User, Menu, X } from 'lucide-react';
import Logo from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import styles from './Header.module.css';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop Blazers' },
  { to: '/rent', label: 'Rent Collection' },
  { to: '/contact', label: 'Boutique & Contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link);
  const close = () => setOpen(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className={styles.announcement}>
        <div className={`container ${styles.announcementInner}`}>
          <span>COMPLIMENTARY LUXURY COURIER ACROSS INDIA</span>
          <span className={styles.divider}>•</span>
          <span>FLAGSHIP BOUTIQUE: SATHY ROAD, KURUMBAMPALAYAM, COIMBATORE</span>
          <span className={styles.divider}>•</span>
          <a href="tel:8903238882" className={styles.phoneLink}>BESPOKE & RENTAL ENQUIRIES: 8903238882</a>
        </div>
      </div>

      <header className={styles.header}>
        <div className={`container ${styles.bar}`}>
          <div className={styles.left}>
            <button
              className={styles.mobileToggle}
              aria-expanded={open}
              aria-label="Toggle navigation"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
            <NavLink to="/" className={styles.logoLink} onClick={close}>
              <Logo height={52} />
            </NavLink>
          </div>

          <nav className={`${styles.nav} ${open ? styles.open : ''}`} aria-label="Main">
            <ul className={styles.links}>
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className={linkClass} onClick={close}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <button
              className={styles.iconBtn}
              onClick={() => setSearchOpen(true)}
              aria-label="Search collection"
              title="Search"
            >
              <Search size={20} />
            </button>

            <NavLink to="/wishlist" className={styles.iconBtn} aria-label="Wishlist" title="Wishlist">
              <Heart size={20} />
              {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
            </NavLink>

            <NavLink to="/cart" className={styles.iconBtn} aria-label="Shopping Bag" title="Cart">
              <ShoppingBag size={20} />
              {itemCount > 0 && <span className={styles.badge}>{itemCount}</span>}
            </NavLink>

            <NavLink
              to={user ? '/profile' : '/login'}
              className={`${styles.iconBtn} ${styles.userBtn}`}
              aria-label={user ? 'My Profile' : 'Sign In'}
              title={user ? user.fullName : 'Sign in'}
            >
              <User size={20} />
              <span className={styles.userLabel}>{user ? user.fullName.split(' ')[0] : 'Sign In'}</span>
            </NavLink>
          </div>
        </div>

        {/* Search Overlay */}
        {searchOpen && (
          <div className={styles.searchOverlay} onClick={() => setSearchOpen(false)}>
            <div className={styles.searchModal} onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
                <Search size={24} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search velvet, tuxedos, peak lapels, navy blazers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className={styles.searchInput}
                />
                <button type="button" onClick={() => setSearchOpen(false)} className={styles.closeSearch}>
                  <X size={20} />
                </button>
              </form>
              <div className={styles.searchSuggestions}>
                <span>Popular:</span>
                <button type="button" onClick={() => { navigate('/shop?search=Velvet'); setSearchOpen(false); }}>Velvet</button>
                <button type="button" onClick={() => { navigate('/shop?search=Tuxedo'); setSearchOpen(false); }}>Tuxedos</button>
                <button type="button" onClick={() => { navigate('/shop?search=Double-Breasted'); setSearchOpen(false); }}>Double-Breasted</button>
                <button type="button" onClick={() => { navigate('/rent'); setSearchOpen(false); }}>Rentals</button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
