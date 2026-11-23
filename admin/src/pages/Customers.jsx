import { useEffect, useState } from 'react';
import { Search, UserCheck, UserX, Eye, ShoppingBag, Calendar, Mail, Phone } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected customer details
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams();
      if (search) q.set('search', search);

      const res = await api.get(`/customers?${q.toString()}`);
      setCustomers(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch customer directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadCustomers();
  };

  const openCustomerDetails = async (id) => {
    try {
      setDetailsLoading(true);
      setSelectedCustomer(null);
      const res = await api.get(`/customers/${id}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load patron record');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleToggleStatus = async (customer) => {
    const nextStatus = !customer.is_active;
    const action = nextStatus ? 'activate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} account for ${customer.full_name}?`)) return;

    try {
      setError('');
      setSuccess('');
      await api.patch(`/customers/${customer.id}/status`, { isActive: nextStatus });
      setSuccess(`Account status updated for ${customer.full_name}`);
      loadCustomers();
      if (selectedCustomer && selectedCustomer.id === customer.id) {
        setSelectedCustomer(prev => ({ ...prev, is_active: nextStatus }));
      }
    } catch (err) {
      setError(err.message || 'Failed to update account status');
    }
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Patron Registry & Client Relations</h1>
          <p className={styles.subtitle}>Directory of registered luxury clients and purchase profiles</p>
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
            placeholder="Search patron by name, email, or telephone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className={styles.btnSecondary}>Search</button>
      </form>

      {/* Customers Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Patron Name</th>
              <th>Contact Details</th>
              <th>Joined Date</th>
              <th>Orders</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length > 0 ? (
              customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong style={{ color: '#111111', fontSize: '0.95rem' }}>{c.full_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>ID: #{c.id}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', color: '#111111' }}>{c.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>{c.phone || 'No phone recorded'}</div>
                  </td>
                  <td style={{ color: '#666666', fontSize: '0.85rem' }}>
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeDefault}`}>
                      {c.orders_count || 0} Orders
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: c.role === 'admin' ? '#b99a58' : '#aaa' }}>
                      {c.role}
                    </span>
                  </td>
                  <td>
                    {c.is_active ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeDanger}`}>Suspended</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className={styles.btnSecondary} onClick={() => openCustomerDetails(c.id)} title="View Client Dossier">
                        <Eye size={14} /> View
                      </button>
                      <button
                        className={c.is_active ? styles.btnDanger : styles.btnSecondary}
                        onClick={() => handleToggleStatus(c)}
                        title={c.is_active ? 'Suspend Account' : 'Activate Account'}
                      >
                        {c.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className={styles.emptyState}>
                  {loading ? 'Accessing patron directory...' : 'No customer records match search query.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Dossier Modal */}
      {selectedCustomer && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '750px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>{selectedCustomer.full_name}</h2>
                <span className={styles.subtitle}>
                  Patron since {new Date(selectedCustomer.created_at).toLocaleDateString('en-IN')} | Role: {selectedCustomer.role}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedCustomer(null)}>×</button>
            </div>

            {/* Profile Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#F7F7F7', padding: '1rem', borderRadius: '4px', border: '1px solid #E5E5E5', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#666666', textTransform: 'uppercase' }}>Email</span>
                <div style={{ color: '#111111', fontSize: '0.9rem' }}>{selectedCustomer.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#666666', textTransform: 'uppercase' }}>Phone</span>
                <div style={{ color: '#111111', fontSize: '0.9rem' }}>{selectedCustomer.phone || 'Not provided'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#666666', textTransform: 'uppercase' }}>Account Status</span>
                <div>
                  {selectedCustomer.is_active ? (
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active Patron</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeDanger}`}>Suspended</span>
                  )}
                </div>
              </div>
            </div>

            {/* Orders History */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#111111', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingBag size={16} color="#666666" /> Sartorial Purchases ({(selectedCustomer.orders || []).length})
              </h3>
              {(selectedCustomer.orders || []).length > 0 ? (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E5E5E5', borderRadius: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#F7F7F7', color: '#666666' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Order #</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.orders.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                          <td style={{ padding: '6px 10px', color: '#111111' }}>#{o.order_number}</td>
                          <td style={{ padding: '6px 10px', color: '#666666' }}>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#111111' }}>{formatCurrency(o.total_amount)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <span className={`${styles.badge} ${styles.badgeDefault}`}>{o.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#666666', padding: '0.5rem 0' }}>No purchase transactions yet.</div>
              )}
              {/* Close Button */}
              <div className={styles.modalFooter} style={{ marginTop: '1.5rem' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setSelectedCustomer(null)}>
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
