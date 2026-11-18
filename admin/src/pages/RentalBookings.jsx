import { useEffect, useState } from 'react';
import { Search, Calendar, Shield, AlertTriangle, CheckCircle, FileText, RotateCcw, Truck } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

const RENTAL_STATUSES = ['requested', 'confirmed', 'picked_up', 'returned', 'overdue', 'cancelled'];

export default function RentalBookings() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Return Processing Modal
  const [returnModalBooking, setReturnModalBooking] = useState(null);
  const [returnCondition, setReturnCondition] = useState('pristine');
  const [damageFee, setDamageFee] = useState(0);
  const [lateFee, setLateFee] = useState(0);
  const [refundStatus, setRefundStatus] = useState('refunded');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadRentals = async () => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams();
      if (statusFilter) q.set('status', statusFilter);
      if (search) q.set('search', search);

      const res = await api.get(`/rentals/all?${q.toString()}`);
      setRentals(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load rental bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRentals();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadRentals();
  };

  const handleDispatch = async (booking) => {
    if (!window.confirm(`Mark rental #${booking.booking_number} as Dispatched / In Client Possession?`)) return;
    try {
      setError('');
      await api.patch(`/rentals/${booking.id}/status`, { status: 'picked_up' });
      setSuccess(`Rental #${booking.booking_number} marked as Picked Up`);
      loadRentals();
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleConfirmBooking = async (booking) => {
    try {
      setError('');
      await api.patch(`/rentals/${booking.id}/status`, { status: 'confirmed' });
      setSuccess(`Rental #${booking.booking_number} confirmed`);
      loadRentals();
    } catch (err) {
      setError(err.message || 'Failed to confirm booking');
    }
  };

  const openReturnModal = (booking) => {
    setReturnModalBooking(booking);
    setReturnCondition('pristine');
    setDamageFee(0);

    // Calculate suggestion for late fee if end date is in the past
    const endDate = new Date(booking.end_date);
    const now = new Date();
    let suggestedLateFee = 0;
    if (now > endDate) {
      const diffDays = Math.ceil((now - endDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) suggestedLateFee = diffDays * 500;
    }
    setLateFee(suggestedLateFee);
    setRefundStatus(suggestedLateFee > 0 ? 'partial_refund' : 'refunded');
  };

  const calculateDepositRefund = () => {
    if (!returnModalBooking) return 0;
    const deposit = Number(returnModalBooking.deposit_amount || returnModalBooking.security_deposit) || 0;
    const totalDeductions = (Number(damageFee) || 0) + (Number(lateFee) || 0);
    return Math.max(0, deposit - totalDeductions);
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    if (!returnModalBooking) return;
    setSubmittingReturn(true);
    setError('');
    setSuccess('');

    try {
      const refundedAmount = calculateDepositRefund();
      await api.post(`/rentals/${returnModalBooking.id}/return`, {
        returnCondition,
        damageFee: Number(damageFee) || 0,
        lateFee: Number(lateFee) || 0,
        depositRefundStatus: refundStatus,
        depositRefundedAmount: refundedAmount,
      });

      setSuccess(`Garment return processed for #${returnModalBooking.booking_number}. Deposit refund: ₹${refundedAmount}`);
      setReturnModalBooking(null);
      loadRentals();
    } catch (err) {
      setError(err.message || 'Failed to record return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'picked_up':
      case 'active': return `${styles.badge} ${styles.badgeInfo}`;
      case 'confirmed': return `${styles.badge} ${styles.badgeSuccess}`;
      case 'returned': return `${styles.badge} ${styles.badgeSuccess}`;
      case 'overdue': return `${styles.badge} ${styles.badgeDanger}`;
      case 'cancelled': return `${styles.badge} ${styles.badgeDanger}`;
      case 'requested':
      default: return `${styles.badge} ${styles.badgeWarning}`;
    }
  };

  const formatStatus = (st) => {
    switch (st) {
      case 'picked_up': return 'Picked Up';
      case 'requested': return 'Requested';
      case 'confirmed': return 'Confirmed';
      case 'returned': return 'Returned';
      case 'overdue': return 'Overdue';
      case 'cancelled': return 'Cancelled';
      default: return st ? st.charAt(0).toUpperCase() + st.slice(1) : '';
    }
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Luxury Blazer Rental Operations</h1>
          <p className={styles.subtitle}>Track client rental schedules, dispatch, returns and security deposit reconciliations</p>
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
            placeholder="Search by booking #, client name, or blazer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.selectInput}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Rental Statuses</option>
          {RENTAL_STATUSES.map(s => (
            <option key={s} value={s}>{formatStatus(s)}</option>
          ))}
        </select>
        <button type="submit" className={styles.btnSecondary}>Search</button>
      </form>

      {/* Rental Bookings Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Booking Ref</th>
              <th>Blazer & Size</th>
              <th>Patron</th>
              <th>Rental Window</th>
              <th>Rental Fee</th>
              <th>Deposit Held</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rentals.length > 0 ? (
              rentals.map(r => (
                <tr key={r.id}>
                  <td>
                    <strong style={{ color: '#111111', letterSpacing: '0.05em' }}>
                      #{r.booking_number || r.id}
                    </strong>
                    {r.invoice_number && (
                      <div style={{ fontSize: '0.75rem', color: '#b99a58' }}>
                        Inv: {r.invoice_number}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111111' }}>{r.product_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>Size: {r.size}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#111111' }}>{r.customer_name || 'Client'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>{r.customer_phone || r.customer_email}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', color: '#555555' }}>
                      {new Date(r.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} &rarr;{' '}
                      {new Date(r.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>
                      {r.rental_days || r.duration_days || 1} Days Duration
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: '#111111' }}>{formatCurrency(r.rent_amount || r.rental_fee)}</strong>
                  </td>
                  <td>
                    <span style={{ color: '#b99a58', fontWeight: 600 }}>
                      {formatCurrency(r.deposit_amount || r.security_deposit)}
                    </span>
                    {r.deposit_refund_status && (
                      <div style={{ fontSize: '0.75rem', color: '#666666' }}>
                        {r.deposit_refund_status}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={getStatusBadge(r.status)}>
                      {formatStatus(r.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {r.status === 'requested' && (
                        <button
                          className={styles.btnSecondary}
                          onClick={() => handleConfirmBooking(r)}
                          title="Confirm Reservation"
                        >
                          <CheckCircle size={14} /> Confirm
                        </button>
                      )}

                      {(r.status === 'confirmed' || r.status === 'requested') && (
                        <button
                          className={styles.btnSecondary}
                          onClick={() => handleDispatch(r)}
                          title="Mark Dispatched / Picked Up"
                        >
                          <Truck size={14} /> Handover
                        </button>
                      )}

                      {(r.status === 'picked_up' || r.status === 'active' || r.status === 'overdue' || r.status === 'confirmed') && (
                        <button
                          className={styles.btnPrimary}
                          onClick={() => openReturnModal(r)}
                          title="Process Return & Inspect"
                          style={{ padding: '0.35rem 0.65rem' }}
                        >
                          <RotateCcw size={14} /> Return
                        </button>
                      )}

                      <a
                        href={api.getApiUrl(`/invoices/${r.id}/pdf`)}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.btnSecondary}
                        title="Download Rental Invoice"
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
                  {loading ? 'Retrieving rentals...' : 'No rental bookings matching filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Return & Deposit Settlement Modal */}
      {returnModalBooking && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '650px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Inspect & Settle Rental #{returnModalBooking.booking_number}</h2>
                <span className={styles.subtitle}>
                  Garment: {returnModalBooking.product_name} (Size: {returnModalBooking.size})
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setReturnModalBooking(null)}>×</button>
            </div>

            <form onSubmit={handleProcessReturn}>
              <div style={{ background: '#F7F7F7', padding: '1rem', borderRadius: '4px', border: '1px solid #E5E5E5', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#666666', display: 'block' }}>Patron:</span>
                    <strong style={{ color: '#111111' }}>{returnModalBooking.customer_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#666666', display: 'block' }}>Scheduled Return Date:</span>
                    <strong style={{ color: '#111111' }}>
                      {new Date(returnModalBooking.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#666666', display: 'block' }}>Security Deposit Held:</span>
                    <strong style={{ color: '#b99a58', fontSize: '1.1rem' }}>
                      {formatCurrency(returnModalBooking.deposit_amount || returnModalBooking.security_deposit)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#666666', display: 'block' }}>Rental Charge Paid:</span>
                    <strong style={{ color: '#111111' }}>
                      {formatCurrency(returnModalBooking.rent_amount || returnModalBooking.rental_fee)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Garment Condition After Atelier Inspection *</label>
                  <select
                    required
                    className={styles.selectInput}
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                  >
                    <option value="pristine">Pristine / Excellent (No damages, standard dry cleaning)</option>
                    <option value="good">Good (Normal minor wear, no fabric tears)</option>
                    <option value="minor_wear">Minor Wear / Light Stains (Professional spot treatment needed)</option>
                    <option value="damaged">Damaged (Fabric tear, burn, missing brass buttons)</option>
                    <option value="lost">Lost / Unreturned (Total garment loss)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Damage Assessment Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={damageFee}
                    onChange={(e) => setDamageFee(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Late Return Penalty (₹500/day)</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={lateFee}
                    onChange={(e) => setLateFee(e.target.value)}
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Security Deposit Refund Status</label>
                  <select
                    className={styles.selectInput}
                    value={refundStatus}
                    onChange={(e) => setRefundStatus(e.target.value)}
                  >
                    <option value="refunded">Full Refund Processed</option>
                    <option value="partial_refund">Partial Refund (After Deductions)</option>
                    <option value="forfeited">Forfeited (Severe Damage / Lost Garment)</option>
                    <option value="pending">Pending Final Inspection</option>
                  </select>
                </div>

                {/* Refund Balance Calculation Box */}
                <div className={`${styles.formGroup} ${styles.formFull}`} style={{ background: '#F7F7F7', padding: '1rem', borderRadius: '4px', border: '1px solid #E5E5E5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Refund Payable to Patron
                      </span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e824c', marginTop: '2px' }}>
                        {formatCurrency(calculateDepositRefund())}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666666', textAlign: 'right' }}>
                      Deposit ({formatCurrency(returnModalBooking.security_deposit)})<br />
                      - Deductions ({formatCurrency((Number(damageFee) || 0) + (Number(lateFee) || 0))})
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setReturnModalBooking(null)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submittingReturn}>
                  {submittingReturn ? 'Settling...' : 'Confirm Return & Settle Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
