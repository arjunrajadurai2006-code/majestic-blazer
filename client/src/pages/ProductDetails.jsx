import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Calendar, Shield, Sparkles, CheckCircle2, AlertCircle, Star, ArrowRight, Truck, ShoppingBag } from 'lucide-react';
import ProductCard from '../components/common/ProductCard';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useBackNavigation } from '../context/BackNavigationContext';
import styles from './ProductDetails.module.css';

export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, updateQuantity, items, addRentalToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { success, error: toastError } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState('buy'); // 'buy' | 'rent'
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  // Rental state
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const threeDaysLater = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(threeDaysLater);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availability, setAvailability] = useState(null);

  // Safe fallback to Shop or Rent collection
  useBackNavigation({
    fallback: product?.is_rentable && !product?.is_purchasable ? '/rent' : '/shop',
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
        if (!res.data?.is_purchasable && res.data?.is_rentable) {
          setActiveTab('rent');
        }
      } catch (err) {
        console.error('Failed to load product', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  // Check rental availability whenever dates or variant change
  useEffect(() => {
    if (activeTab === 'rent' && product && selectedVariantId && startDate && endDate) {
      async function checkAvail() {
        setCheckingAvail(true);
        try {
          const res = await api.get(
            `/rentals/check?productId=${product.id}&variantId=${selectedVariantId}&startDate=${startDate}&endDate=${endDate}`
          );
          setAvailability(res.data);
        } catch (err) {
          setAvailability({ available: false, message: err.message });
        } finally {
          setCheckingAvail(false);
        }
      }
      checkAvail();
    }
  }, [activeTab, product, selectedVariantId, startDate, endDate]);

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

  const handleAddBuyToCart = () => {
    if (!product?.is_purchasable) {
      toastError('This bespoke item is currently not available for purchase.');
      return;
    }
    if (!selectedVariant) {
      toastError('Please select a chest size to add to your bag.');
      return;
    }
    if (selectedVariant.stock_quantity <= 0) {
      toastError(`Size ${selectedVariant.size} is currently sold out.`);
      return;
    }
    addToCart(product, selectedVariant, buyQuantity);
    success(`Added "${product.name} (Size: ${selectedVariant.size})" to your bag.`);
  };

  const handleBuyNow = () => {
    if (isBuyingNow) return;

    if (!product?.is_purchasable) {
      toastError('This bespoke item is currently not available for purchase.');
      return;
    }

    if (!selectedVariant) {
      toastError('Please select a chest size before proceeding to checkout.');
      return;
    }

    if (selectedVariant.stock_quantity <= 0) {
      toastError(`Size ${selectedVariant.size} is currently sold out.`);
      return;
    }

    const availableStock = selectedVariant.stock_quantity || 10;
    const qtyToBuy = Math.max(1, Math.min(buyQuantity, availableStock));

    try {
      setIsBuyingNow(true);

      const cartKey = `buy_${product.id}_${selectedVariant.id}`;
      const existingItem = items?.find((i) => i.key === cartKey);

      if (existingItem) {
        updateQuantity(cartKey, qtyToBuy);
      } else {
        addToCart(product, selectedVariant, qtyToBuy);
      }

      success(`Proceeding to checkout with ${product.name} (Size: ${selectedVariant.size})`);
      navigate('/checkout');
    } catch (err) {
      console.error('Failed to initiate Buy Now checkout:', err);
      toastError('Unable to proceed to checkout. Please try again.');
      setIsBuyingNow(false);
    }
  };

  const handleAddRentalToCart = () => {
    if (!selectedVariant) {
      toastError('Please select a chest size to reserve a rental.');
      return;
    }
    if (!availability?.available) {
      toastError(availability?.message || 'Selected dates are unavailable for this size.');
      return;
    }
    addRentalToCart(product, selectedVariant, {
      startDate,
      endDate,
      rentalDays: availability.rentalDays,
      rentAmount: availability.rentAmount,
      depositAmount: availability.depositAmount,
    });
    success(`Rental reserved for "${product.name} (Size: ${selectedVariant.size})" for ${availability.rentalDays} days.`);
  };

  const handleRentNow = () => {
    if (isBuyingNow) return;

    if (!selectedVariant) {
      toastError('Please select a chest size before proceeding.');
      return;
    }

    if (!availability?.available) {
      toastError(availability?.message || 'Selected dates are unavailable for this size.');
      return;
    }

    try {
      setIsBuyingNow(true);
      addRentalToCart(product, selectedVariant, {
        startDate,
        endDate,
        rentalDays: availability.rentalDays,
        rentAmount: availability.rentAmount,
        depositAmount: availability.depositAmount,
      });

      success(`Proceeding to checkout with rental for ${product.name}`);
      navigate('/checkout');
    } catch (err) {
      console.error('Failed to initiate Rent Now checkout:', err);
      toastError('Unable to proceed to checkout. Please try again.');
      setIsBuyingNow(false);
    }
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
              alt={currentImage.alt_text || product.name}
              className={styles.mainImage}
            />
            {discountPercent > 0 && activeTab === 'buy' && (
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
                  <img src={img.url} alt={`View ${idx + 1}`} />
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

          {/* Acquisition Mode Switcher */}
          <div className={styles.modeTabs}>
            {product.is_purchasable && (
              <button
                type="button"
                className={`${styles.modeTab} ${activeTab === 'buy' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('buy')}
              >
                <span>BUY TO KEEP</span>
                <span className={styles.tabPrice}>₹{Number(product.sale_price).toLocaleString('en-IN')}</span>
              </button>
            )}

            {product.is_rentable && (
              <button
                type="button"
                className={`${styles.modeTab} ${activeTab === 'rent' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('rent')}
              >
                <span>RENT FOR OCCASION</span>
                <span className={styles.tabPrice}>From ₹{Number(product.rent_price_per_day).toLocaleString('en-IN')} / day</span>
              </button>
            )}
          </div>

          {/* Size Selection */}
          <div className={styles.sizeSection}>
            <div className={styles.sizeHeader}>
              <label>Select Chest Size (UK/IN):</label>
              <span className={styles.fitBadge}>{product.fit || 'Tailored Slim Fit'}</span>
            </div>
            <div className={styles.sizeGrid}>
              {product.variants?.map((v) => {
                const stock = activeTab === 'buy' ? v.stock_quantity : v.rental_stock_quantity;
                const isOutOfStock = stock <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isOutOfStock}
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

          {/* Mode Tab 1: Buy Options */}
          {activeTab === 'buy' && (
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
                  onClick={() => toggleWishlist(product)}
                  aria-label={wish ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                  aria-pressed={wish}
                  title={wish ? 'Saved in Wishlist' : 'Save to Wishlist'}
                >
                  <Heart size={20} fill={wish ? '#E53945' : 'none'} color={wish ? '#E53945' : '#111111'} />
                </button>
              </div>
            </div>
          )}

          {/* Mode Tab 2: Rent Options */}
          {activeTab === 'rent' && (
            <div className={styles.rentPanel}>
              <div className={styles.rentHeader}>
                <div>
                  <span className={styles.rentDaily}>₹{Number(product.rent_price_per_day).toLocaleString('en-IN')}</span>
                  <span className={styles.perDay}>per 24-hr day</span>
                </div>
                <div className={styles.depositBadge}>
                  <Shield size={14} />
                  <span>100% Refundable Deposit: ₹{Number(product.security_deposit).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Rental Date Pickers */}
              <div className={styles.datePickerGrid}>
                <div className={styles.dateField}>
                  <label>Rental Start Date</label>
                  <input
                    type="date"
                    min={tomorrow}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
                <div className={styles.dateField}>
                  <label>Return Date</label>
                  <input
                    type="date"
                    min={startDate || tomorrow}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={styles.dateInput}
                  />
                </div>
              </div>

              {/* Live Availability Calculation */}
              <div className={styles.availBox}>
                {checkingAvail ? (
                  <p className={styles.availChecking}>Verifying calendar availability in Coimbatore atelier...</p>
                ) : availability?.available ? (
                  <div className={styles.availSuccess}>
                    <div className={styles.availStatusRow}>
                      <CheckCircle2 size={18} className={styles.checkIcon} />
                      <strong>Reserved for {availability.rentalDays} Day(s)</strong>
                    </div>
                    <div className={styles.breakdown}>
                      <div className={styles.breakRow}>
                        <span>Rental Charge ({availability.rentalDays} Days @ ₹{availability.rentPricePerDay}/day):</span>
                        <strong>₹{availability.rentAmount.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className={styles.breakRow}>
                        <span>Refundable Security Deposit:</span>
                        <strong>₹{availability.depositAmount.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className={`${styles.breakRow} ${styles.breakTotal}`}>
                        <span>Total Due Today:</span>
                        <strong>₹{availability.totalAmount.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.availFail}>
                    <AlertCircle size={18} />
                    <span>{availability?.message || 'Selected dates are unavailable for this size.'}</span>
                  </div>
                )}
              </div>

              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.addCartBtn}
                  onClick={handleAddRentalToCart}
                  disabled={!availability?.available || checkingAvail || isBuyingNow}
                >
                  <Calendar size={17} />
                  <span>Reserve for Bag</span>
                </button>

                <button
                  type="button"
                  className={styles.buyNowBtn}
                  onClick={handleRentNow}
                  disabled={!availability?.available || checkingAvail || isBuyingNow}
                >
                  {isBuyingNow ? (
                    <>
                      <span className={styles.btnSpinner} />
                      <span>Securing Rental...</span>
                    </>
                  ) : (
                    <>
                      <span>Rent Now</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className={`${styles.wishBtn} ${wish ? styles.wishActive : ''}`}
                  onClick={() => toggleWishlist(product)}
                  aria-label={wish ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                  aria-pressed={wish}
                  title={wish ? 'Saved in Wishlist' : 'Save to Wishlist'}
                >
                  <Heart size={20} fill={wish ? '#E53945' : 'none'} color={wish ? '#E53945' : '#111111'} />
                </button>
              </div>
            </div>
          )}

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
