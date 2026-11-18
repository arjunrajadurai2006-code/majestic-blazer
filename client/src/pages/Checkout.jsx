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

  const handleContinueToPayment = () => {
    if (deliveryType === 'delivery') {
      const isUsingSaved = selectedAddressId && selectedAddressId !== 'new';
      if (!isUsingSaved) {
        if (!line1.trim()) {
          toastError('Please enter Address Line 1 for delivery.');
          return;
        }
        if (!city.trim()) {
          toastError('Please enter your City.');
          return;
        }
        if (!state.trim()) {
          toastError('Please enter your State.');
          return;
        }
        if (!pincode.trim() || pincode.trim().length !== 6) {
          toastError('Please enter a valid 6-digit postal Pincode.');
          return;
        }
      }
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      let finalAddressId = selectedAddressId && selectedAddressId !== 'new' ? selectedAddressId : null;

      // If user typed in an address and didn't select an existing one
      if (deliveryType === 'delivery' && !finalAddressId && line1.trim()) {
        const addrRes = await api.post('/auth/addresses', {
          line1,
          line2: line2 || null,
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
                className={`${styles.methodCard} ${deliveryType === 'delivery' ? styles.methodCardActive : ''}`}
                onClick={() => setDeliveryType('delivery')}
                aria-pressed={deliveryType === 'delivery'}
              >
                <div className={styles.methodIconWrapper}>
                  <Truck size={20} className={styles.methodIcon} />
                </div>
                <div className={styles.methodDetails}>
                  <div className={styles.methodTitleRow}>
                    <strong className={styles.methodTitle}>Insured Luxury Courier Delivery</strong>
                    <span className={styles.complimentaryPill}>Complimentary</span>
                  </div>
                  <p className={styles.methodDesc}>
                    Direct to your doorstep across India in protective garment casing with transit insurance.
                  </p>
                </div>
                <div className={styles.methodRadioCircle}>
                  {deliveryType === 'delivery' && <div className={styles.methodRadioDot} />}
                </div>
              </button>

              <button
                type="button"
                className={`${styles.methodCard} ${deliveryType === 'pickup' ? styles.methodCardActive : ''}`}
                onClick={() => setDeliveryType('pickup')}
                aria-pressed={deliveryType === 'pickup'}
              >
                <div className={styles.methodIconWrapper}>
                  <MapPin size={20} className={styles.methodIcon} />
                </div>
                <div className={styles.methodDetails}>
                  <div className={styles.methodTitleRow}>
                    <strong className={styles.methodTitle}>Flagship Boutique Collection</strong>
                    <span className={styles.pickupPill}>Atelier Ready</span>
                  </div>
                  <p className={styles.methodDesc}>
                    Sathy Road, Kurumbampalayam, Coimbatore • Private fitting room & steam ready.
                  </p>
                </div>
                <div className={styles.methodRadioCircle}>
                  {deliveryType === 'pickup' && <div className={styles.methodRadioDot} />}
                </div>
              </button>
            </div>

            {deliveryType === 'delivery' && (
              <div className={styles.addressFormBlock}>
                <div className={styles.addressHeaderRow}>
                  <h3>Shipping Address</h3>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      className={styles.newAddrToggleBtn}
                      onClick={() => {
                        if (selectedAddressId === 'new') {
                          setSelectedAddressId(addresses[0]?.id || null);
                        } else {
                          setSelectedAddressId('new');
                        }
                      }}
                    >
                      {selectedAddressId === 'new' ? 'Use Saved Address' : '+ Add New Address'}
                    </button>
                  )}
                </div>

                {addresses.length > 0 && selectedAddressId !== 'new' && (
                  <div className={styles.savedAddresses}>
                    <label className={styles.fieldSectionLabel}>Select Saved Delivery Address:</label>
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
                          <div className={styles.addrCardContent}>
                            <strong>{addr.line1}</strong>
                            {addr.line2 && <span>{addr.line2}</span>}
                            <span>{addr.city}, {addr.state} - {addr.pincode}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedAddressId === 'new' || !selectedAddressId || addresses.length === 0) && (
                  <div className={styles.manualAddressForm}>
                    <h4 className={styles.formSubheading}>
                      {addresses.length > 0 ? 'Enter New Delivery Address' : 'Enter Delivery Address'}
                    </h4>

                    <div className={styles.formRow}>
                      <label htmlFor="checkout-line1">Address Line 1 (House / Street)</label>
                      <input
                        id="checkout-line1"
                        type="text"
                        name="street-address"
                        autoComplete="shipping street-address"
                        placeholder="House / Flat / Street address"
                        value={line1}
                        onChange={(e) => setLine1(e.target.value)}
                        required
                        className={styles.inputField}
                      />
                    </div>

                    <div className={styles.formRow}>
                      <label htmlFor="checkout-line2">Address Line 2 (Apartment / Landmark - Optional)</label>
                      <input
                        id="checkout-line2"
                        type="text"
                        name="address-line2"
                        autoComplete="shipping address-line2"
                        placeholder="Apartment, suite, unit, landmark (optional)"
                        value={line2}
                        onChange={(e) => setLine2(e.target.value)}
                        className={styles.inputField}
                      />
                    </div>

                    <div className={styles.cityStatePincodeGrid}>
                      <div className={styles.formRow}>
                        <label htmlFor="checkout-city">City</label>
                        <input
                          id="checkout-city"
                          type="text"
                          name="city"
                          autoComplete="shipping address-level2"
                          placeholder="City / Town"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          className={styles.inputField}
                        />
                      </div>

                      <div className={styles.formRow}>
                        <label htmlFor="checkout-state">State</label>
                        <input
                          id="checkout-state"
                          type="text"
                          name="state"
                          autoComplete="shipping address-level1"
                          placeholder="State"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          required
                          className={styles.inputField}
                        />
                      </div>

                      <div className={styles.formRow}>
                        <label htmlFor="checkout-pincode">Pincode</label>
                        <input
                          id="checkout-pincode"
                          type="text"
                          name="postal-code"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoComplete="shipping postal-code"
                          placeholder="6-digit pincode"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          required
                          className={styles.inputField}
                        />
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
              <label htmlFor="checkout-notes">Special Instructions / Fitting Notes (Optional)</label>
              <textarea
                id="checkout-notes"
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
                onClick={handleContinueToPayment}
              >
                <span>Continue to Payment</span>
                <ArrowRight size={17} />
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
          <div className={styles.confirmHeader}>
            <div className={styles.confirmIconRing}>
              <CheckCircle2 size={40} className={styles.confirmCheckIcon} />
            </div>
            <h1 className={styles.confirmTitle}>Order & Reservation Confirmed</h1>
            <p className={styles.confirmLead}>
              Thank you, {user?.fullName || 'valued patron'}. Your request has been recorded with
              the Majestic Blazer tailoring house.
            </p>
          </div>

          <div className={styles.confirmCardsList}>
            {/* Purchase Orders Section */}
            {confirmedOrders.map((o) => (
              <div key={o.id} className={styles.orderSuccessCard}>
                <div className={styles.orderSuccessCardHeader}>
                  <div className={styles.orderBadgeGroup}>
                    <span className={styles.orderTypeBadge}>PURCHASE ORDER</span>
                    <span className={styles.orderStatusBadge}>CONFIRMED</span>
                  </div>
                  <span className={styles.orderDateStamp}>
                    {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className={styles.orderMetricsGrid}>
                  <div className={styles.metricBlock}>
                    <span className={styles.metricLabel}>Order Reference Number</span>
                    <strong className={styles.orderNumberText}>{o.order_number}</strong>
                  </div>

                  <div className={styles.metricBlock}>
                    <span className={styles.metricLabel}>Total Amount Paid</span>
                    <strong className={styles.orderTotalText}>₹{Number(o.total).toLocaleString('en-IN')}</strong>
                    <span className={styles.taxInclusiveTag}>Includes GST & Complimentary Delivery</span>
                  </div>
                </div>

                <div className={styles.orderCardFooter}>
                  <div className={styles.cardAssurance}>
                    <Shield size={15} />
                    <span>Complimentary insured courier delivery dispatched within 24 hours</span>
                  </div>
                  <DownloadInvoiceButton
                    invoiceIdentifier={o.invoice_number || o.order_number || o.id}
                    orderNumber={o.order_number}
                    invoiceType="purchase"
                    label="Download Tax Invoice (PDF)"
                    variant="primary"
                    size="md"
                    className={styles.cardDownloadBtn}
                  />
                </div>
              </div>
            ))}

            {/* Rental Reservations Section (Rendered only when rental bookings exist) */}
            {confirmedRentals.map((r) => (
              <div key={r.id} className={`${styles.orderSuccessCard} ${styles.rentalSuccessCard}`}>
                <div className={styles.orderSuccessCardHeader}>
                  <div className={styles.orderBadgeGroup}>
                    <span className={`${styles.orderTypeBadge} ${styles.rentalBadge}`}>RENTAL RESERVATION</span>
                    <span className={styles.orderStatusBadge}>CONFIRMED</span>
                  </div>
                  <span className={styles.orderDateStamp}>
                    {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className={styles.orderMetricsGrid}>
                  <div className={styles.metricBlock}>
                    <span className={styles.metricLabel}>Rental Booking Number</span>
                    <strong className={styles.orderNumberText}>{r.booking_number}</strong>
                  </div>

                  <div className={styles.metricBlock}>
                    <span className={styles.metricLabel}>Rental Window & Fitting</span>
                    <strong className={styles.rentalDatesText}>
                      {new Date(r.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(r.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </strong>
                    <span className={styles.rentalDurationTag}>{r.rental_days} Day Fitting & Event Window</span>
                  </div>

                  <div className={styles.metricBlock}>
                    <span className={styles.metricLabel}>Refundable Security Deposit</span>
                    <strong className={styles.depositAmountText}>₹{Number(r.deposit_amount).toLocaleString('en-IN')}</strong>
                    <span className={styles.depositNoteText}>100% credited back upon return inspection</span>
                  </div>
                </div>

                <div className={styles.orderCardFooter}>
                  <div className={styles.cardAssurance}>
                    <Shield size={15} />
                    <span>Garment bag and professional dry cleaning included with rental</span>
                  </div>
                  <DownloadInvoiceButton
                    invoiceIdentifier={r.invoice_number || r.booking_number || r.id}
                    orderNumber={r.booking_number}
                    invoiceType="rental"
                    label="Download Rental Invoice (PDF)"
                    variant="primary"
                    size="md"
                    className={styles.cardDownloadBtn}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.confirmNavActions}>
            <Link to="/orders" className={styles.navActionOutline}>View My Orders</Link>
            {confirmedRentals.length > 0 && (
              <Link to="/rental-bookings" className={styles.navActionOutline}>View Rental Bookings</Link>
            )}
            <Link to="/shop" className={styles.navActionPrimary}>Continue Shopping</Link>
          </div>
        </div>
      )}
    </div>
  );
}
