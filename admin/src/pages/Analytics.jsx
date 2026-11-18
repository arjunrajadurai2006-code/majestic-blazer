import { useEffect, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Award, Layers, ShoppingBag, Calendar, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

const TIME_RANGES = [
  { label: 'Past 7 Days', value: '7d' },
  { label: 'Past 30 Days', value: '30d' },
  { label: 'Past 90 Days', value: '90d' },
  { label: 'This Year', value: '1y' },
];

const PIE_COLORS = ['#ffffff', '#e5e5e5', '#c0c0c0', '#858585', '#3498db', '#2ed573'];

export default function Analytics() {
  const [range, setRange] = useState('30d');
  const [revenueTrends, setRevenueTrends] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const [revRes, topRes, catRes, invRes, sumRes] = await Promise.all([
        api.get(`/analytics/revenue?range=${range}`),
        api.get('/analytics/top-products?limit=6'),
        api.get('/analytics/categories'),
        api.get('/analytics/inventory-health'),
        api.get('/analytics/summary')
      ]);

      setRevenueTrends(revRes.data || []);
      setTopProducts(topRes.data || []);
      setCategories(catRes.data || []);
      setLowStock(invRes.data || []);
      setOverview(sumRes.data || {});
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [range]);

  const formatCurrency = (amt) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt || 0);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Analytics & Sartorial Intelligence</h1>
          <p className={styles.subtitle}>Comprehensive financial performance, garment velocity and rental telemetry</p>
        </div>
        <div className={styles.headerActions}>
          <div style={{ display: 'flex', gap: '4px', background: '#F7F7F7', padding: '3px', borderRadius: '4px', border: '1px solid #E5E5E5' }}>
            {TIME_RANGES.map(t => (
              <button
                key={t.value}
                onClick={() => setRange(t.value)}
                style={{
                  background: range === t.value ? '#111111' : 'transparent',
                  color: range === t.value ? '#FFFFFF' : '#666666',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '2px',
                  fontSize: '0.8rem',
                  fontWeight: range === t.value ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}

      {/* Overview KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Total Sales Revenue</span>
            <TrendingUp size={16} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{formatCurrency(overview?.salesRevenue || overview?.sales_revenue)}</div>
          <div className={styles.kpiMeta}>{overview?.totalOrders || 0} direct purchase orders</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Total Rental Revenue</span>
            <Calendar size={16} color="#c0c0c0" />
          </div>
          <div className={styles.kpiValue}>{formatCurrency(overview?.rentalRevenue || overview?.rental_revenue)}</div>
          <div className={styles.kpiMeta}>{overview?.totalRentals || 0} rental reservations</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Combined Gross Turnover</span>
            <Award size={16} color="#ffffff" />
          </div>
          <div className={styles.kpiValue}>{formatCurrency(overview?.totalRevenue || overview?.total_revenue)}</div>
          <div className={styles.kpiMeta}>Across sales and rental operations</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <span>Inventory Health</span>
            <AlertTriangle size={16} color={lowStock.length > 0 ? '#ffab00' : '#2ed573'} />
          </div>
          <div className={styles.kpiValue}>{lowStock.length}</div>
          <div className={styles.kpiMeta}>Variants requiring replenishment</div>
        </div>
      </div>

      {/* Revenue Trend Area Chart */}
      <div className={styles.chartBox}>
        <h3>Revenue Trajectory (Sales vs Rentals)</h3>
        {revenueTrends && revenueTrends.length > 0 ? (
          <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={revenueTrends} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="rentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c0c0c0" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#c0c0c0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEF" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5E5', color: '#111111', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(val) => [formatCurrency(val), '']}
                />
                <Legend />
                <Area type="monotone" dataKey="sales" name="Purchase Sales" stroke="#111111" fillOpacity={1} fill="url(#salesGrad)" />
                <Area type="monotone" dataKey="rentals" name="Rental Fees" stroke="#888888" fillOpacity={1} fill="url(#rentGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No transaction revenue recorded during this period.</div>
        )}
      </div>

      {/* Two Column Section: Category Distribution & Top Blazers */}
      <div className={styles.dashboardTwoColGrid}>
        {/* Categories Bar Chart */}
        <div className={styles.chartBox}>
          <h3>Collection Distribution</h3>
          {categories && categories.length > 0 ? (
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer>
                <BarChart data={categories} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEFEF" />
                  <XAxis dataKey="name" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5E5', color: '#111111', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Legend />
                  <Bar dataKey="products_count" name="Active Blazers" fill="#555555" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={styles.emptyState}>No categories data.</div>
          )}
        </div>

        {/* Top Blazers Table */}
        <div className={styles.chartBox}>
          <h3>Premier Blazer Velocity</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E5E5', color: '#666666', textAlign: 'left', background: '#F7F7F7' }}>
                  <th style={{ padding: '8px 10px' }}>Blazer</th>
                  <th style={{ padding: '8px 10px' }}>Category</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Sold</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Rented</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length > 0 ? (
                  topProducts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                      <td style={{ padding: '10px 10px', color: '#111111', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '10px 10px', color: '#666666' }}>{p.category_name}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', color: '#111111' }}>{p.units_sold || 0}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', color: '#b99a58', fontWeight: 600 }}>{p.rental_count || 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                      No blazer velocity recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className={styles.chartBox}>
        <h3>Inventory Attention Thresholds (&le; 2 Units Available)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E5E5', color: '#666666', textAlign: 'left', background: '#F7F7F7' }}>
                <th style={{ padding: '8px 10px' }}>Blazer</th>
                <th style={{ padding: '8px 10px' }}>SKU</th>
                <th style={{ padding: '8px 10px' }}>Size</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Retail Stock</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Rental Stock</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.length > 0 ? (
                lowStock.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '10px 10px', color: '#111111', fontWeight: 600 }}>{it.product_name}</td>
                    <td style={{ padding: '10px 10px', color: '#b99a58' }}>{it.sku}</td>
                    <td style={{ padding: '10px 10px', color: '#555555' }}>{it.size}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: it.stock_quantity <= 1 ? '#d63031' : '#111111' }}>
                      {it.stock_quantity}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'center', color: it.rental_stock_quantity <= 1 ? '#ffab00' : '#b99a58' }}>
                      {it.rental_stock_quantity}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>Reorder Required</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '1.5rem', textAlign: 'center', color: '#2ed573' }}>
                    All blazer inventory variants are well-stocked.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
