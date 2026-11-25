import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Shield, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Truck, ShoppingBag } from 'lucide-react';
import ProductCard from '../components/common/ProductCard';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useBackNavigation } from '../context/BackNavigationContext';
import { savePendingGuestAction } from '../services/guestAction';
import { getResponsiveWebpSrcSet } from '../utils/responsiveImage';
import { useDocumentSeo, SITE_URL, toAbsoluteUrl } from '../utils/seo';
import styles from './ProductDetails.module.css';

export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToCart, updateQuantity, items } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { success, error: toastError } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  // Safe fallback to Shop collection
  useBackNavigation({
    fallback: '/shop',
  });

  // Review submission state
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      try {
        const res = await api.get(`/products/${slug}`);
        setProduct(res.data);
        if (res.data?.variants?.length) {
          setSelectedVariantId(res.data.variants[0].id);
        }
      } catch (err) {
        console.error('Failed to load product', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [slug]);

  const activeVariant = product?.variants?.find((v) => v.id === selectedVariantId) || product?.variants?.[0];
  const hasStock = product?.variants?.some((v) => Number(v.stock_quantity) > 0);
  const seoImage = product?.images?.[0]?.url || product?.image_url;
  const seoDescription = product?.description
    ? product.description.replace(/\s+/g, ' ').trim().slice(0, 155)
    : 'Hand-canvassed luxury blazer crafted by Majestic Blazer in Coimbatore.';

  const productJsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Product',
            name: product.name,
            image: [toAbsoluteUrl(seoImage)],
            description: seoDescription,
            sku: activeVariant?.sku || undefined,
            brand: {
              '@type': 'Brand',
              name: 'Majestic Blazer',
            },
            offers: {
              '@type': 'Offer',
              url: `${SITE_URL}/products/${product.slug}`,
              priceCurrency: 'INR',
              price: Number(product.sale_price),
              availability: hasStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Blazers', item: `${SITE_URL}/shop` },
              { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_URL}/products/${product.slug}` },
            ],
          },
        ],
      }
    : null;

  useDocumentSeo({
    title: product ? `${product.name} | MAJESTIC BLAZER` : 'Tailored Blazer | MAJESTIC BLAZER',
    description: seoDescription,
    path: `/products/${slug}`,
    type: 'product',
    image: seoImage,
    noindex: !loading && !product,
    jsonLd: productJsonLd,
  });

  if (loading) {
    return (
      <div className={`container ${styles.loadingWrap}`}>
        <div className={styles.loadingPulse} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`container ${styles.notFound}`}>
        <h2>Product not found</h2>
        <Link to="/shop">← Return to Collection</Link>
      </div>
    );
  }

  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId) || product.variants?.[0];
  const wish = isWishlisted(product.id);
  const images = product.images?.length ? product.images : [{ url: product.image_url || '/assets/products/imperial-navy-velvet-front.webp', altText: product.name }];
  const currentImage = images[selectedImage] || images[0];

  const discountPercent = product.original_price && Number(product.original_price) > Number(product.sale_price)
    ? Math.round(((Number(product.original_price) - Number(product.sale_price)) / Number(product.original_price)) * 100)
    : 0;

  // Helper: redirect guests to login preserving intent
  const guardAction = (action, preserved) => {
    if (!user) {
      savePendingGuestAction({
        action: preserved.action,
        productId: preserved.productId,
        variantId: preserved.variantId,
        size: preserved.size || selectedVariant?.size,
        quantity: preserved.quantity || 1,
        returnUrl: location.pathname + location.search,
      });
      navigate('/login', { state: { from: location.pathname + location.search, preserved } });
      return;
    }
    action();
  };

  const handleAddBuyToCart = () => {
    if (!product?.is_purchasable) { toastError('This bespoke item is currently not available for purchase.'); return; }
    if (!selectedVariant) { toastError('Please select a chest size to add to your bag.'); return; }
    if (selectedVariant.stock_quantity <= 0) { toastError(`Size ${selectedVariant.size} is currently sold out.`); return; }
    guardAction(
      () => {
        const result = addToCart(product, selectedVariant, buyQuantity);
        if (result?.updated) {
          success(`Updated quantity of "${product.name} (Size: ${selectedVariant.size})" to ${result.quantity} in your bag.`);
        } else {
          success(`Added "${product.name} (Size: ${selectedVariant.size})" to your bag.`);
        }
      },
      { action: 'addToCart', productId: product.id, variantId: selectedVariant.id, quantity: buyQuantity }
    );
  };

  const handleBuyNow = () => {
    if (isBuyingNow) return;
    if (!product?.is_purchasable) { toastError('This bespoke item is currently not available for purchase.'); return; }
    if (!selectedVariant) { toastError('Please select a chest size before proceeding to checkout.'); return; }
    if (selectedVariant.stock_quantity <= 0) { toastError(`Size ${selectedVariant.size} is currently sold out.`); return; }
    guardAction(
      () => {
        const availableStock = selectedVariant.stock_quantity || 10;
        const qtyToBuy = Math.max(1, Math.min(buyQuantity, availableStock));
        const cartKey = `buy_${product.id}_${selectedVariant.id}`;
        const existingItem = items?.find((i) => i.key === cartKey);
        try {
          setIsBuyingNow(true);
          if (existingItem) { updateQuantity(cartKey, qtyToBuy); } else { addToCart(product, selectedVariant, qtyToBuy); }
          success(`Proceeding to checkout with ${product.name} (Size: ${selectedVariant.size})`);
          navigate('/checkout');
        } catch (err) {
          console.error('Failed to initiate Buy Now checkout:', err);
          toastError('Unable to proceed to checkout. Please try again.');
          setIsBuyingNow(false);
        }
      },
      { action: 'buyNow', productId: product.id, variantId: selectedVariant.id, quantity: buyQuantity }
    );
  };

  const handleToggleWishlist = () => {
    guardAction(
      () => toggleWishlist(product),
      { action: 'toggleWishlist', productId: product.id }
    );
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await api.post('/reviews', {
        productId: product.id,
        rating,
        title: reviewTitle,
        comment: reviewComment,
      });
      success('Thank you. Your patron review has been recorded.');
      setReviewTitle('');
      setReviewComment('');
      // refresh product to show new review
      const updated = await api.get(`/products/${slug}`);
      setProduct(updated.data);
    } catch (err) {
      toastError(err.message || 'Please sign in to submit a review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className={styles.detailsPage}>
      {/* Breadcrumbs */}
      <div className={`container ${styles.breadcrumbs}`}>
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/shop">Blazers</Link>
        <span>/</span>
        <Link to={`/shop?category=${product.category_slug}`}>{product.category_name}</Link>
        <span>/</span>
        <span className={styles.crumbActive}>{product.name}</span>
      </div>

      <div className={`container ${styles.grid}`}>
        {/* Left: Gallery */}
        <div className={styles.gallery}>
          <div className={styles.mainImageWrap}>
            <img
              src={currentImage.url}
              srcSet={getResponsiveWebpSrcSet(currentImage.url)}
              sizes={getResponsiveWebpSrcSet(currentImage.url) ? '(max-width: 768px) 92vw, 560px' : undefined}
              alt={currentImage.alt_text || product.name}
              className={styles.mainImage}
              width="600"
              height="800"
              fetchpriority="high"
              decoding="sync"
            />
            {discountPercent > 0 && (
              <span className={styles.saleBadge}>{discountPercent}% OFF</span>
            )}
          </div>

          {images.length > 1 && (
            <div className={styles.thumbList}>
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  className={`${styles.thumbBtn} ${selectedImage === idx ? styles.thumbActive : ''}`}
                  onClick={() => setSelectedImage(idx)}
                >
                  <img
                    src={img.url}
                    alt={`View ${idx + 1}`}
                    loading="lazy"
                    decoding="async"
                    width="72"
                    height="90"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info & Actions */}
        <div className={styles.info}>
          <div className={styles.metaTop}>
            <span className={styles.categoryName}>{product.category_name}</span>
            <div className={styles.ratingStars}>
              <span className={styles.stars}>★★★★★</span>
              <span className={styles.ratingNum}>({product.reviews_count || 1} verified reviews)</span>
            </div>
          </div>

          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.sku}>SKU: {selectedVariant?.sku || 'MB-BESPOKE'}</p>

          {/* Size Selection */}
          <div className={styles.sizeSection}>
            <div className={styles.sizeHeader}>
              <label>Select Chest Size (UK/IN):</label>
              <span className={styles.fitBadge}>{product.fit || 'Tailored Slim Fit'}</span>
            </div>
            <div className={styles.sizeGrid}>
              {product.variants?.map((v) => {
                const stock = v.stock_quantity;
                const isOutOfStock = stock <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isOutOfStock}
                    aria-pressed={selectedVariantId === v.id}
                    className={`${styles.sizeBtn} ${selectedVariantId === v.id ? styles.sizeSelected : ''}`}
                    onClick={() => setSelectedVariantId(v.id)}
                  >
                    <span>{v.size}</span>
                    <span className={styles.stockNote}>
                      {isOutOfStock ? 'Sold Out' : stock < 3 ? `Only ${stock} left` : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buy Options Panel */}
          <div className={styles.buyPanel}>
            <div className={styles.priceRow}>
              <span className={styles.currentPrice}>₹{Number(product.sale_price).toLocaleString('en-IN')}</span>
              {discountPercent > 0 && (
                <span className={styles.originalPrice}>₹{Number(product.original_price).toLocaleString('en-IN')}</span>
              )}
              <span className={styles.taxNote}>Inclusive of all applicable taxes</span>
            </div>

            <div className={styles.actionRow}>
              <div className={styles.qtyPicker}>
                <button
                  type="button"
                  onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                  disabled={buyQuantity <= 1 || isBuyingNow}
                  aria-label="Decrease quantity"
                >
                  –
                </button>
                <span>{buyQuantity}</span>
                <button
                  type="button"
                  onClick={() => setBuyQuantity((q) => Math.min(selectedVariant?.stock_quantity || 10, q + 1))}
                  disabled={buyQuantity >= (selectedVariant?.stock_quantity || 10) || isBuyingNow}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className={styles.addCartBtn}
                onClick={handleAddBuyToCart}
                disabled={!selectedVariant || selectedVariant.stock_quantity <= 0 || isBuyingNow}
              >
                <ShoppingBag size={17} />
                <span>Add to Bag</span>
              </button>

              <button
                type="button"
                className={styles.buyNowBtn}
                onClick={handleBuyNow}
                disabled={!selectedVariant || selectedVariant.stock_quantity <= 0 || isBuyingNow}
              >
                {isBuyingNow ? (
                  <>
                    <span className={styles.btnSpinner} />
                    <span>Securing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Buy Now</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <button
                type="button"
                className={`${styles.wishBtn} ${wish ? styles.wishActive : ''}`}
                onClick={handleToggleWishlist}
                aria-label={wish ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                aria-pressed={wish}
                title={wish ? 'Saved in Wishlist' : 'Save to Wishlist'}
              >
                <Heart size={20} fill={wish ? '#E53945' : 'none'} color={wish ? '#E53945' : '#111111'} />
              </button>
            </div>
          </div>

          {/* Luxury Guarantees */}
          <div className={styles.perks}>
            <div className={styles.perk}>
              <Truck size={16} />
              <span>Complimentary insured courier or in-store collection at Kurumbampalayam, Coimbatore</span>
            </div>
            <div className={styles.perk}>
              <Sparkles size={16} />
              <span>Professional dry cleaning and lint-free garment bag included with every piece</span>
            </div>
          </div>

          {/* Accordion Specs */}
          <div className={styles.specs}>
            <div className={styles.specGroup}>
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>

            <div className={styles.specGroup}>
              <h3>Cloth & Fit</h3>
              <p><strong>Material:</strong> {product.material}</p>
              <p><strong>Color:</strong> {product.color}</p>
              <p><strong>Silhouette:</strong> {product.fit}</p>
            </div>

            <div className={styles.specGroup}>
              <h3>Care Instructions</h3>
              <p>{product.care_instructions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <section className={`container ${styles.reviewsSection}`}>
        <div className={styles.reviewsHeader}>
          <h2>Patron Reviews ({product.reviews?.length || 0})</h2>
        </div>

        <div className={styles.reviewsGrid}>
          {/* Reviews List */}
          <div className={styles.reviewsList}>
            {product.reviews?.length ? (
              product.reviews.map((rev) => (
                <div key={rev.id} className={styles.reviewItem}>
                  <div className={styles.revTop}>
                    <span className={styles.stars}>{'★'.repeat(rev.rating)}</span>
                    <span className={styles.revDate}>{new Date(rev.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  {rev.title && <h4 className={styles.revTitle}>{rev.title}</h4>}
                  <p className={styles.revComment}>{rev.comment}</p>
                  <span className={styles.revAuthor}>Verified Patron: {rev.user_name}</span>
                </div>
              ))
            ) : (
              <p className={styles.noReviews}>Be the first distinguished gentleman to review this blazer.</p>
            )}
          </div>

          {/* Review Form */}
          <div className={styles.reviewFormWrap}>
            <h3>Leave a Review</h3>
            <form onSubmit={handleReviewSubmit} className={styles.reviewForm}>
              <div className={styles.formGroup}>
                <label>Rating</label>
                <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                  <option value={5}>5 Stars — Masterpiece</option>
                  <option value={4}>4 Stars — Exceptional</option>
                  <option value={3}>3 Stars — Good</option>
                  <option value={2}>2 Stars — Fair</option>
                  <option value={1}>1 Star — Disappointing</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Title</label>
                <input
                  type="text"
                  placeholder="e.g. Stole the evening at our gala"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Your Review</label>
                <textarea
                  rows={4}
                  placeholder="Describe the fit, shoulder construction, fabric drape and occasion..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={submittingReview} className={styles.submitRevBtn}>
                {submittingReview ? 'Recording...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Related Products */}
      {product.related?.length > 0 && (
        <section className={`container ${styles.relatedSection}`}>
          <div className={styles.relatedHeader}>
            <span className={styles.eyebrow}>COMPLEMENTARY PIECES</span>
            <h2>You May Also Admire</h2>
          </div>
          <div className={styles.relatedGrid}>
            {product.related.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
