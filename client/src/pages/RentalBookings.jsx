import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Shield, Clock, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import DownloadInvoiceButton from '../components/common/DownloadInvoiceButton';
import styles from './RentalBookings.module.css';

export default function RentalBookings() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRentals() {
      try {
        const res = await api.get('/rentals/mine');
        setRentals(res.data || []);
      } catch (err) {
        console.error('Failed to load rentals', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRentals();
  }, []);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CLIENT DASHBOARD</span>
          <h1>Your Occasion Rentals</h1>
        </div>
        <Link to="/orders" className={styles.orderLink}>View Purchase Orders →</Link>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading rental ledger...</div>
      ) : rentals.length > 0 ? (
        <div className={styles.rentalList}>
          {rentals.map((rental) => (
            <article key={rental.id} className={styles.rentalCard}>
              <div className={styles.rentalTop}>
                <div>
                  <span className={styles.bookingNoLabel}>BOOKING REFERENCE</span>
                  <strong>{rental.booking_number}</strong>
                  <span className={styles.bookingDate}>
                    Booked on {new Date(rental.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div className={styles.topRight}>
                  <span className={`${styles.statusPill} ${styles[rental.status]}`}>
                    {rental.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <DownloadInvoiceButton
                    invoiceIdentifier={rental.invoice_number || rental.booking_number || rental.id}
                    orderNumber={rental.booking_number}
                    label="Rental Invoice (PDF)"
                    variant="outline"
                    size="sm"
                  />
                </div>
              </div>

              <div className={styles.itemRow}>
                <img src={rental.image_url} alt={rental.product_name} className={styles.itemImg} />
                <div className={styles.itemDetails}>
                  <Link to={`/products/${rental.product_slug}`} className={styles.itemName}>
                    {rental.product_name}
                  </Link>
                  <span className={styles.itemMeta}>Size: {rental.size} • SKU: {rental.sku}</span>

                  <div className={styles.scheduleBadge}>
                    <Calendar size={15} className={styles.calIcon} />
                    <span>
                      {new Date(rental.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} –{' '}
                      {new Date(rental.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ({rental.rental_days} Days)
                    </span>
                  </div>
                </div>

                <div className={styles.financialCol}>
                  <div className={styles.finRow}>
                    <span>Rental Charge:</span>
                    <strong>₹{Number(rental.rent_amount).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className={styles.finRow}>
                    <span>Security Deposit:</span>
                    <strong className={styles.depositVal}>₹{Number(rental.deposit_amount).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              <div className={styles.rentalBottom}>
                <div className={styles.depositStatusBlock}>
                  <Shield size={16} className={styles.shieldIcon} />
                  <div>
                    <span>Deposit Refund Status: <strong>{rental.deposit_refund_status.toUpperCase()}</strong></span>
                    {rental.deposit_refund_status === 'refunded' && (
                      <small>₹{Number(rental.deposit_refunded_amount || rental.deposit_amount).toLocaleString('en-IN')} credited back</small>
                    )}
                  </div>
                </div>

                <div className={styles.totalRow}>
                  <span>Total Paid:</span>
                  <strong className={styles.totalPrice}>
                    ₹{(Number(rental.rent_amount) + Number(rental.deposit_amount)).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <Calendar size={48} className={styles.emptyIcon} />
          <h3>No rental bookings found</h3>
          <p>Rent high-end Italian velvets and tuxedos starting from ₹1,299/day for weddings, galas, and keynotes.</p>
          <Link to="/rent" className={styles.rentBtn}>Browse Rental Collection</Link>
        </div>
      )}
    </div>
  );
}
