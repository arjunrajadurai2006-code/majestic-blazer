import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Eye, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { savePendingGuestAction } from '../../services/guestAction';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onQuickView }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wish = isWishlisted(product.id);

  const discountPercent = product.original_price && Number(product.original_price) > Number(product.sale_price)
    ? Math.round(((Number(product.original_price) - Number(product.sale_price)) / Number(product.original_price)) * 100)
    : 0;

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      savePendingGuestAction({
        action: 'wishlist',
        productId: product.id,
        returnUrl: location.pathname + location.search,
      });
      navigate('/login', {
        state: { from: location.pathname + location.search, preserved: { action: 'wishlist', productId: product.id } },
      });
      return;
    }
    toggleWishlist(product);
  };

  const handleQuickViewClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) onQuickView(product);
  };

  const imageSrc = product.image_url || product.images?.[0]?.url || '/assets/products/imperial-navy-velvet-front.webp';

  return (
    <article className={styles.card}>
      <Link to={`/products/${product.slug}`} className={styles.imageWrap}>
        <img
          src={imageSrc}
          alt={product.name}
          className={styles.image}
          loading="lazy"
          decoding="async"
        />

        <div className={styles.badges}>
          {discountPercent > 0 && (
            <span className={`${styles.badge} ${styles.saleBadge}`}>{discountPercent}% OFF</span>
          )}
        </div>

        <button
          type="button"
          className={`${styles.wishlistBtn} ${wish ? styles.wishlistActive : ''}`}
          onClick={handleWishlistClick}
          aria-label={wish ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={wish}
          title={wish ? 'Saved in Wishlist' : 'Save to Wishlist'}
        >
          <Heart size={18} fill={wish ? '#E53945' : 'none'} color={wish ? '#E53945' : '#444444'} />
        </button>

        {onQuickView && (
          <button
            type="button"
            className={styles.quickViewBtn}
            onClick={handleQuickViewClick}
            aria-label="Quick preview"
          >
            <Eye size={16} />
            <span>Quick View</span>
          </button>
        )}
      </Link>

      <div className={styles.body}>
        <span className={styles.category}>{product.category_name || 'Tailored Blazer'}</span>
        <h3 className={styles.title}>
          <Link to={`/products/${product.slug}`}>{product.name}</Link>
        </h3>

        <div className={styles.pricing}>
          {product.sale_price && (
            <div className={styles.buyPrice}>
              <span className={styles.price}>₹{Number(product.sale_price).toLocaleString('en-IN')}</span>
              {discountPercent > 0 && (
                <span className={styles.originalPrice}>₹{Number(product.original_price).toLocaleString('en-IN')}</span>
              )}
            </div>
          )}
        </div>

        <div className={styles.footerLink}>
          <Link to={`/products/${product.slug}`} className={styles.viewLink}>
            <span>View Tailoring</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}

