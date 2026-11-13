import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Eye, ArrowRight } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, onQuickView }) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wish = isWishlisted(product.id);

  const discountPercent = product.original_price && Number(product.original_price) > Number(product.sale_price)
    ? Math.round(((Number(product.original_price) - Number(product.sale_price)) / Number(product.original_price)) * 100)
    : 0;

  const handleWishlistClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleQuickViewClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) onQuickView(product);
  };

  const imageSrc = product.image_url || product.images?.[0]?.url || 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80';

  return (
    <article className={styles.card}>
      <Link to={`/products/${product.slug}`} className={styles.imageWrap}>
        <img
          src={imageSrc}
          alt={product.name}
          className={styles.image}
          loading="lazy"
        />

        <div className={styles.badges}>
          {product.is_purchasable && product.is_rentable && (
            <span className={`${styles.badge} ${styles.dualBadge}`}>BUY & RENT</span>
          )}
          {!product.is_purchasable && product.is_rentable && (
            <span className={`${styles.badge} ${styles.rentBadge}`}>RENT ONLY</span>
          )}
          {discountPercent > 0 && (
            <span className={`${styles.badge} ${styles.saleBadge}`}>{discountPercent}% OFF</span>
          )}
        </div>

        <button
          type="button"
          className={`${styles.wishlistBtn} ${wish ? styles.wishlistActive : ''}`}
          onClick={handleWishlistClick}
          aria-label={wish ? 'Remove from wishlist' : 'Save to wishlist'}
        >
          <Heart size={18} fill={wish ? '#b99a58' : 'none'} color={wish ? '#b99a58' : '#FFFFFF'} />
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
          {product.is_purchasable && product.sale_price && (
            <div className={styles.buyPrice}>
              <span className={styles.priceLabel}>Buy:</span>
              <span className={styles.price}>₹{Number(product.sale_price).toLocaleString('en-IN')}</span>
              {discountPercent > 0 && (
                <span className={styles.originalPrice}>₹{Number(product.original_price).toLocaleString('en-IN')}</span>
              )}
            </div>
          )}

          {product.is_rentable && product.rent_price_per_day && (
            <div className={styles.rentPrice}>
              <span className={styles.priceLabel}>Rent from:</span>
              <span className={styles.rentAmount}>₹{Number(product.rent_price_per_day).toLocaleString('en-IN')}</span>
              <span className={styles.rentUnit}>/day</span>
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

