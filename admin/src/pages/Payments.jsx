import { useEffect, useState } from 'react';
import { CreditCard, RotateCcw, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Refund Modal State
  const [refundPayment, setRefundPayment] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/payments/all');
      setPayments(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load transaction ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const openRefundModal = (payment) => {
    setRefundPayment(payment);
    setRefundAmount(payment.amount);
  };

  const handleProcessRefund = async (e) => {
    e.preventDefault();
    if (!refundPayment) return;
    setSubmittingRefund(true);
    setError('');
    setSuccess('');

    try {
      await api.post(`/payments/${refundPayment.id}/refund`, {
        refundAmount: Number(refundAmount),
        refundStatus: 'pending',
      });
      setSuccess(`Refund request of ₹${refundAmount} recorded (Pending Gateway Confirmation) for transaction #${refundPayment.id}`);
      setRefundPayment(null);
      loadPayments();
    } catch (err) {
      setError(err.message || 'Failed to process refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleCollectCod = async (paymentId) => {
    try {
      setError('');
      setSuccess('');
      await api.post(`/payments/${paymentId}/collect-cod`);
      setSuccess(`COD payment transaction #${paymentId} marked as collected and paid.`);
      loadPayments();
    } catch (err) {
      setError(err.message || 'Failed to record COD payment collection');
    }
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  const getStatusBadge = (st, refundSt) => {
    if (refundSt === 'pending') {
      return `${styles.badge} ${styles.badgeWarning}`;
    }
    if (refundSt === 'failed') {
      return `${styles.badge} ${styles.badgeDanger}`;
    }
    switch (st) {
      case 'paid':
      case 'success':
        return `${styles.badge} ${styles.badgeSuccess}`;
      case 'refunded':
        return `${styles.badge} ${styles.badgeInfo}`;
      case 'failed':
        return `${styles.badge} ${styles.badgeDanger}`;
      default:
        return `${styles.badge} ${styles.badgeWarning}`;
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Financial Ledger & Transactions</h1>
          <p className={styles.subtitle}>Verified Razorpay gateway captures, patron payments, and settlements</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={loadPayments}>
            <RefreshCw size={14} /> Refresh Transactions
          </button>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Related Transaction</th>
              <th>Patron</th>
              <th>Gateway / Method</th>
              <th>Gateway Ref</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Timestamp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length > 0 ? (
              payments.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong style={{ color: '#111111' }}>#{p.id}</strong>
                  </td>
                  <td>
                    {p.order_number ? (
                      <div>
                        <span className={`${styles.badge} ${styles.badgeDefault}`}>Purchase</span>
                        <div style={{ fontSize: '0.8rem', color: '#666666', marginTop: '2px' }}>Order #{p.order_number}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#666666' }}>Direct</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#111111' }}>{p.customer_name || 'Client'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>{p.customer_email}</div>
                  </td>
                  <td>
                    <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', color: '#b99a58' }}>
                      {p.provider}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.75rem', color: '#666666', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.provider_payment_id || p.provider_order_id || '—'}
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: '#111111', fontSize: '0.95rem' }}>{formatCurrency(p.amount)}</strong>
                    {Number(p.refund_amount) > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#3498db' }}>
                        Refunded: {formatCurrency(p.refund_amount)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={getStatusBadge(p.status, p.refund_status)}>
                      {p.refund_status === 'pending'
                        ? 'Refund Pending'
                        : p.refund_status === 'failed'
                        ? 'Refund Failed'
                        : p.provider === 'cod' && p.status === 'created'
                        ? 'Awaiting Collection'
                        : p.status}
                    </span>
                  </td>
                  <td style={{ color: '#888', fontSize: '0.85rem' }}>
                    {new Date(p.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td>
                    {p.status === 'paid' && p.refund_status !== 'pending' && (
                      <button
                        className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        onClick={() => openRefundModal(p)}
                        title={p.refund_status === 'failed' ? 'Retry Processing Refund' : 'Request Transaction Refund'}
                      >
                        <RotateCcw size={12} /> {p.refund_status === 'failed' ? 'Retry Refund' : 'Refund'}
                      </button>
                    )}
                    {p.provider === 'cod' && p.status === 'created' && (
                      <button
                        className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        onClick={() => handleCollectCod(p.id)}
                        title="Confirm Physical Cash Collection"
                      >
                        <CheckCircle size={12} /> Collect COD
                      </button>
                    )}
                    {p.refund_status === 'pending' && (
                      <span style={{ fontSize: '0.75rem', color: '#b99a58', fontStyle: 'italic' }}>
                        Awaiting Gateway
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className={styles.emptyState}>
                  {loading ? 'Retrieving transaction records...' : 'No transactions recorded in ledger.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Refund Modal */}
      {refundPayment && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '480px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Process Transaction Refund</h2>
                <span className={styles.subtitle}>Payment #{refundPayment.id} ({formatCurrency(refundPayment.amount)})</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setRefundPayment(null)}>×</button>
            </div>

            <form onSubmit={handleProcessRefund}>
              <div className={styles.formGroup} style={{ marginBottom: '1rem' }}>
                <label>Refund Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={refundPayment.amount}
                  className={styles.input}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: '#888' }}>
                  Maximum refundable: {formatCurrency(refundPayment.amount)}
                </span>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setRefundPayment(null)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submittingRefund}>
                  {submittingRefund ? 'Processing...' : 'Authorize Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
