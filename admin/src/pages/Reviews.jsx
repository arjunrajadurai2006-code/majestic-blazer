import { useEffect, useState } from 'react';
import { Star, Search, CheckCircle, XCircle, MessageSquare, ShieldCheck, Filter } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const loadReviews = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/reviews/all');
      setReviews(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleToggleApproval = async (id, currentStatus) => {
    try {
      setUpdatingId(id);
      setError('');
      setSuccess('');
      const res = await api.patch(`/reviews/${id}/approve`, {
        isApproved: !currentStatus,
      });

      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_approved: res.data.is_approved } : r))
      );
      setSuccess(`Review #${id} ${!currentStatus ? 'approved and published' : 'hidden from catalog'}.`);
    } catch (err) {
      setError(err.message || 'Failed to update review approval');
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStars = (rating) => {
    return (
      <div style={{ display: 'flex', gap: '2px', color: '#e5e5e5' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            fill={star <= rating ? '#ffffff' : 'none'}
            color={star <= rating ? '#ffffff' : '#555'}
          />
        ))}
      </div>
    );
  };

  const filteredReviews = reviews.filter((r) => {
    const term = search.toLowerCase();
    const matchesSearch =
      (r.product_name && r.product_name.toLowerCase().includes(term)) ||
      (r.user_name && r.user_name.toLowerCase().includes(term)) ||
      (r.title && r.title.toLowerCase().includes(term)) ||
      (r.comment && r.comment.toLowerCase().includes(term));
    const matchesRating = ratingFilter === '' ? true : Number(r.rating) === Number(ratingFilter);
    const matchesStatus =
      statusFilter === '' ? true : statusFilter === 'approved' ? r.is_approved : !r.is_approved;
    return matchesSearch && matchesRating && matchesStatus;
  });

  const totalReviews = reviews.length;
  const approvedCount = reviews.filter((r) => r.is_approved).length;
  const averageRating =
    totalReviews > 0
      ? (reviews.reduce((sum, r) => sum + Number(r.rating), 0) / totalReviews).toFixed(1)
      : '0.0';

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Patron Testimonials & Reviews</h1>
          <p className={styles.subtitle}>Curate customer feedback, verify authenticity and manage published ratings</p>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      {/* KPI Stats */}
      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Average Atelier Rating</span>
            <Star size={16} color="#ffffff" />
          </div>
          <div className={styles.kpiValue} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span>{averageRating}</span>
            <span style={{ fontSize: '1rem', color: '#888' }}>/ 5.0</span>
          </div>
          <div className={styles.kpiMeta}>Calculated across all client submissions</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Total Testimonials</span>
            <MessageSquare size={16} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{totalReviews}</div>
          <div className={styles.kpiMeta}>{approvedCount} verified and visible on product pages</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Approval Rate</span>
            <ShieldCheck size={16} color="#2ed573" />
          </div>
          <div className={styles.kpiValue}>
            {totalReviews > 0 ? `${Math.round((approvedCount / totalReviews) * 100)}%` : '0%'}
          </div>
          <div className={styles.kpiMeta}>Satisfies atelier quality standards</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search size={18} color="#888" style={{ marginRight: '8px' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by blazer title, patron name or comment keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.selectInput}
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
        >
          <option value="">All Ratings</option>
          <option value="5">5 Stars Only</option>
          <option value="4">4 Stars Only</option>
          <option value="3">3 Stars Only</option>
          <option value="2">2 Stars Only</option>
          <option value="1">1 Star Only</option>
        </select>
        <select
          className={styles.selectInput}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Approval Statuses</option>
          <option value="approved">Approved & Visible</option>
          <option value="pending">Pending / Hidden</option>
        </select>
      </div>

      {/* Reviews Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Blazer</th>
              <th>Patron</th>
              <th>Rating</th>
              <th>Testimonial</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length > 0 ? (
              filteredReviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong style={{ color: '#111111' }}>{r.product_name}</strong>
                    {r.product_slug && (
                      <div style={{ fontSize: '0.75rem', color: '#666666' }}>
                        {r.product_slug}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111111' }}>{r.user_name || 'Client'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666666' }}>{r.user_email}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {renderStars(r.rating)}
                      <span style={{ fontSize: '0.75rem', color: '#666666', fontWeight: 600 }}>{r.rating} / 5</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: '340px' }}>
                    {r.title && (
                      <div style={{ fontWeight: 600, color: '#111111', marginBottom: '2px', fontSize: '0.85rem' }}>
                        &ldquo;{r.title}&rdquo;
                      </div>
                    )}
                    <div style={{ fontSize: '0.82rem', color: '#333333', lineHeight: '1.4' }}>
                      {r.comment}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${r.is_approved ? styles.badgeSuccess : styles.badgeWarning}`}>
                      {r.is_approved ? 'Approved' : 'Pending Review'}
                    </span>
                  </td>
                  <td style={{ color: '#666666', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td>
                    <button
                      className={r.is_approved ? styles.btnSecondary : styles.btnPrimary}
                      onClick={() => handleToggleApproval(r.id, r.is_approved)}
                      disabled={updatingId === r.id}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    >
                      {updatingId === r.id
                        ? 'Updating...'
                        : r.is_approved
                        ? 'Hide Review'
                        : 'Approve & Publish'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className={styles.emptyState}>
                  {loading ? 'Retrieving reviews...' : 'No patron testimonials found matching filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
