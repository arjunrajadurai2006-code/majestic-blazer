import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Calendar, Users, AlertTriangle, 
  ArrowUpRight, Package, ShieldCheck 
} from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [inventoryHealth, setInventoryHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const [sumRes, revRes, invRes] = await Promise.all([
          api.get('/analytics/summary').catch(() => ({ data: {} })),
          api.get('/analytics/revenue?days=30').catch(() => ({ data: [] })),
          api.get('/analytics/inventory-health').catch(() => ({ data: {} })),
        ]);
        setSummary(sumRes.data || {});
        setRevenueTrends(revRes.data || []);
        setInventoryHealth(invRes.data || {});
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  if (loading) {
    return <div className={styles.loadingSpinner}>Loading executive dashboard...</div>;
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Majestic Executive Overview</h1>
          <p className={styles.subtitle}>Sathy Road Atelier & Nationwide Rental Operations</p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/products" className={styles.btnPrimary}>Manage Catalog</Link>
          <Link to="/rental-bookings" className={styles.btnSecondary}>Active Rentals</Link>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Total Gross Revenue</span>
            <TrendingUp size={18} color="#b99a58" />
          </div>
          <div className={styles.kpiValue}>{formatCurrency(summary?.total_revenue)}</div>
          <div className={styles.kpiMeta}>
            Sales: {formatCurrency(summary?.sales_revenue)} | Rentals: {formatCurrency(summary?.rental_revenue)}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Purchase Orders</span>
            <ShoppingBag size={18} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_orders || 0}</div>
          <div className={styles.kpiMeta}>
            {summary?.pending_orders || 0} awaiting dispatch
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Rental Bookings</span>
            <Calendar size={18} color="#3498db" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_rentals || 0}</div>
          <div className={styles.kpiMeta}>
            {summary?.active_rentals || 0} currently with clients
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Overdue Returns</span>
            <AlertTriangle size={18} color="#ff4757" />
          </div>
          <div className={styles.kpiValue} style={{ color: (summary?.overdue_rentals > 0) ? '#ff4757' : 'inherit' }}>
            {summary?.overdue_rentals || 0}
          </div>
          <div className={styles.kpiMeta}>
            Requires follow-up / late fee assessment
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Registered Patrons</span>
            <Users size={18} color="#2ed573" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_customers || 0}</div>
          <div className={styles.kpiMeta}>
            Active luxury client base
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Active Blazer Catalog</span>
            <Package size={18} color="#b99a58" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_products || 0}</div>
          <div className={styles.kpiMeta}>
            {summary?.total_stock_units || 0} retail / rental units in store
          </div>
        </div>
      </div>

      {/* Revenue Graph */}
      <div className={styles.chartBox}>
        <h3>Revenue Performance (Last 30 Days)</h3>
        {revenueTrends && revenueTrends.length > 0 ? (
          <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={revenueTrends} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c0c0c0" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#c0c0c0" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b99a58" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#b99a58" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip
                  contentStyle={{ background: '#151515', border: '1px solid #333', color: '#fff' }}
                  formatter={(val) => [formatCurrency(val), '']}
                />
                <Legend />
                <Area type="monotone" dataKey="sales" name="Sartorial Sales" stroke="#e5e5e5" fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="rentals" name="Rental Fees" stroke="#b99a58" fillOpacity={1} fill="url(#colorRent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No transaction activity recorded in the past 30 days.</div>
        )}
      </div>

      {/* Quick Navigation Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-3)' }}>
        <div className={styles.chartBox}>
          <h3>Pending Operational Actions</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
              <span>Orders Awaiting Fulfillment</span>
              <Link to="/orders" className={`${styles.badge} ${styles.badgeWarning}`}>
                {summary?.pending_orders || 0} Review
              </Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
              <span>Garments Due for Return Today</span>
              <Link to="/rental-bookings" className={`${styles.badge} ${styles.badgeInfo}`}>
                {summary?.due_today_rentals || 0} Inspect
              </Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>
              <span>Overdue Unreturned Blazers</span>
              <Link to="/rental-bookings" className={`${styles.badge} ${styles.badgeDanger}`}>
                {summary?.overdue_rentals || 0} Settle
              </Link>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Low Inventory Variants (&lt; 2 units)</span>
              <Link to="/inventory" className={`${styles.badge} ${styles.badgeDefault}`}>
                {inventoryHealth?.low_stock_count || 0} Restock
              </Link>
            </li>
          </ul>
        </div>

        <div className={styles.chartBox}>
          <h3>Atelier Quick Shortcuts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Link to="/products" className={styles.btnSecondary} style={{ justifyContent: 'center' }}>
              + Add New Blazer
            </Link>
            <Link to="/rental-bookings" className={styles.btnSecondary} style={{ justifyContent: 'center' }}>
              Record Garment Return
            </Link>
            <Link to="/invoices" className={styles.btnSecondary} style={{ justifyContent: 'center' }}>
              Download Invoices
            </Link>
            <Link to="/settings" className={styles.btnSecondary} style={{ justifyContent: 'center' }}>
              Store & Tax Config
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
