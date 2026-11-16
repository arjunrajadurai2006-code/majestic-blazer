import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Heart, ShoppingBag, Calendar, Star, Check, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import styles from './QuickViewModal.module.css';

export default function QuickViewModal({ productSummary, isOpen, onClose }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState('buy'); // 'buy' | 'rent'

  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { success, error: toastError } = useToast();

  useEffect(() => {
    if (!isOpen || !productSummary) {
      setProduct(null);
      setSelectedVariant(null);
      setSelectedImage(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api.get(`/products/${productSummary.slug}`)
      .then((res) => {
        if (!isMounted) return;
        const data = res.data;
        setProduct(data);
        if (data.images && data.images.length > 0) {
          setSelectedImage(data.images[0].url);
        } else {
          setSelectedImage(data.image_url || productSummary.image_url);
        }
        if (data.variants && data.variants.length > 0) {
          const available = data.variants.find((v) => v.stock_quantity > 0) || data.variants[0];
          setSelectedVariant(available);
        }
        setMode(data.is_purchasable ? 'buy' : 'rent');
      })
      .catch((err) => {
        console.error('Failed to load full product for quick view', err);
        if (isMounted) setProduct(productSummary);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, productSummary, onClose]);

  if (!isOpen || !productSummary) return null;

  const currentProduct = product || productSummary;
  const wish = isWishlisted(currentProduct.id);

  const handleAddToCart = () => {
    if (!selectedVariant) {
      toastError('Please select a chest size before adding to cart.');
      return;
    }
    if (mode === 'buy') {
      if (selectedVariant.stock_quantity <= 0) {
        toastError('This size is currently out of stock.');
        return;
      }
      addToCart(currentProduct, selectedVariant, quantity);
      success(`Added ${currentProduct.name} (${selectedVariant.size}) to your bespoke cart.`);
      onClose();
    }
  };

  const images = currentProduct.images && currentProduct.images.length > 0
    ? currentProduct.images
    : [{ id: 'primary', url: currentProduct.image_url || '/assets/products/imperial-navy-velvet-front.webp' }];

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className={styles.body}>
          {/* Gallery / Image Column */}
          <div className={styles.galleryCol}>
            <div className={styles.mainImageWrap}>
              <img
                src={selectedImage || currentProduct.image_url || images[0]?.url}
                alt={currentProduct.name}
                className={styles.mainImage}
              />
              <div className={styles.badges}>
                {currentProduct.is_purchasable && currentProduct.is_rentable && (
                  <span className={styles.badge}>BUY & RENT</span>
                )}
                {!currentProduct.is_purchasable && currentProduct.is_rentable && (
                  <span className={styles.badge}>RENT ONLY</span>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className={styles.thumbRow}>
                {images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    className={`${styles.thumbBtn} ${selectedImage === img.url ? styles.thumbActive : ''}`}
                    onClick={() => setSelectedImage(img.url)}
                  >
                    <img src={img.url} alt="Thumbnail preview" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details / Purchasing Column */}
          <div className={styles.detailsCol}>
            <div className={styles.headerInfo}>
              <span className={styles.category}>{currentProduct.category_name || 'Tailored Menswear'}</span>
              <h2 className={styles.title}>{currentProduct.name}</h2>

              <div className={styles.ratingRow}>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      fill={i <= Math.round(Number(currentProduct.avg_rating || 5)) ? '#C0C0C0' : 'none'}
                      color="#C0C0C0"
                    />
                  ))}
                </div>
                <span className={styles.ratingVal}>
                  {Number(currentProduct.avg_rating || 5.0).toFixed(1)} ({currentProduct.reviews_count || 12} reviews)
                </span>
              </div>
            </div>

            {/* Price Box */}
            <div className={styles.pricingBox}>
              {currentProduct.is_purchasable && (
                <div
                  className={`${styles.priceTab} ${mode === 'buy' ? styles.priceTabActive : ''}`}
                  onClick={() => setMode('buy')}
                >
                  <span className={styles.tabLabel}>PURCHASE PRICE</span>
                  <div className={styles.priceRow}>
                    <span className={styles.currency}>₹</span>
                    <span className={styles.priceValue}>
                      {Number(currentProduct.sale_price).toLocaleString('en-IN')}
                    </span>
                    {currentProduct.original_price && Number(currentProduct.original_price) > Number(currentProduct.sale_price) && (
                      <span className={styles.origPrice}>
                        ₹{Number(currentProduct.original_price).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {currentProduct.is_rentable && (
                <div
                  className={`${styles.priceTab} ${mode === 'rent' ? styles.priceTabActive : ''}`}
                  onClick={() => setMode('rent')}
                >
                  <span className={styles.tabLabel}>OCCASION RENTAL</span>
                  <div className={styles.priceRow}>
                    <span className={styles.currency}>₹</span>
                    <span className={styles.priceValue}>
                      {Number(currentProduct.rent_price_per_day).toLocaleString('en-IN')}
                    </span>
                    <span className={styles.dayUnit}>/ day</span>
                  </div>
                </div>
              )}
            </div>

            <p className={styles.description}>
              {currentProduct.description ? currentProduct.description.slice(0, 180) + '...' : 'Handcrafted with bespoke canvas construction, horn buttons, and breathable silk-blend interior lining.'}
            </p>

            {/* Sizing Section */}
            {currentProduct.variants && currentProduct.variants.length > 0 && (
              <div className={styles.sizeSection}>
                <div className={styles.sizeHeader}>
                  <span>Select Chest Size:</span>
                  {selectedVariant && (
                    <span className={styles.stockNote}>
                      {selectedVariant.stock_quantity > 0 ? (
                        <span className={styles.inStock}><Check size={12} /> In Atelier Stock</span>
                      ) : (
                        <span className={styles.outStock}>Awaiting Tailoring</span>
                      )}
                    </span>
                  )}
                </div>

                <div className={styles.sizeGrid}>
                  {currentProduct.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const isOut = mode === 'buy' ? v.stock_quantity <= 0 : v.rental_stock_quantity <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isOut}
                        className={`${styles.sizeBtn} ${isSelected ? styles.sizeActive : ''} ${isOut ? styles.sizeDisabled : ''}`}
                        onClick={() => setSelectedVariant(v)}
                      >
                        {v.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={styles.actionSection}>
              {mode === 'buy' ? (
                <div className={styles.btnRow}>
                  <div className={styles.qtyBox}>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >
                      -
                    </button>
                    <span>{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(selectedVariant?.stock_quantity || 10, q + 1))}
                      disabled={quantity >= (selectedVariant?.stock_quantity || 10)}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.addCartBtn}
                    onClick={handleAddToCart}
                    disabled={!selectedVariant || selectedVariant.stock_quantity <= 0}
                  >
                    <ShoppingBag size={18} />
                    <span>Add to Wardrobe</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.wishlistBtn} ${wish ? styles.wishActive : ''}`}
                    onClick={() => toggleWishlist(currentProduct)}
                    aria-label="Toggle wishlist"
                  >
                    <Heart size={20} fill={wish ? '#FFFFFF' : 'none'} color={wish ? '#FFFFFF' : '#C0C0C0'} />
                  </button>
                </div>
              ) : (
                <div className={styles.rentDirectWrap}>
                  <Link
                    to={`/products/${currentProduct.slug}`}
                    className={styles.rentDirectBtn}
                    onClick={onClose}
                  >
                    <Calendar size={18} />
                    <span>Configure Rental Dates & Fitting</span>
                  </Link>

                  <button
                    type="button"
                    className={`${styles.wishlistBtn} ${wish ? styles.wishActive : ''}`}
                    onClick={() => toggleWishlist(currentProduct)}
                    aria-label="Toggle wishlist"
                  >
                    <Heart size={20} fill={wish ? '#FFFFFF' : 'none'} color={wish ? '#FFFFFF' : '#C0C0C0'} />
                  </button>
                </div>
              )}
            </div>

            {/* Trust highlights */}
            <div className={styles.trustBadges}>
              <div className={styles.trustItem}>
                <ShieldCheck size={16} />
                <span>Dry Cleaning Included</span>
              </div>
              <div className={styles.trustItem}>
                <Truck size={16} />
                <span>Coimbatore Atelier Pickup or Express Delivery</span>
              </div>
            </div>

            {/* Full Product Page Link */}
            <div className={styles.fullLinkWrap}>
              <Link
                to={`/products/${currentProduct.slug}`}
                className={styles.fullLink}
                onClick={onClose}
              >
                <span>View Complete Sartorial Specifications & Fabric Guide</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
