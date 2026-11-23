import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Calendar, Users, AlertTriangle, 
  Package, CheckCircle2, XCircle, CreditCard, ArrowUpRight, Clock
} from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [timeRange, setTimeRange] = useState('30d');
  const [chartLoading, setChartLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');
        const [sumRes, revRes] = await Promise.all([
          api.get('/analytics/summary').catch(() => ({ data: {} })),
          api.get(`/analytics/revenue?range=${timeRange}`).catch(() => ({ data: [] })),
        ]);
        setSummary(sumRes.data || {});
        setRevenueTrends(revRes.data || []);
      } catch (err) {
        setError(err.message || 'Failed to load executive overview');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const handleRangeChange = async (newRange) => {
    if (newRange === timeRange) return;
    setTimeRange(newRange);
    setChartLoading(true);
    try {
      const res = await api.get(`/analytics/revenue?range=${newRange}`);
      setRevenueTrends(res.data || []);
    } catch {
      // keep existing trends on failure
    } finally {
      setChartLoading(false);
    }
  };

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  const getOrderStatusBadge = (st) => {
    switch (st) {
      case 'delivered':
      case 'completed': return `${styles.badge} ${styles.badgeSuccess}`;
      case 'shipped':
      case 'confirmed': return `${styles.badge} ${styles.badgeInfo}`;
      case 'cancelled':
      case 'refunded': return `${styles.badge} ${styles.badgeDanger}`;
      default: return `${styles.badge} ${styles.badgeWarning}`;
    }
  };

  if (loading) {
    return <div className={styles.loadingSpinner}>Loading executive dashboard...</div>;
  }

  const recentOrders = summary?.recent_orders || summary?.recentOrders || [];
  const recentCustomers = summary?.recent_customers || summary?.recentCustomers || [];
  const topBlazers = summary?.top_blazers || summary?.topBlazers || [];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Majestic Executive Overview</h1>
          <p className={styles.subtitle}>Sathy Road Atelier & Nationwide Luxury Blazer Operations</p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/products" className={styles.btnPrimary}>Manage Catalog</Link>
          <Link to="/orders" className={styles.btnSecondary}>Fulfill Orders</Link>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}

      {/* Primary KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Total Gross Revenue</span>
            <TrendingUp size={18} color="#e5e5e5" />
          </div>
          <div className={styles.kpiValue}>{formatCurrency(summary?.total_revenue ?? summary?.totalRevenue)}</div>
          <div className={styles.kpiMeta}>
            Retail Sales Turnover
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Purchase Orders</span>
            <ShoppingBag size={18} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_orders ?? summary?.totalOrders ?? 0}</div>
          <div className={styles.kpiMeta}>
            {summary?.pending_orders ?? summary?.pendingOrders ?? 0} awaiting fulfillment
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Registered Patrons</span>
            <Users size={18} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_customers ?? summary?.totalCustomers ?? 0}</div>
          <div className={styles.kpiMeta}>
            Active luxury client accounts
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Active Blazer Catalog</span>
            <Package size={18} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_products ?? summary?.totalProducts ?? 0}</div>
          <div className={styles.kpiMeta}>
            {summary?.total_stock_units ?? summary?.totalStockUnits ?? 0} units across variants
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Completed Orders</span>
            <CheckCircle2 size={18} color="#2ed573" />
          </div>
          <div className={styles.kpiValue} style={{ color: '#2ed573' }}>
            {summary?.completed_orders ?? summary?.completedOrders ?? 0}
          </div>
          <div className={styles.kpiMeta}>
            Successfully delivered to clients
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Cancelled Orders</span>
            <XCircle size={18} color="#ff4757" />
          </div>
          <div className={styles.kpiValue} style={{ color: (summary?.cancelled_orders > 0) ? '#ff4757' : 'inherit' }}>
            {summary?.cancelled_orders ?? summary?.cancelledOrders ?? 0}
          </div>
          <div className={styles.kpiMeta}>
            Order cancellations / voids
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Pending Payments</span>
            <CreditCard size={18} color="#e5a93c" />
          </div>
          <div className={styles.kpiValue} style={{ color: (summary?.pending_payments > 0) ? '#e5a93c' : 'inherit' }}>
            {summary?.pending_payments ?? summary?.pendingPayments ?? 0}
          </div>
          <div className={styles.kpiMeta}>
            Unfinalized checkout sessions
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Low-Stock Blazers</span>
            <AlertTriangle size={18} color="#ffa502" />
          </div>
          <div className={styles.kpiValue} style={{ color: (summary?.low_stock_products > 0) ? '#ffa502' : 'inherit' }}>
            {summary?.low_stock_products ?? summary?.low_stock_count ?? summary?.lowStockCount ?? 0}
          </div>
          <div className={styles.kpiMeta}>
            Products requiring atelier re-order
          </div>
        </div>
      </div>

      {/* Dynamic Revenue Chart with Time Range Filter */}
      <div className={styles.chartBox} style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Revenue Trajectory</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-silver)' }}>
              Sales volume and order revenue trends
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['7d', '30d', '90d', '1y'].map((rng) => (
              <button
                key={rng}
                onClick={() => handleRangeChange(rng)}
                className={timeRange === rng ? styles.btnPrimary : styles.btnSecondary}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                {rng === '7d' ? '7 Days' : rng === '30d' ? '30 Days' : rng === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
        </div>

        {chartLoading ? (
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
            Updating trend graph...
          </div>
        ) : revenueTrends && revenueTrends.length > 0 ? (
          <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={revenueTrends} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.85}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEF" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5E5', color: '#111111', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(val) => [formatCurrency(val), 'Sartorial Sales']}
                />
                <Area type="monotone" dataKey="sales" name="Sartorial Sales" stroke="#111111" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No transaction activity recorded for this period.</div>
        )}
      </div>

      {/* Two Column Layout: Recent Orders & Top-Selling Blazers */}
      <div className={styles.dashboardTwoColGrid}>
        {/* Recent Orders Table */}
        <div className={styles.chartBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Recent Orders</h3>
            <Link to="/orders" className={styles.btnSecondary} style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}>
              View All <ArrowUpRight size={14} style={{ marginLeft: '4px' }} />
            </Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table} style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Patron</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length > 0 ? (
                  recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders?search=${o.order_number}`} style={{ color: '#111111', fontWeight: 600 }}>
                          #{o.order_number}
                        </Link>
                      </td>
                      <td>
                        <div style={{ color: '#111111' }}>{o.customer_name || 'Client'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666666' }}>{o.customer_email}</div>
                      </td>
                      <td>
                        <strong style={{ color: '#111111' }}>{formatCurrency(o.total)}</strong>
                      </td>
                      <td>
                        <span className={getOrderStatusBadge(o.status)}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ color: '#999', fontSize: '0.8rem' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className={styles.emptyState}>No recent orders recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top-Selling Blazers */}
        <div className={styles.chartBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Top-Selling Sartorial Blazers</h3>
            <Link to="/products" className={styles.btnSecondary} style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}>
              Catalog <ArrowUpRight size={14} style={{ marginLeft: '4px' }} />
            </Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table} style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Blazer</th>
                  <th>Category</th>
                  <th>Units Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topBlazers.length > 0 ? (
                  topBlazers.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {b.image_url ? (
                            <img
                              src={b.image_url}
                              alt={b.name}
                              style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 3, border: '1px solid #E5E5E5' }}
                            />
                          ) : (
                            <div style={{ width: 36, height: 48, background: '#F7F7F7', border: '1px solid #E5E5E5', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Package size={16} color="#888" />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#111111' }}>{b.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#666666' }}>{b.category_name || 'Blazer'}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#111111' }}>{b.total_units_sold || 0}</span>
                      </td>
                      <td>
                        <strong style={{ color: '#111111' }}>{formatCurrency(b.revenue)}</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className={styles.emptyState}>No sales data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Patron Registrations & Quick Shortcuts */}
      <div className={styles.dashboardSecondaryGrid}>
        {/* Recent Registered Patrons */}
        <div className={styles.chartBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Recent Patron Registrations</h3>
            <Link to="/customers" className={styles.btnSecondary} style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}>
              View All <ArrowUpRight size={14} style={{ marginLeft: '4px' }} />
            </Link>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table} style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Patron</th>
                  <th>Contact</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCustomers.length > 0 ? (
                  recentCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#111111' }}>{c.full_name}</div>
                      </td>
                      <td>
                        <div style={{ color: '#111111', fontSize: '0.8rem' }}>{c.email}</div>
                        <div style={{ color: '#666666', fontSize: '0.75rem' }}>{c.phone || '—'}</div>
                      </td>
                      <td style={{ color: '#666666', fontSize: '0.8rem' }}>
                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${c.is_active ? styles.badgeSuccess : styles.badgeDanger}`}>
                          {c.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className={styles.emptyState}>No patrons registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Shortcuts & Health */}
        <div className={styles.chartBox}>
          <h3 style={{ marginBottom: '1rem' }}>Atelier Operational Shortcuts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Link to="/products" className={styles.btnSecondary} style={{ justifyContent: 'center', padding: '0.75rem' }}>
              + Add New Blazer
            </Link>
            <Link to="/orders" className={styles.btnSecondary} style={{ justifyContent: 'center', padding: '0.75rem' }}>
              Fulfill Orders
            </Link>
            <Link to="/inventory" className={styles.btnSecondary} style={{ justifyContent: 'center', padding: '0.75rem' }}>
              Inventory Health
            </Link>
            <Link to="/settings" className={styles.btnSecondary} style={{ justifyContent: 'center', padding: '0.75rem' }}>
              Store Settings
            </Link>
          </div>

          <h4 style={{ fontSize: '0.85rem', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', fontWeight: 600 }}>
            Action Items & Alerts
          </h4>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E5E5', paddingBottom: '0.5rem' }}>
              <span>Orders Awaiting Fulfillment</span>
              <Link to="/orders" className={`${styles.badge} ${styles.badgeWarning}`}>
                {summary?.pending_orders ?? summary?.pendingOrders ?? 0} Review
              </Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
              <span>Overdue Garment Rentals</span>
              <Link to="/rental-bookings" className={`${styles.badge} ${styles.badgeDanger}`}>
                {summary?.overdue_rentals ?? summary?.overdueRentals ?? 0} Settle
              </Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Low Inventory Variants (&lt; 2 units)</span>
              <Link to="/inventory" className={`${styles.badge} ${styles.badgeDefault}`}>
                {summary?.low_stock_products ?? summary?.low_stock_count ?? summary?.lowStockCount ?? 0} Restock
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
