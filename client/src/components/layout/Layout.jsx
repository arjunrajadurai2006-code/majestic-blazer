import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import GlobalBackBar from '../common/GlobalBackBar';
import { BackNavigationProvider } from '../../context/BackNavigationContext';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { getPendingGuestAction, executePendingGuestAction } from '../../services/guestAction';
import styles from './Layout.module.css';

export default function Layout() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { loadWishlist } = useWishlist();
  const { success, error: toastError } = useToast();

  // Secondary resilience: execute any unhandled guest action upon authentication
  useEffect(() => {
    if (user && getPendingGuestAction()) {
      executePendingGuestAction({
        api,
        user,
        addToCart,
        loadWishlist,
        success,
        toastError,
      });
    }
  }, [user, addToCart, loadWishlist, success, toastError]);

  return (
    <BackNavigationProvider>
      {/*
        Flex column that fills the full viewport height.
        - Header is sticky (handled by its own CSS).
        - <main> grows to fill available space (flex: 1 0 auto), pushing Footer to the bottom.
        - Footer always sits after content, never overlaps it.
      */}
      <div className={styles.layout}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <Header />
        <GlobalBackBar />
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </BackNavigationProvider>
  );
}
