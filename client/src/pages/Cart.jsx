import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, Shield, Tag, Check, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import styles from './Cart.module.css';

export default function Cart() {
  const {
    items,
    buySubtotal,
    rentSubtotal,
    depositSubtotal,
    cartTotal,
    discount,
    deliveryFee,
    totalPayable,
    appliedCoupon,
    updateQuantity,
    removeFromCart,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [applying, setApplying] = useState(false);
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setApplying(true);
    try {
      const res = await applyCoupon(couponCode.trim());
      success(`Coupon ${res.code} applied: ₹${res.discountAmount} savings!`);
      setCouponCode('');
    } catch (err) {
      toastError(err.message || 'Invalid coupon code');
    } finally {
      setApplying(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className={`container ${styles.emptyPage}`}>
        <div className={styles.emptyCard}>
          <ShoppingBag size={48} className={styles.emptyIcon} />
          <h2>Your Sartorial Bag is Empty</h2>
          <p>Explore our master-tailored blazers for purchase with complimentary bespoke alterations.</p>
          <div className={styles.emptyBtns}>
            <Link to="/shop" className={styles.exploreBtn}>Shop Blazers</Link>
          </div>
        </div>
      </div>
    );
  }

  const buyItems = items;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <h1>Your Sartorial Bag ({items.length} {items.length === 1 ? 'Piece' : 'Pieces'})</h1>
        <Link to="/shop" className={styles.continueLink}>← Continue Shopping</Link>
      </div>

      <div className={styles.layout}>
        {/* Left: Items list */}
        <div className={styles.itemsList}>
          {/* Buy Items Section */}
          {buyItems.length > 0 && (
            <div className={styles.sectionBlock}>
              <h2 className={styles.sectionTitle}>Blazers for Purchase ({buyItems.length})</h2>
              <div className={styles.itemsGroup}>
                {buyItems.map((item) => (
                  <div key={item.key} className={styles.itemRow}>
                    <img src={item.imageUrl} alt={item.name} className={styles.itemImg} loading="lazy" decoding="async" width="80" height="100" />
                    <div className={styles.itemDetails}>
                      <Link to={`/products/${item.slug}`} className={styles.itemName}>{item.name}</Link>
                      <div className={styles.itemMeta}>
                        <span>Size: <strong>{item.size}</strong></span>
                        {item.color && <span>Color: {item.color}</span>}
                        <span>SKU: {item.sku}</span>
                      </div>
                      <span className={styles.itemPrice}>₹{Number(item.price).toLocaleString('en-IN')}</span>
                    </div>

                    <div className={styles.qtyControls}>
                      <div className={styles.stepper}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          –
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                        >
                          +
                        </button>
                      </div>
                      <span className={styles.lineTotal}>
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeFromCart(item.key)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Summary & Checkout */}
        <aside className={styles.summaryWrap}>
          <div className={styles.summaryCard}>
            <h3>Order Summary</h3>

            {/* Coupon Box */}
            <div className={styles.couponBox}>
              {appliedCoupon ? (
                <div className={styles.couponApplied}>
                  <div className={styles.couponInfo}>
                    <Tag size={16} className={styles.tagIcon} />
                    <div>
                      <strong>{appliedCoupon.code}</strong>
                      <span>Saved ₹{discount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <button type="button" onClick={removeCoupon} className={styles.removeCouponBtn}>
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className={styles.couponForm}>
                  <input
                    type="text"
                    placeholder="Promo code (e.g. MAJESTIC10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className={styles.couponInput}
                  />
                  <button type="submit" disabled={applying} className={styles.couponBtn}>
                    {applying ? 'Applying...' : 'Apply'}
                  </button>
                </form>
              )}
            </div>

            {/* Line items */}
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span>Purchase Subtotal</span>
                <span>₹{buySubtotal.toLocaleString('en-IN')}</span>
              </div>

              {discount > 0 && (
                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                  <span>Promotional Savings</span>
                  <span>–₹{discount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className={styles.summaryRow}>
                <span>Insured Courier</span>
                <span className={styles.freeDelivery}>Complimentary</span>
              </div>

              <div className={styles.totalDivider} />

              <div className={styles.totalRow}>
                <span>Total Payable Today</span>
                <span className={styles.totalAmount}>₹{totalPayable.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <button
              type="button"
              className={styles.checkoutBtn}
              onClick={() => navigate('/checkout')}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </button>

            <div className={styles.assurances}>
              <div className={styles.assurance}>
                <Shield size={14} />
                <span>Encrypted 256-bit checkout with Razorpay / UPI</span>
              </div>
              <div className={styles.assurance}>
                <Check size={14} />
                <span>Instant tax invoice PDF generated on completion</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
