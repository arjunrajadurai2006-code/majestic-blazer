import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, CheckCircle2, Truck, MapPin, CreditCard, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useBackNavigation } from '../context/BackNavigationContext';
import { api } from '../services/api';
import DownloadInvoiceButton from '../components/common/DownloadInvoiceButton';
import styles from './Checkout.module.css';

export default function Checkout() {
  const { user } = useAuth();
  const { items, buySubtotal, rentSubtotal, depositSubtotal, discount, totalPayable, clearCart } = useCart();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Delivery & Address, 2: Payment, 3: Confirmation
  const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' | 'pickup'
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  // New address form
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('Coimbatore');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('641107');
  const [orderNotes, setOrderNotes] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'razorpay' | 'cod'
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState([]);
  const [confirmedRentals, setConfirmedRentals] = useState([]);

  // Dynamic Back navigation handling
  useBackNavigation({
    fallback: step === 3 ? '/orders' : '/cart',
    customHandler: step === 2 ? () => setStep(1) : null,
    label: step === 2 ? 'Back to Address' : 'Back',
  });

  // Load user saved addresses
  useEffect(() => {
    if (user) {
      api.get('/auth/addresses').then((res) => {
        setAddresses(res.data || []);
        const def = (res.data || []).find((a) => a.is_default);
        if (def) setSelectedAddressId(def.id);
        else if (res.data?.length) setSelectedAddressId(res.data[0].id);
      }).catch(() => {});
    }
  }, [user]);

  if (items.length === 0 && step !== 3) {
    return (
      <div className={`container ${styles.emptyPage}`}>
        <h2>Your bag is empty</h2>
        <Link to="/shop">Explore Blazers</Link>
      </div>
    );
  }

  const buyItems = items.filter((i) => i.type === 'buy');
  const rentalItems = items.filter((i) => i.type === 'rental');

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      let finalAddressId = selectedAddressId;

      // If user typed in an address and didn't select an existing one
      if (deliveryType === 'delivery' && !finalAddressId && line1.trim()) {
        const addrRes = await api.post('/auth/addresses', {
          line1,
          line2,
          city,
          state,
          pincode,
          isDefault: false,
        });
        finalAddressId = addrRes.data.id;
      }

      const orderResults = [];
      const rentalResults = [];

      // 1. Process purchase order if buy items exist
      if (buyItems.length > 0) {
        const orderPayload = {
          items: buyItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          addressId: deliveryType === 'delivery' ? finalAddressId : null,
          deliveryType,
          discount: rentalItems.length === 0 ? discount : 0, // apply discount to order
          shipping: 0,
          notes: orderNotes || null,
        };
        const orderRes = await api.post('/orders', orderPayload);
        orderResults.push(orderRes.data);

        // Record payment for order
        await api.post('/payments/verify', {
          orderId: orderRes.data.id,
          razorpayOrderId: `mb_pay_${Date.now()}`,
          razorpayPaymentId: `pay_${Date.now()}`,
          razorpaySignature: 'simulated_signature_secure',
          amount: orderRes.data.total,
          provider: paymentMethod === 'razorpay' ? 'razorpay' : 'manual',
        });
      }

      // 2. Process rental bookings if rental items exist
      if (rentalItems.length > 0) {
        for (const r of rentalItems) {
          const rentalPayload = {
            productId: r.productId,
            variantId: r.variantId,
            startDate: r.startDate,
            endDate: r.endDate,
            deliveryType,
            shippingAddress: deliveryType === 'delivery'
              ? (addresses.find((a) => a.id === finalAddressId) ? `${addresses.find((a) => a.id === finalAddressId).line1}, ${city} - ${pincode}` : `${line1}, ${city} - ${pincode}`)
              : 'Store Pickup (Kurumbampalayam, Coimbatore)',
            notes: orderNotes || null,
          };
          const rentRes = await api.post('/rentals', rentalPayload);
          rentalResults.push(rentRes.data);

          // Record payment for rental booking
          await api.post('/payments/verify', {
            rentalBookingId: rentRes.data.id,
            razorpayOrderId: `mb_rentpay_${Date.now()}`,
            razorpayPaymentId: `pay_rnt_${Date.now()}`,
            razorpaySignature: 'simulated_signature_secure',
            amount: Number(r.rentAmount) + Number(r.depositAmount),
            provider: paymentMethod === 'razorpay' ? 'razorpay' : 'manual',
          });
        }
      }

      setConfirmedOrders(orderResults);
      setConfirmedRentals(rentalResults);
      clearCart();
      setStep(3); // confirmation step
      success('Order & rental reservations placed successfully!');
    } catch (err) {
      toastError(err.message || 'Payment or order processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`container ${styles.checkoutPage}`}>
      {/* Step Indicator */}
      <div className={styles.stepperBar}>
        <div className={`${styles.stepIndicator} ${step >= 1 ? styles.stepActive : ''}`}>
          <span className={styles.stepNum}>1</span>
          <span>Delivery & Address</span>
        </div>
        <div className={styles.stepConnector} />
        <div className={`${styles.stepIndicator} ${step >= 2 ? styles.stepActive : ''}`}>
          <span className={styles.stepNum}>2</span>
          <span>Payment & Review</span>
        </div>
        <div className={styles.stepConnector} />
        <div className={`${styles.stepIndicator} ${step >= 3 ? styles.stepActive : ''}`}>
          <span className={styles.stepNum}>3</span>
          <span>Confirmation</span>
        </div>
      </div>

      {/* Step 1: Delivery & Address */}
      {step === 1 && (
        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <h2>Delivery & Collection Preference</h2>

            {/* Delivery Method Options */}
            <div className={styles.deliverySelector}>
              <button
                type="button"
                className={`${styles.methodBtn} ${deliveryType === 'delivery' ? styles.methodActive : ''}`}
                onClick={() => setDeliveryType('delivery')}
              >
                <Truck size={22} className={styles.methodIcon} />
                <div>
                  <strong>Insured Luxury Courier Delivery</strong>
                  <span>Direct to your doorstep across India • Complimentary</span>
                </div>
              </button>

              <button
                type="button"
                className={`${styles.methodBtn} ${deliveryType === 'pickup' ? styles.methodActive : ''}`}
                onClick={() => setDeliveryType('pickup')}
              >
                <MapPin size={22} className={styles.methodIcon} />
                <div>
                  <strong>Flagship Boutique Collection</strong>
                  <span>Sathy Road, Kurumbampalayam, Coimbatore • Try-on & steam ready</span>
                </div>
              </button>
            </div>

            {deliveryType === 'delivery' && (
              <div className={styles.addressFormBlock}>
                <h3>Shipping Address</h3>

                {addresses.length > 0 && (
                  <div className={styles.savedAddresses}>
                    <label>Select Saved Address:</label>
                    <div className={styles.addressRadioList}>
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`${styles.addressRadioCard} ${selectedAddressId === addr.id ? styles.addrSelected : ''}`}
                        >
                          <input
                            type="radio"
                            name="savedAddr"
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                          />
                          <div>
                            <strong>{addr.line1}</strong>
                            {addr.line2 && <span>{addr.line2}</span>}
                            <span>{addr.city}, {addr.state} - {addr.pincode}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(!selectedAddressId || addresses.length === 0) && (
                  <div className={styles.manualAddress}>
                    <h4>Enter Delivery Address</h4>
                    <div className={styles.formRow}>
                      <label>Address Line 1</label>
                      <input
                        type="text"
                        placeholder="House / Flat / Street address"
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formRow}>
                      <label>Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        placeholder="Apartment, suite, landmark"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                      />
                    </div>
                    <div className={styles.formGrid3}>
                      <div>
                        <label>City</label>
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
                      </div>
                      <div>
                        <label>State</label>
                        <input type="text" value={state} onChange={(e) => setState(e.target.value)} required />
                      </div>
                      <div>
                        <label>Pincode</label>
                        <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {deliveryType === 'pickup' && (
              <div className={styles.pickupCard}>
                <h3>Atelier Pickup Details</h3>
                <p>
                  Your tailored blazers will be freshly pressed, inspected and kept ready inside a
                  protective suit bag at our flagship Coimbatore store.
                </p>
                <address className={styles.pickupAddress}>
                  <strong>Majestic Blazer Flagship</strong>
                  <span>Sathy Road, Kurumbampalayam, Coimbatore - 641107</span>
                  <span>Phone: +91 8903238882</span>
                  <span>Collection Hours: Mon – Sun, 10:00 AM – 8:30 PM</span>
                </address>
              </div>
            )}

            <div className={styles.notesBlock}>
              <label>Special Instructions / Fitting Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="e.g. Please leave with concierge or deliver before 5 PM"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>

            <div className={styles.stepActionRow}>
              <button
                type="button"
                className={styles.nextBtn}
                onClick={() => setStep(2)}
              >
                <span>Continue to Payment</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Right Summary Sidebar */}
          <aside className={styles.rightCol}>
            <div className={styles.miniSummary}>
              <h3>Bag Overview ({items.length} items)</h3>
              <div className={styles.miniList}>
                {items.map((i) => (
                  <div key={i.key} className={styles.miniItem}>
                    <img src={i.imageUrl} alt={i.name} className={styles.miniImg} />
                    <div>
                      <strong>{i.name}</strong>
                      <span>Size: {i.size} • {i.type === 'rental' ? `${i.rentalDays} Days Rental` : `Qty: ${i.quantity}`}</span>
                      <span className={styles.miniPrice}>
                        ₹{((i.type === 'rental' ? i.rentAmount + i.depositAmount : i.price * i.quantity)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.miniTotals}>
                <div className={styles.miniRow}>
                  <span>Payable Total:</span>
                  <strong>₹{totalPayable.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Step 2: Payment & Review */}
      {step === 2 && (
        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <h2>Select Payment Method</h2>

            <div className={styles.paymentMethods}>
              <label className={`${styles.paymentCard} ${paymentMethod === 'razorpay' ? styles.paySelected : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'razorpay'}
                  onChange={() => setPaymentMethod('razorpay')}
                />
                <CreditCard size={24} className={styles.payIcon} />
                <div>
                  <strong>Razorpay Secure Online Payment</strong>
                  <span>Instant UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking</span>
                </div>
              </label>

              <label className={`${styles.paymentCard} ${paymentMethod === 'cod' ? styles.paySelected : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <Shield size={24} className={styles.payIcon} />
                <div>
                  <strong>{deliveryType === 'pickup' ? 'Pay at Boutique Collection' : 'Cash on Delivery (COD)'}</strong>
                  <span>Pay upon physical receipt or in-store fitting</span>
                </div>
              </label>
            </div>

            <div className={styles.reviewBlock}>
              <h3>Review Your Order Breakdown</h3>
              <div className={styles.reviewTable}>
                {buySubtotal > 0 && (
                  <div className={styles.reviewRow}>
                    <span>Purchase Items Subtotal:</span>
                    <strong>₹{buySubtotal.toLocaleString('en-IN')}</strong>
                  </div>
                )}
                {rentSubtotal > 0 && (
                  <div className={styles.reviewRow}>
                    <span>Rental Charges:</span>
                    <strong>₹{rentSubtotal.toLocaleString('en-IN')}</strong>
                  </div>
                )}
                {discount > 0 && (
                  <div className={`${styles.reviewRow} ${styles.goldRow}`}>
                    <span>Promotional Discount:</span>
                    <strong>–₹{discount.toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div className={styles.reviewRow}>
                  <span>Delivery / Courier:</span>
                  <strong className={styles.freeText}>Complimentary</strong>
                </div>
                {depositSubtotal > 0 && (
                  <div className={`${styles.reviewRow} ${styles.depositRow}`}>
                    <div>
                      <span>Refundable Security Deposit:</span>
                      <small>100% credited back upon return inspection</small>
                    </div>
                    <strong>₹{depositSubtotal.toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div className={styles.reviewTotalRow}>
                  <span>Total Payable Today:</span>
                  <span className={styles.totalBig}>₹{totalPayable.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className={styles.stepActionRow}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setStep(1)}
              >
                Back to Address
              </button>

              <button
                type="button"
                className={styles.placeOrderBtn}
                onClick={handlePlaceOrder}
                disabled={isProcessing}
              >
                <span>{isProcessing ? 'Confirming with Atelier...' : `Confirm & Pay ₹${totalPayable.toLocaleString('en-IN')}`}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className={styles.confirmWrap}>
          <div className={styles.confirmCard}>
            <CheckCircle2 size={64} className={styles.successIcon} />
            <h1>Order & Reservation Confirmed</h1>
            <p className={styles.confirmLead}>
              Thank you, {user?.fullName || 'valued patron'}. Your request has been recorded with
              the Majestic Blazer tailoring house.
            </p>

            <div className={styles.confirmDetails}>
              {confirmedOrders.map((o) => (
                <div key={o.id} className={styles.confirmItem}>
                  <div>
                    <span className={styles.refLabel}>PURCHASE ORDER</span>
                    <strong>{o.order_number}</strong>
                    <span>Total: ₹{Number(o.total).toLocaleString('en-IN')} • Status: Confirmed</span>
                  </div>
                  <DownloadInvoiceButton
                    invoiceIdentifier={o.invoice_number || o.order_number || o.id}
                    orderNumber={o.order_number}
                    label="Download Tax Invoice (PDF)"
                    variant="primary"
                    size="md"
                  />
                </div>
              ))}

              {confirmedRentals.map((r) => (
                <div key={r.id} className={styles.confirmItem}>
                  <div>
                    <span className={`${styles.refLabel} ${styles.rentRefLabel}`}>RENTAL RESERVATION</span>
                    <strong>{r.booking_number}</strong>
                    <span>
                      Duration: {new Date(r.start_date).toLocaleDateString('en-IN')} to {new Date(r.end_date).toLocaleDateString('en-IN')} ({r.rental_days} Days)
                    </span>
                    <span>Deposit: ₹{Number(r.deposit_amount).toLocaleString('en-IN')} (Refundable)</span>
                  </div>
                  <DownloadInvoiceButton
                    invoiceIdentifier={r.invoice_number || r.booking_number || r.id}
                    orderNumber={r.booking_number}
                    label="Download Rental Invoice (PDF)"
                    variant="primary"
                    size="md"
                  />
                </div>
              ))}
            </div>

            <div className={styles.confirmActions}>
              <Link to="/orders" className={styles.ordersLink}>View My Orders</Link>
              <Link to="/rental-bookings" className={styles.rentalsLink}>View Rental Bookings</Link>
              <Link to="/shop" className={styles.homeLink}>Continue Shopping</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
