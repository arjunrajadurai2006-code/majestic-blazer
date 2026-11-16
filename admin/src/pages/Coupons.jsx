import { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, Search, CheckCircle, Percent, DollarSign, Calendar } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderValue: '0',
    maxDiscount: '',
    usageLimit: '',
    validFrom: '',
    validTo: '',
    isActive: true,
  });

  const loadCoupons = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/coupons');
      setCoupons(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load privilege coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      await api.post('/coupons', {
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        validFrom: formData.validFrom || null,
        validTo: formData.validTo || null,
        isActive: formData.isActive,
      });

      setSuccess(`Privilege coupon ${formData.code.toUpperCase()} created successfully.`);
      setIsModalOpen(false);
      setFormData({
        code: '',
        discountType: 'percentage',
        discountValue: '',
        minOrderValue: '0',
        maxDiscount: '',
        usageLimit: '',
        validFrom: '',
        validTo: '',
        isActive: true,
      });
      loadCoupons();
    } catch (err) {
      setError(err.message || 'Failed to create coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to retire privilege coupon ${code}?`)) return;
    try {
      setError('');
      await api.delete(`/coupons/${id}`);
      setSuccess(`Privilege coupon ${code} deleted.`);
      loadCoupons();
    } catch (err) {
      setError(err.message || 'Failed to delete coupon');
    }
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch = c.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' ? true : statusFilter === 'active' ? c.is_active : !c.is_active;
    return matchesSearch && matchesStatus;
  });

  const totalRedemptions = coupons.reduce((sum, c) => sum + (Number(c.times_used) || 0), 0);
  const activeCouponsCount = coupons.filter((c) => c.is_active).length;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Privilege Coupons & Vouchers</h1>
          <p className={styles.subtitle}>Configure client promotional codes, bespoke incentives and seasonal discounts</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      {/* Overview Metric Cards */}
      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Total Issued Codes</span>
            <Tag size={16} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{coupons.length}</div>
          <div className={styles.kpiMeta}>{activeCouponsCount} currently active for patrons</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Lifetime Redemptions</span>
            <CheckCircle size={16} color="#2ed573" />
          </div>
          <div className={styles.kpiValue}>{totalRedemptions}</div>
          <div className={styles.kpiMeta}>Orders completed using privilege codes</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search size={18} color="#888" style={{ marginRight: '8px' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by coupon code (e.g., MAJESTIC10)..."
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
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Coupons Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Benefit</th>
              <th>Min Order</th>
              <th>Max Discount</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCoupons.length > 0 ? (
              filteredCoupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: '#ffffff',
                      background: '#1f1f1f',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #333'
                    }}>
                      {c.code}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#fff' }}>
                      {c.discount_type === 'percentage'
                        ? `${c.discount_value}% OFF`
                        : `${formatCurrency(c.discount_value)} OFF`}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                      {c.discount_type === 'percentage' ? 'Percentage Deduction' : 'Fixed Rupee Deduction'}
                    </div>
                  </td>
                  <td>
                    {Number(c.min_order_value) > 0 ? formatCurrency(c.min_order_value) : 'No Minimum'}
                  </td>
                  <td>
                    {c.max_discount ? formatCurrency(c.max_discount) : 'Unlimited'}
                  </td>
                  <td>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{c.times_used}</span>
                    <span style={{ color: '#888' }}>
                      {c.usage_limit ? ` / ${c.usage_limit}` : ' (No limit)'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${c.is_active ? styles.badgeSuccess : styles.badgeDanger}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => handleDelete(c.id, c.code)}
                      style={{ padding: '0.35rem 0.65rem', color: '#ff4757', borderColor: '#442222' }}
                      title="Delete Coupon"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className={styles.emptyState}>
                  {loading ? 'Retrieving coupons...' : 'No privilege coupons found matching filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Coupon Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '560px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Create Privilege Voucher</h2>
                <span className={styles.subtitle}>Configure a luxury promotion code for customer checkout</span>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateCoupon}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Voucher Code (uppercase) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FESTIVE2026"
                    className={styles.input}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Discount Type *</label>
                  <select
                    className={styles.selectInput}
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder={formData.discountType === 'percentage' ? 'e.g. 15' : 'e.g. 1000'}
                    className={styles.input}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Minimum Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for none"
                    className={styles.input}
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Maximum Cap (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty for unlimited"
                    className={styles.input}
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Usage Limit (Redemptions)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    className={styles.input}
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Initial Status</label>
                  <select
                    className={styles.selectInput}
                    value={formData.isActive ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                  >
                    <option value="true">Active & Ready</option>
                    <option value="false">Inactive / Draft</option>
                  </select>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Issue Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
