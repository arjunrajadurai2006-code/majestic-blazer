import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { X, Heart, ShoppingBag, Star, Check, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { savePendingGuestAction } from '../../services/guestAction';
import styles from './QuickViewModal.module.css';

export default function QuickViewModal({ productSummary, isOpen, onClose }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { success, error: toastError } = useToast();

  // Guard helper: redirect guests preserving intent
  const guardAction = (action, preserved) => {
    if (!user) {
      savePendingGuestAction({
        action: preserved.action,
        productId: preserved.productId,
        variantId: preserved.variantId,
        size: preserved.size,
        quantity: preserved.quantity,
        returnUrl: location.pathname + location.search,
      });
      onClose();
      navigate('/login', { state: { from: location.pathname + location.search, preserved } });
      return;
    }
    action();
  };

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
    if (!selectedVariant) { toastError('Please select a chest size before adding to cart.'); return; }
    if (selectedVariant.stock_quantity <= 0) { toastError('This size is currently out of stock.'); return; }
    guardAction(
      () => {
        const result = addToCart(currentProduct, selectedVariant, quantity);
        if (result?.updated) {
          success(`Updated quantity of "${currentProduct.name} (${selectedVariant.size})" to ${result.quantity} in your bespoke cart.`);
        } else {
          success(`Added ${currentProduct.name} (${selectedVariant.size}) to your bespoke cart.`);
        }
        onClose();
      },
      {
        action: 'addToCart',
        productId: currentProduct.id,
        variantId: selectedVariant.id,
        size: selectedVariant.size,
        quantity: Math.max(1, quantity),
      }
    );
  };

  const handleToggleWishlist = () => {
    guardAction(
      () => toggleWishlist(currentProduct),
      { action: 'wishlist', productId: currentProduct.id }
    );
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
                decoding="async"
              />
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
                    <img
                      src={img.url}
                      alt="Thumbnail preview"
                      loading="lazy"
                      decoding="async"
                      width="60"
                      height="75"
                    />
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
              <div className={styles.priceTabActive}>
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
                    const isOut = v.stock_quantity <= 0;
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
                  onClick={handleToggleWishlist}
                  aria-label={wish ? `Remove ${currentProduct.name} from wishlist` : `Save ${currentProduct.name} to wishlist`}
                  aria-pressed={wish}
                  title={wish ? 'Saved in Wishlist' : 'Save to Wishlist'}
                >
                  <Heart size={20} fill={wish ? '#E53945' : 'none'} color={wish ? '#E53945' : '#444444'} />
                </button>
              </div>
            </div>

            {/* Trust highlights */}
            <div className={styles.trustBadges}>
              <div className={styles.trustItem}>
                <ShieldCheck size={16} />
                <span>Complimentary Alterations</span>
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
