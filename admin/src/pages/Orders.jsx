import { useEffect, useState } from 'react';
import { Search, Eye, FileText, Truck, Check, X, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected order modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams();
      if (statusFilter) q.set('status', statusFilter);
      if (search) q.set('search', search);

      const res = await api.get(`/orders/all?${q.toString()}`);
      setOrders(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders();
  };

  const openOrderDetails = async (orderId) => {
    try {
      setDetailsLoading(true);
      setSelectedOrder(null);
      const res = await api.get(`/orders/${orderId}`);
      setSelectedOrder(res.data);
      setStatusToUpdate(res.data.status);
      setTrackingNumber(res.data.tracking_number || '');
    } catch (err) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    setError('');
    setSuccess('');

    try {
      await api.patch(`/orders/${selectedOrder.id}/status`, {
        status: statusToUpdate,
        trackingNumber: trackingNumber.trim() || null,
      });
      setSuccess(`Order #${selectedOrder.order_number} status updated to ${statusToUpdate}`);
      setSelectedOrder(prev => ({ ...prev, status: statusToUpdate, tracking_number: trackingNumber }));
      loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'delivered': return `${styles.badge} ${styles.badgeSuccess}`;
      case 'shipped':
      case 'confirmed': return `${styles.badge} ${styles.badgeInfo}`;
      case 'cancelled':
      case 'refunded': return `${styles.badge} ${styles.badgeDanger}`;
      case 'pending':
      default: return `${styles.badge} ${styles.badgeWarning}`;
    }
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Patron Purchase Orders</h1>
          <p className={styles.subtitle}>Direct sartorial fulfillment and courier dispatch tracking</p>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search size={18} color="#888" style={{ marginRight: '8px' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by order #, client name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.selectInput}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button type="submit" className={styles.btnSecondary}>Search</button>
      </form>

      {/* Orders Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order Ref</th>
              <th>Patron</th>
              <th>Date</th>
              <th>Garments</th>
              <th>Total Amount</th>
              <th>Fulfillment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map(o => (
                <tr key={o.id}>
                  <td>
                    <strong style={{ color: '#fff', letterSpacing: '0.05em' }}>
                      #{o.order_number || o.id}
                    </strong>
                    {o.invoice_number && (
                      <div style={{ fontSize: '0.75rem', color: '#b99a58' }}>
                        Inv: {o.invoice_number}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#e5e5e5' }}>{o.customer_name || 'Patron'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{o.customer_email}</div>
                  </td>
                  <td style={{ color: '#aaa', fontSize: '0.85rem' }}>
                    {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeDefault}`}>
                      {o.items_count || 1} items
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#fff' }}>{formatCurrency(o.total || o.total_amount)}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: (o.delivery_type || o.fulfillment_type) === 'pickup' ? '#b99a58' : '#aaa' }}>
                      {(o.delivery_type || o.fulfillment_type) === 'pickup' ? 'Coimbatore Atelier Pickup' : 'Courier Delivery'}
                    </span>
                  </td>
                  <td>
                    <span className={getStatusBadge(o.status)}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className={styles.btnSecondary} onClick={() => openOrderDetails(o.id)} title="View Order Details">
                        <Eye size={14} /> View
                      </button>
                      <a
                        href={api.getApiUrl(`/invoices/${o.id}/pdf`)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.btnSecondary}
                        title="Download Invoice PDF"
                      >
                        <FileText size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className={styles.emptyState}>
                  {loading ? 'Retrieving orders...' : 'No orders found matching filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '750px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Order #{selectedOrder.order_number}</h2>
                <span className={styles.subtitle}>
                  Placed on {new Date(selectedOrder.created_at).toLocaleString('en-IN')}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)}>×</button>
            </div>

            {/* Customer & Fulfillment Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: '#0e0e0e', padding: '1rem', borderRadius: '4px', border: '1px solid #222' }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#b99a58', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
                  Customer Details
                </span>
                <div style={{ fontWeight: 600, color: '#fff' }}>{selectedOrder.shipping_name || selectedOrder.user_name}</div>
                <div style={{ fontSize: '0.85rem', color: '#aaa' }}>{selectedOrder.shipping_phone || selectedOrder.user_phone}</div>
                <div style={{ fontSize: '0.85rem', color: '#aaa' }}>{selectedOrder.user_email}</div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#b99a58', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
                  Fulfillment Destination
                </span>
                {selectedOrder.fulfillment_type === 'pickup' ? (
                  <div style={{ fontSize: '0.85rem', color: '#fff' }}>
                    <strong>Flagship Atelier In-Store Pickup</strong><br />
                    Sathy Road, Kurumbampalayam, Coimbatore - 641107
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#ccc' }}>
                    {selectedOrder.shipping_address_line1}<br />
                    {selectedOrder.shipping_address_line2 && <>{selectedOrder.shipping_address_line2}<br /></>}
                    {selectedOrder.shipping_city}, {selectedOrder.shipping_state} - {selectedOrder.shipping_postal_code}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#e5e5e5' }}>Ordered Garments</h3>
              <div style={{ border: '1px solid #222', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#111', color: '#888', borderBottom: '1px solid #222' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Size</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{item.productName || item.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>SKU: {item.sku}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#ccc' }}>{item.size}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#fff' }}>{item.quantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#aaa' }}>{formatCurrency(item.unitPrice || item.unit_price)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                          {formatCurrency((item.unitPrice || item.unit_price) * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
              <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal ?? selectedOrder.subtotal_amount)}</span>
                </div>
                {Number(selectedOrder.discount ?? selectedOrder.discount_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ed573' }}>
                    <span>Coupon Discount:</span>
                    <span>- {formatCurrency(selectedOrder.discount ?? selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                  <span>GST Tax:</span>
                  <span>{formatCurrency(selectedOrder.tax ?? selectedOrder.tax_amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontWeight: 700, fontSize: '1rem', borderTop: '1px solid #333', paddingTop: '6px', marginTop: '4px' }}>
                  <span>Grand Total:</span>
                  <span>{formatCurrency(selectedOrder.total ?? selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Status Update Form */}
            <form onSubmit={handleUpdateStatus} style={{ background: '#111', padding: '1rem', borderRadius: '4px', border: '1px solid #222' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#fff' }}>
                Update Fulfillment & Dispatch
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>Order Status</label>
                  <select
                    className={styles.selectInput}
                    value={statusToUpdate}
                    onChange={(e) => setStatusToUpdate(e.target.value)}
                  >
                    {ORDER_STATUSES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Courier Tracking Number (BlueDart / DTDC)</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="e.g. BD7829102IN"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
                <a
                  href={api.getApiUrl(`/invoices/${selectedOrder.id}/pdf`)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.btnSecondary}
                >
                  <FileText size={14} /> Download PDF Invoice
                </a>
                <button type="submit" className={styles.btnPrimary} disabled={updatingStatus}>
                  {updatingStatus ? 'Updating...' : 'Save Order Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
