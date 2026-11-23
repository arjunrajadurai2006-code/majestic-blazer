import { Link } from 'react-router-dom';
import { Heart, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import styles from './Wishlist.module.css';

export default function Wishlist() {
  const { wishlistItems, toggleWishlist, loading } = useWishlist();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className={`container ${styles.page}`}>
        <p className={styles.loadingText}>Loading your saved pieces...</p>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconCircle}>
            <Heart size={36} fill="none" color="#E53945" />
          </div>
          <h2>Your Wishlist is Empty</h2>
          <p>Explore our signature blazers and save your favourite silhouettes for future purchase or rental.</p>
          <Link to="/shop" className={styles.exploreBtn}>Explore Collection</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>CURATED ARCHIVE</span>
        <h1>Saved Pieces ({wishlistItems.length})</h1>
      </div>

      {!user && (
        <div className={styles.guestBanner}>
          <div className={styles.guestBannerContent}>
            <div className={styles.guestBannerIcon}>
              <User size={18} />
            </div>
            <div className={styles.guestBannerText}>
              <strong className={styles.guestBannerTitle}>Guest Wishlist Active</strong>
              <span className={styles.guestBannerDesc}>
                Your saved pieces are stored in this browser session. Sign in to synchronize and preserve your wardrobe across all your devices.
              </span>
            </div>
          </div>
          <Link to="/account-access" className={styles.guestBannerBtn}>
            Sign In to Sync
          </Link>
        </div>
      )}

      <div className={styles.grid}>
        {wishlistItems.map((item) => (
          <article key={item.product_id || item.id} className={styles.card}>
            <Link to={`/products/${item.slug}`} className={styles.imgWrap}>
              <img src={item.image_url} alt={item.name} className={styles.img} loading="lazy" decoding="async" width="300" height="400" />
            </Link>

            <div className={styles.body}>
              <h3 className={styles.title}>
                <Link to={`/products/${item.slug}`}>{item.name}</Link>
              </h3>

              <div className={styles.prices}>
                {item.sale_price && (
                  <span><strong>₹{Number(item.sale_price).toLocaleString('en-IN')}</strong></span>
                )}
              </div>

              <div className={styles.actions}>
                <Link to={`/products/${item.slug}`} className={styles.viewBtn}>
                  <span>Select Size</span>
                  <ArrowRight size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleWishlist({ id: item.product_id || item.id, ...item })}
                  className={styles.removeBtn}
                  aria-label={`Remove ${item.name} from wishlist`}
                  aria-pressed="true"
                  title="Saved in Wishlist (Click to remove)"
                >
                  <Heart size={18} fill="#E53945" color="#E53945" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

