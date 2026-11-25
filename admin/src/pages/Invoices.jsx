import { useEffect, useState } from 'react';
import { FileText, Download, Printer, Search, RefreshCw, Receipt } from 'lucide-react';
import { api } from '../services/api';
import ThermalReceiptModal from '../components/ThermalReceiptModal';
import styles from '../styles/adminShared.module.css';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [thermalReceiptInvoiceId, setThermalReceiptInvoiceId] = useState(null);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/invoices/all?limit=500');
      setInvoices(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  const filteredInvoices = invoices.filter(inv => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.order_number?.toLowerCase().includes(term) ||
      inv.booking_number?.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Tax Invoices Archive</h1>
          <p className={styles.subtitle}>Official GST-compliant tax invoices and sartorial purchase bills</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={loadInvoices}>
            <RefreshCw size={14} /> Refresh Archive
          </button>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search size={18} color="#888" style={{ marginRight: '8px' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by invoice #, patron name, or order ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Transaction Type</th>
              <th>Reference</th>
              <th>Patron</th>
              <th>Issued Date</th>
              <th>Subtotal</th>
              <th>Security Deposit</th>
              <th>Tax (GST)</th>
              <th>Total Amount</th>
              <th>Download PDF</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map(inv => {
                return (
                  <tr key={inv.id}>
                    <td>
                      <strong style={{ color: '#111111', letterSpacing: '0.05em' }}>
                        {inv.invoice_number}
                      </strong>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeDefault}`}>Purchase</span>
                    </td>
                    <td style={{ color: '#666666', fontSize: '0.85rem' }}>
                      {inv.order_number ? `#${inv.order_number}` : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: '#111111' }}>{inv.customer_name || 'Client'}</span>
                    </td>
                    <td style={{ color: '#666666', fontSize: '0.85rem' }}>
                      {new Date(inv.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>{formatCurrency(inv.subtotal_amount)}</td>
                    <td>
                      {Number(inv.deposit_amount) > 0 ? (
                        <span style={{ color: '#b99a58', fontWeight: 600 }}>
                          {formatCurrency(inv.deposit_amount)}
                        </span>
                      ) : (
                        <span style={{ color: '#888888' }}>—</span>
                      )}
                    </td>
                    <td>{formatCurrency(inv.tax_amount)}</td>
                    <td>
                      <strong style={{ color: '#111111', fontSize: '0.95rem' }}>
                        {formatCurrency(inv.total_amount)}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a
                          href={api.getApiUrl(`/invoices/${inv.id}/pdf`)}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.btnSecondary}
                          style={{ padding: '0.35rem 0.65rem' }}
                          title="Open / Download Official A4 PDF"
                        >
                          <Download size={14} /> PDF
                        </a>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '0.35rem 0.65rem' }}
                          onClick={() => setThermalReceiptInvoiceId(inv.id)}
                          title="Generate / Print 80mm Thermal Receipt"
                        >
                          <Receipt size={14} /> Thermal
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className={styles.emptyState}>
                  {loading ? 'Retrieving invoices archive...' : 'No invoices found matching query.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 80mm Thermal Receipt Modal */}
      {thermalReceiptInvoiceId && (
        <ThermalReceiptModal
          orderId={thermalReceiptInvoiceId}
          onClose={() => setThermalReceiptInvoiceId(null)}
        />
      )}
    </div>
  );
}
