import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Package,
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  Calendar,
  MapPin,
  CreditCard,
  Shield,
  FileText,
  XCircle,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import DownloadInvoiceButton from '../components/common/DownloadInvoiceButton';
import styles from './OrderDetails.module.css';

const DEFAULT_IMAGE = '/assets/products/imperial-navy-velvet-front.webp';

const CANCELLATION_REASONS = [
  'Ordered incorrect size',
  'Event rescheduled',
  'Selected alternate blazer style',
  'Delivery timing no longer suitable',
  'Other',
];

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedReason, setSelectedReason] = useState('Ordered incorrect size');
  const [customExplanation, setCustomExplanation] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Keyboard accessibility for modal dismissal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCancelModal && !cancelling) {
        setShowCancelModal(false);
        setCancelError('');
      }
    };
    if (showCancelModal) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showCancelModal, cancelling]);

  const fetchOrder = async () => {
    setLoading(true);
    setErrorCode(null);
    setErrorMessage('');
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      console.error('Failed to load order details:', err);
      const status = err.response?.status || err.status || 500;
      setErrorCode(status);
      if (status === 403) {
        setErrorMessage('You do not have permission to access this order.');
      } else if (status === 404) {
        setErrorMessage(`Order #${id} was not found in your account.`);
      } else {
        setErrorMessage(err.response?.data?.message || err.message || 'Unable to load order details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const handleOpenCancelModal = () => {
    setSelectedReason('Ordered incorrect size');
    setCustomExplanation('');
    setCancelError('');
    setShowCancelModal(true);
  };

  const handleCloseCancelModal = () => {
    if (cancelling) return;
    setShowCancelModal(false);
    setCancelError('');
  };

  const handleCancelOrder = async (e) => {
    if (e) e.preventDefault();
    if (!order || order.status !== 'pending' || cancelling) return;
    setCancelling(true);
    setCancelError('');
    try {
      await api.post(`/orders/${order.id}/cancel`, {
        reason: selectedReason,
        explanation: selectedReason === 'Other' ? customExplanation.trim() : (customExplanation.trim() || undefined),
      });
      success('Order cancelled successfully. Reserved inventory has been released.');
      setShowCancelModal(false);
      // Refresh order details to reflect cancelled state and cancellation reason
      await fetchOrder();
    } catch (err) {
      console.error('Failed to cancel order:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to cancel this order.';
      setCancelError(msg);
      toastError(msg);
    } finally {
      setCancelling(false);
    }
  };

  const parseAddress = (orderData) => {
    if (!orderData) return null;
    if (orderData.line1) {
      return {
        line1: orderData.line1,
        line2: orderData.line2,
        city: orderData.city,
        state: orderData.state,
        pincode: orderData.pincode,
      };
    }
    if (orderData.shipping_address) {
      if (typeof orderData.shipping_address === 'string') {
        try {
          const parsed = JSON.parse(orderData.shipping_address);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch {
          return { raw: orderData.shipping_address };
        }
      }
      if (typeof orderData.shipping_address === 'object') {
        return orderData.shipping_address;
      }
    }
    return null;
  };

  // Helper for status stage progress
  const getStageIndex = (status) => {
    switch (status) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'shipped': return 2;
      case 'delivered': return 3;
      default: return -1;
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Loading Skeleton State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.breadcrumbBar}>
          <div className={styles.skeletonText} style={{ width: 140, height: 16 }} />
        </div>
        <div className={styles.header}>
          <div>
            <div className={styles.skeletonText} style={{ width: 100, height: 14, marginBottom: 8 }} />
            <div className={styles.skeletonText} style={{ width: 280, height: 36 }} />
          </div>
          <div className={styles.skeletonText} style={{ width: 160, height: 42 }} />
        </div>

        <div className={styles.skeletonCard} style={{ height: 120, marginBottom: 28 }} />
        <div className={styles.grid}>
          <div className={styles.skeletonCard} style={{ height: 340 }} />
          <div className={styles.skeletonCard} style={{ height: 340 }} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Error States (403, 404, or Network)
  // ---------------------------------------------------------------------------
  if (errorCode || !order) {
    const isForbidden = errorCode === 403;
    const isNotFound = errorCode === 404;

    return (
      <div className={`container ${styles.page}`}>
        <nav className={styles.breadcrumbBar} aria-label="Breadcrumb">
          <Link to="/orders" className={styles.backLink}>
            <ArrowLeft size={15} />
            <span>Back to Orders</span>
          </Link>
        </nav>

        <div className={styles.errorContainer}>
          <div className={styles.errorIconWrap}>
            {isForbidden ? (
              <Shield size={44} className={styles.errorIconAlert} />
            ) : isNotFound ? (
              <Package size={44} className={styles.errorIconMuted} />
            ) : (
              <AlertCircle size={44} className={styles.errorIconAlert} />
            )}
          </div>

          <span className={styles.errorEyebrow}>
            {isForbidden ? 'ACCESS RESTRICTED' : isNotFound ? 'ORDER NOT FOUND' : 'UNABLE TO LOAD ORDER'}
          </span>

          <h2 className={styles.errorTitle}>
            {isForbidden
              ? 'Permission Denied'
              : isNotFound
              ? 'Order Could Not Be Found'
              : 'Error Loading Order'}
          </h2>

          <p className={styles.errorDesc}>
            {isForbidden
              ? 'You do not have authorization to view this customer order. If you have multiple accounts, please switch to the account used during checkout.'
              : isNotFound
              ? `We could not locate an order matching reference "${id}". Please verify the order number or consult your order history.`
              : errorMessage}
          </p>

          <div className={styles.errorActions}>
            <Link to="/orders" className={styles.btnPrimary}>
              View Your Orders
            </Link>
            <Link to="/shop" className={styles.btnOutline}>
              Continue Shopping
            </Link>
            {!isForbidden && !isNotFound && (
              <button type="button" onClick={fetchOrder} className={styles.btnGhost}>
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const shippingAddr = parseAddress(order);
  const stageIndex = getStageIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isRefunded = order.status === 'refunded';
  const canCancel = order.status === 'pending';

  const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const orderTime = new Date(order.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`container ${styles.page}`}>
      {/* ── Breadcrumb Navigation ── */}
      <nav className={styles.breadcrumbBar} aria-label="Breadcrumb">
        <Link to="/orders" className={styles.backLink}>
          <ArrowLeft size={15} />
          <span>Back to All Orders</span>
        </Link>
        <span className={styles.breadcrumbDivider}>/</span>
        <span className={styles.breadcrumbCurrent}>{order.order_number}</span>
      </nav>

      {/* ── Order Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.orderMetaRow}>
            <span className={styles.eyebrow}>BESPOKE PURCHASE ORDER</span>
            <span className={`${styles.statusPill} ${styles[order.status]}`}>
              {order.status.toUpperCase()}
            </span>
          </div>

          <h1 className={styles.orderHeading}>{order.order_number}</h1>

          <div className={styles.timestampRow}>
            <span className={styles.timestamp}>
              <Calendar size={14} />
              Placed on {orderDate} at {orderTime}
            </span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.paymentMethodMeta}>
              <CreditCard size={14} />
              {order.payment?.provider === 'cod'
                ? 'Cash on Delivery'
                : order.payment?.provider === 'razorpay'
                ? 'Razorpay Secure Payment'
                : 'Direct Atelier Payment'}
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <DownloadInvoiceButton
            invoiceIdentifier={order.invoice_number || order.order_number || order.id}
            orderNumber={order.order_number}
            invoiceType="purchase"
            label="Download Invoice (PDF)"
            variant="primary"
            size="md"
          />

          {canCancel && (
            <button
              type="button"
              className={styles.cancelOrderBtn}
              onClick={handleOpenCancelModal}
            >
              Cancel Order
            </button>
          )}
        </div>
      </header>

      {/* ── Order Lifecycle / Status Tracker ── */}
      <section className={styles.trackerCard} aria-label="Order Status Progress">
        {isCancelled ? (
          <div className={styles.cancelledBanner}>
            <div className={styles.cancelledIconWrap}>
              <XCircle size={22} />
            </div>
            <div className={styles.cancelledContent}>
              <strong>Order Cancelled</strong>
              <p>This bespoke order was cancelled. Any temporary inventory reservation has been released back to stock.</p>
              {order.notes && (
                <div className={styles.cancellationReasonDisplay}>
                  <span className={styles.cancellationReasonLabel}>Reason for Cancellation:</span>
                  <span className={styles.cancellationReasonText}>
                    {order.notes.replace(/^Cancelled:\s*/i, '').split(' | Original fitting notes:')[0]}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : isRefunded ? (
          <div className={styles.refundedBanner}>
            <div className={styles.refundedIconWrap}>
              <AlertCircle size={22} />
            </div>
            <div>
              <strong>Order Refunded</strong>
              <p>This order has been processed for a full refund through the original payment method.</p>
            </div>
          </div>
        ) : (
          <div className={styles.stepperWrap}>
            <div className={styles.stepper}>
              {/* Step 1: Placed */}
              <div className={`${styles.step} ${stageIndex >= 0 ? styles.stepCompleted : ''} ${stageIndex === 0 ? styles.stepCurrent : ''}`}>
                <div className={styles.stepCircle}>
                  {stageIndex > 0 ? <CheckCircle2 size={16} /> : <span>1</span>}
                </div>
                <div className={styles.stepLabelWrap}>
                  <span className={styles.stepTitle}>Order Placed</span>
                  <span className={styles.stepDesc}>Details received</span>
                </div>
              </div>

              <div className={`${styles.stepLine} ${stageIndex >= 1 ? styles.stepLineActive : ''}`} />

              {/* Step 2: Confirmed */}
              <div className={`${styles.step} ${stageIndex >= 1 ? styles.stepCompleted : ''} ${stageIndex === 1 ? styles.stepCurrent : ''}`}>
                <div className={styles.stepCircle}>
                  {stageIndex > 1 ? <CheckCircle2 size={16} /> : <span>2</span>}
                </div>
                <div className={styles.stepLabelWrap}>
                  <span className={styles.stepTitle}>Confirmed</span>
                  <span className={styles.stepDesc}>Atelier tailored</span>
                </div>
              </div>

              <div className={`${styles.stepLine} ${stageIndex >= 2 ? styles.stepLineActive : ''}`} />

              {/* Step 3: Shipped */}
              <div className={`${styles.step} ${stageIndex >= 2 ? styles.stepCompleted : ''} ${stageIndex === 2 ? styles.stepCurrent : ''}`}>
                <div className={styles.stepCircle}>
                  {stageIndex > 2 ? <CheckCircle2 size={16} /> : <span>3</span>}
                </div>
                <div className={styles.stepLabelWrap}>
                  <span className={styles.stepTitle}>
                    {order.delivery_type === 'pickup' ? 'Ready for Pickup' : 'Dispatched'}
                  </span>
                  <span className={styles.stepDesc}>
                    {order.delivery_type === 'pickup' ? 'At Coimbatore boutique' : 'Insured courier'}
                  </span>
                </div>
              </div>

              <div className={`${styles.stepLine} ${stageIndex >= 3 ? styles.stepLineActive : ''}`} />

              {/* Step 4: Delivered */}
              <div className={`${styles.step} ${stageIndex >= 3 ? styles.stepCompleted : ''} ${stageIndex === 3 ? styles.stepCurrent : ''}`}>
                <div className={styles.stepCircle}>
                  <span>4</span>
                </div>
                <div className={styles.stepLabelWrap}>
                  <span className={styles.stepTitle}>
                    {order.delivery_type === 'pickup' ? 'Collected' : 'Delivered'}
                  </span>
                  <span className={styles.stepDesc}>Completed</span>
                </div>
              </div>
            </div>

            {order.tracking_number && (
              <div className={styles.trackingNotice}>
                <Truck size={16} />
                <span>Courier Tracking Reference: <strong>{order.tracking_number}</strong></span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Main Layout: Ordered Items & Order Metadata ── */}
      <div className={styles.grid}>
        {/* Left Column: Items List */}
        <section className={styles.itemsSection} aria-label="Ordered Items">
          <div className={styles.sectionHeader}>
            <h2>Items in this Order ({order.items?.length || 0})</h2>
          </div>

          <div className={styles.itemsList}>
            {order.items?.map((item) => {
              const itemTotal = Number(item.unitPrice) * item.quantity;
              const imageSrc = item.imageUrl || DEFAULT_IMAGE;

              return (
                <article key={item.id} className={styles.itemCard}>
                  <Link to={`/products/${item.productSlug}`} className={styles.itemImageLink}>
                    <img
                      src={imageSrc}
                      alt={item.productName}
                      className={styles.itemImage}
                      loading="lazy"
                      decoding="async"
                      width="90"
                      height="110"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = DEFAULT_IMAGE;
                      }}
                    />
                  </Link>

                  <div className={styles.itemDetails}>
                    <div className={styles.itemTitleRow}>
                      <Link to={`/products/${item.productSlug}`} className={styles.itemName}>
                        {item.productName}
                      </Link>
                      <span className={styles.itemTotalAmount}>
                        ₹{itemTotal.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className={styles.itemBadges}>
                      <span className={styles.itemBadge}>Chest Size: {item.size || 'Tailored'}</span>
                      <span className={styles.itemBadge}>Qty: {item.quantity}</span>
                      {item.sku && <span className={styles.itemSkuBadge}>SKU: {item.sku}</span>}
                    </div>

                    <div className={styles.itemPriceMeta}>
                      <span>Unit Price: ₹{Number(item.unitPrice).toLocaleString('en-IN')}</span>
                      {item.quantity > 1 && (
                        <span> • ₹{Number(item.unitPrice).toLocaleString('en-IN')} × {item.quantity}</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {order.notes && (
            (() => {
              const fittingNotes = order.notes.includes(' | Original fitting notes:')
                ? order.notes.split(' | Original fitting notes:')[1]?.trim()
                : (!order.notes.startsWith('Cancelled:') && !order.notes.startsWith('Cancelled by') ? order.notes : null);
              if (!fittingNotes) return null;
              return (
                <div className={styles.fittingNotesBlock}>
                  <span className={styles.notesLabel}>Special Instructions & Fitting Notes</span>
                  <p className={styles.notesText}>{fittingNotes}</p>
                </div>
              );
            })()
          )}
        </section>

        {/* Right Column: Delivery, Payment, and Financial Summary */}
        <div className={styles.sideColumn}>
          {/* 1. Delivery & Recipient Card */}
          <section className={styles.detailCard} aria-label="Delivery Details">
            <h3 className={styles.cardTitle}>
              <MapPin size={17} />
              <span>Fulfillment & Delivery</span>
            </h3>

            {order.delivery_type === 'pickup' ? (
              <div className={styles.pickupInfo}>
                <div className={styles.methodTag}>Flagship Boutique Collection</div>
                <strong className={styles.boutiqueTitle}>Majestic Blazer Flagship Atelier</strong>
                <p className={styles.boutiqueAddress}>
                  First Floor, Shop No. 99/6, Sathy Rd, Opp. to Saravana Bhavan Hotel<br />
                  Kurumbapalayam, Coimbatore, Tamil Nadu - 641107<br />
                  Phone: +91 8903238882
                </p>
                <span className={styles.pickupHours}>
                  Collection Hours: Mon – Sun, 10:00 AM – 8:30 PM
                </span>
              </div>
            ) : (
              <div className={styles.addressInfo}>
                <div className={styles.methodTag}>Insured Courier Delivery</div>
                {order.customer_name && (
                  <strong className={styles.recipientName}>{order.customer_name}</strong>
                )}
                {shippingAddr?.raw ? (
                  <p className={styles.addressLines}>{shippingAddr.raw}</p>
                ) : shippingAddr ? (
                  <p className={styles.addressLines}>
                    {shippingAddr.line1}
                    {shippingAddr.line2 && <><br />{shippingAddr.line2}</>}
                    <br />
                    {shippingAddr.city}, {shippingAddr.state} - {shippingAddr.pincode}
                  </p>
                ) : (
                  <p className={styles.addressLines}>Address details stored with courier order</p>
                )}

                {(order.customer_phone || order.customer_email) && (
                  <div className={styles.recipientContact}>
                    {order.customer_phone && <span>Phone: {order.customer_phone}</span>}
                    {order.customer_email && <span>Email: {order.customer_email}</span>}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. Payment Status Card */}
          <section className={styles.detailCard} aria-label="Payment Status">
            <h3 className={styles.cardTitle}>
              <CreditCard size={17} />
              <span>Payment Details</span>
            </h3>

            <div className={styles.paymentRow}>
              <span>Payment Method:</span>
              <strong>
                {order.payment?.provider === 'cod'
                  ? 'Cash on Delivery (COD)'
                  : order.payment?.provider === 'razorpay'
                  ? 'Razorpay Online'
                  : 'Atelier Direct'}
              </strong>
            </div>

            <div className={styles.paymentRow}>
              <span>Payment Status:</span>
              <span className={`${styles.paymentStatusBadge} ${
                order.payment?.status === 'refunded'
                  ? styles.refunded
                  : (order.payment?.refundStatus === 'failed' || order.payment?.refund_status === 'failed')
                  ? styles.failed
                  : (order.payment?.refundStatus === 'pending' || order.payment?.refund_status === 'pending')
                  ? styles.pending
                  : order.payment?.provider === 'cod'
                  ? (order.payment?.status === 'paid' ? styles.paid : styles.pending)
                  : (order.payment?.status === 'paid' ? styles.paid : styles.pending)
              }`}>
                {order.payment?.status === 'refunded'
                  ? 'REFUNDED'
                  : (order.payment?.refundStatus === 'failed' || order.payment?.refund_status === 'failed')
                  ? 'REFUND FAILED'
                  : (order.payment?.refundStatus === 'pending' || order.payment?.refund_status === 'pending')
                  ? 'REFUND PENDING (AWAITING GATEWAY)'
                  : order.payment?.provider === 'cod'
                  ? (order.payment?.status === 'paid'
                      ? 'COLLECTED / PAID (COD)'
                      : order.status === 'cancelled'
                      ? 'CANCELLED'
                      : 'PAYABLE UPON DELIVERY (COD)')
                  : (order.payment?.status === 'paid'
                      ? 'CONFIRMED / PAID'
                      : order.status === 'cancelled'
                      ? 'CANCELLED'
                      : 'PENDING')}
              </span>
            </div>

            {order.payment?.paymentId && (
              <div className={styles.paymentRow}>
                <span>Transaction Ref:</span>
                <span className={styles.txRef}>{order.payment.paymentId}</span>
              </div>
            )}
          </section>

          {/* 3. Price Breakdown */}
          <section className={styles.summaryCard} aria-label="Price Breakdown">
            <h3 className={styles.summaryTitle}>Order Summary</h3>

            <div className={styles.summaryRow}>
              <span>Item Subtotal</span>
              <span>₹{Number(order.subtotal || 0).toLocaleString('en-IN')}</span>
            </div>

            {Number(order.discount || 0) > 0 && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span>Coupon Discount</span>
                <span>-₹{Number(order.discount).toLocaleString('en-IN')}</span>
              </div>
            )}

            {Number(order.tax || 0) > 0 && (
              <div className={styles.summaryRow}>
                <span>Taxes & GST (Included)</span>
                <span>₹{Number(order.tax).toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className={styles.summaryRow}>
              <span>Insured Shipping & Packaging</span>
              <span>{Number(order.shipping || 0) === 0 ? 'COMPLIMENTARY' : `₹${Number(order.shipping).toLocaleString('en-IN')}`}</span>
            </div>

            <div className={styles.totalDivider} />

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total Amount</span>
              <strong className={styles.totalValue}>
                ₹{Number(order.total || 0).toLocaleString('en-IN')}
              </strong>
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer Navigation Actions ── */}
      <footer className={styles.footerNav}>
        <Link to="/orders" className={styles.btnSecondary}>
          <ArrowLeft size={16} />
          <span>Return to Order History</span>
        </Link>
        <Link to="/shop" className={styles.btnPrimary}>
          <span>Continue Shopping</span>
          <ArrowRight size={16} />
        </Link>
      </footer>

      {/* ── Cancel Order Confirmation Modal ── */}
      {showCancelModal && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          aria-describedby="cancel-dialog-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cancelling) {
              handleCloseCancelModal();
            }
          }}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalAlertIcon}>
                <AlertCircle size={22} />
              </div>
              <h3 id="cancel-dialog-title">Cancel Order #{order.order_number}</h3>
            </div>

            <p id="cancel-dialog-desc" className={styles.modalBody}>
              Cancelling will immediately release your reserved bespoke pieces back to available inventory.
              Please select the primary reason for your cancellation:
            </p>

            {cancelError && (
              <div className={styles.cancelErrorNotice} role="alert">
                <AlertCircle size={15} />
                <span>{cancelError}</span>
              </div>
            )}

            <form onSubmit={handleCancelOrder} className={styles.cancelForm}>
              <div className={styles.reasonsList} role="radiogroup" aria-label="Cancellation reasons">
                {CANCELLATION_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <label
                      key={reason}
                      className={`${styles.reasonOption} ${isSelected ? styles.reasonOptionSelected : ''}`}
                    >
                      <input
                        type="radio"
                        name="cancellationReason"
                        value={reason}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedReason(reason);
                          setCancelError('');
                        }}
                        disabled={cancelling}
                        className={styles.reasonRadio}
                      />
                      <span className={styles.reasonLabelText}>{reason}</span>
                    </label>
                  );
                })}
              </div>

              {selectedReason === 'Other' && (
                <div className={styles.customExplanationWrap}>
                  <label htmlFor="cancel-explanation" className={styles.explanationLabel}>
                    Please tell us more (Optional):
                  </label>
                  <textarea
                    id="cancel-explanation"
                    rows={3}
                    className={styles.explanationTextarea}
                    placeholder="Provide additional details regarding your request (optional)..."
                    value={customExplanation}
                    onChange={(e) => setCustomExplanation(e.target.value.slice(0, 300))}
                    maxLength={300}
                    disabled={cancelling}
                  />
                  <span className={styles.charCount}>{customExplanation.length}/300</span>
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalKeepBtn}
                  onClick={handleCloseCancelModal}
                  disabled={cancelling}
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  className={styles.modalConfirmCancelBtn}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <>
                      <span className={styles.btnSpinner} />
                      <span>Cancelling Order...</span>
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
