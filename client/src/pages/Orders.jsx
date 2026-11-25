import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import DownloadInvoiceButton from '../components/common/DownloadInvoiceButton';
import { useDocumentSeo } from '../utils/seo';
import styles from './Orders.module.css';

export default function Orders() {
  useDocumentSeo({
    title: 'My Orders | MAJESTIC BLAZER',
    description: 'View your Majestic Blazer purchase orders and tax invoices.',
    path: '/orders',
    noindex: true,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await api.get('/orders/mine');
        setOrders(res.data || []);
      } catch (err) {
        console.error('Failed to load orders', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CLIENT DASHBOARD</span>
          <h1>Your Purchase Orders</h1>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading order archives...</div>
      ) : orders.length > 0 ? (
        <div className={styles.orderList}>
          {orders.map((order) => (
            <article key={order.id} className={styles.orderCard}>
              <div className={styles.orderTop}>
                <div>
                  <span className={styles.orderNoLabel}>ORDER NUMBER</span>
                  <Link to={`/orders/${order.id}`} className={styles.orderNumberLink}>
                    <strong>{order.order_number}</strong>
                  </Link>
                  <span className={styles.orderDate}>
                    Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className={styles.topRight}>
                  <span className={`${styles.statusPill} ${styles[order.status]}`}>
                    {order.status.toUpperCase()}
                  </span>
                  <DownloadInvoiceButton
                    invoiceIdentifier={order.invoice_number || order.order_number || order.id}
                    orderNumber={order.order_number}
                    label="Invoice (PDF)"
                    variant="outline"
                    size="sm"
                  />
                </div>
              </div>

              <div className={styles.itemList}>
                {order.items?.map((item) => (
                  <div key={item.id} className={styles.itemRow}>
                    <img src={item.imageUrl} alt={item.productName} className={styles.itemImg} loading="lazy" decoding="async" width="80" height="100" />
                    <div className={styles.itemInfo}>
                      <Link to={`/products/${item.productSlug}`} className={styles.itemName}>
                        {item.productName}
                      </Link>
                      <span className={styles.itemMeta}>Size: {item.size} • Qty: {item.quantity} • SKU: {item.sku}</span>
                    </div>
                    <span className={styles.itemTotal}>
                      ₹{(Number(item.unitPrice) * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.orderBottom}>
                <div className={styles.deliveryNote}>
                  <span>Method: <strong>{order.delivery_type === 'pickup' ? 'Flagship Boutique Collection (Coimbatore)' : 'Insured Courier Delivery'}</strong></span>
                  {order.tracking_number && <span>Tracking: {order.tracking_number}</span>}
                </div>
                <div className={styles.bottomRightActions}>
                  <Link to={`/orders/${order.id}`} className={styles.viewDetailsBtn}>
                    <span>View Order Details</span>
                    <ArrowRight size={13} />
                  </Link>
                  <div className={styles.totalBlock}>
                    <span>Total Payable:</span>
                    <strong className={styles.totalPrice}>₹{Number(order.total).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Package size={48} className={styles.emptyIcon} />
          <h3>No purchase orders yet</h3>
          <p>Explore our bespoke collection of formal blazers, midnight velvets, and double-breasted suits.</p>
          <Link to="/shop" className={styles.shopBtn}>Explore Collection</Link>
        </div>
      )}
    </div>
  );
}
