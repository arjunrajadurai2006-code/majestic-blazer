import { Link } from 'react-router-dom';
import { Heart, Trash2, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import styles from './Wishlist.module.css';

export default function Wishlist() {
  const { wishlistItems, toggleWishlist, loading } = useWishlist();

  if (loading) {
    return (
      <div className={`container ${styles.page}`}>
        <p>Loading your saved pieces...</p>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className={`container ${styles.emptyPage}`}>
        <div className={styles.emptyCard}>
          <Heart size={48} className={styles.emptyIcon} />
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

      <div className={styles.grid}>
        {wishlistItems.map((item) => (
          <article key={item.product_id || item.id} className={styles.card}>
            <Link to={`/products/${item.slug}`} className={styles.imgWrap}>
              <img src={item.image_url} alt={item.name} className={styles.img} />
            </Link>

            <div className={styles.body}>
              <h3 className={styles.title}>
                <Link to={`/products/${item.slug}`}>{item.name}</Link>
              </h3>

              <div className={styles.prices}>
                {item.is_purchasable && item.sale_price && (
                  <span>Buy: <strong>₹{Number(item.sale_price).toLocaleString('en-IN')}</strong></span>
                )}
                {item.is_rentable && item.rent_price_per_day && (
                  <span className={styles.rentPrice}>
                    Rent: <strong>₹{Number(item.rent_price_per_day).toLocaleString('en-IN')}/day</strong>
                  </span>
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
                  aria-label="Remove from wishlist"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

