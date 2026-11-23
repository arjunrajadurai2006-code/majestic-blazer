import { useEffect, useState } from 'react';
import { Save, Building2, Shield, Percent, CreditCard, CheckCircle, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import styles from '../styles/adminShared.module.css';

export default function Settings() {
  const { settings: globalSettings, updateSettings } = useSettings();
  const [settings, setSettings] = useState(globalSettings);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSeedDemo = async () => {
    if (!window.confirm('Populate/refresh realistic demonstration data? This will replenish sample blazers, orders, coupons, and reviews.')) {
      return;
    }
    try {
      setSeeding(true);
      setError('');
      setSuccess('');
      const res = await api.post('/settings/seed-demo-data');
      setSuccess(res.message || 'Realistic demonstration dataset successfully seeded into database.');
    } catch (err) {
      setError(err.message || 'Failed to seed demonstration data');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (globalSettings) {
      setSettings(prev => ({ ...prev, ...globalSettings }));
    }
  }, [globalSettings]);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!settings.store_name || !settings.store_name.trim()) {
      setError('Store brand name cannot be empty.');
      setSaving(false);
      return;
    }
    if (!settings.brand_tagline || !settings.brand_tagline.trim()) {
      setError('Official brand tagline cannot be empty.');
      setSaving(false);
      return;
    }

    try {
      await updateSettings(settings);
      setSuccess('Store parameters and branding configuration saved successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px' }}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Store Policies & Configuration</h1>
          <p className={styles.subtitle}>Atelier operational identity, shipping parameters, and taxation</p>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      <form onSubmit={handleSubmit}>
        {/* Brand & Atelier Section */}
        <div className={styles.chartBox} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="#b99a58" /> Flagship Brand & Boutique Identity
          </h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Store Brand Name *</label>
              <input
                type="text"
                required
                className={styles.input}
                value={settings.store_name || ''}
                onChange={(e) => handleChange('store_name', e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Official Tagline *</label>
              <input
                type="text"
                required
                className={styles.input}
                value={settings.brand_tagline || ''}
                onChange={(e) => handleChange('brand_tagline', e.target.value)}
              />
            </div>

            <div className={`${styles.formGroup} ${styles.formFull}`}>
              <label>Boutique Physical Address *</label>
              <input
                type="text"
                required
                className={styles.input}
                value={settings.store_address || ''}
                onChange={(e) => handleChange('store_address', e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Customer Helpline Phone *</label>
              <input
                type="text"
                required
                className={styles.input}
                value={settings.store_phone || ''}
                onChange={(e) => handleChange('store_phone', e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Support Email Address *</label>
              <input
                type="email"
                required
                className={styles.input}
                value={settings.store_email || ''}
                onChange={(e) => handleChange('store_email', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Fulfillment & Shipping Section */}
        <div className={styles.chartBox} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#c0c0c0" /> Fulfillment & Shipping Parameters
          </h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Complimentary Courier Shipping Fee (₹)</label>
              <input
                type="number"
                min="0"
                className={styles.input}
                value={settings.shipping_fee || '0'}
                onChange={(e) => handleChange('shipping_fee', e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: '#888' }}>
                Set to 0 for complimentary pan-India shipping
              </span>
            </div>
          </div>
        </div>

        {/* Taxation & Compliance Section */}
        <div className={styles.chartBox} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Percent size={18} color="#2ed573" /> Taxation & Business Registration
          </h3>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>GST Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="28"
                className={styles.input}
                value={settings.tax_percentage || '0'}
                onChange={(e) => handleChange('tax_percentage', e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: '#888' }}>
                Configurable tax (0% by default until GST registration is active)
              </span>
            </div>

            <div className={styles.formGroup}>
              <label>GSTIN / Tax ID Number</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g. 33AAAAA0000A1Z5"
                value={settings.gst_registration_number || ''}
                onChange={(e) => handleChange('gst_registration_number', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Payment Gateway Configuration */}
        <div className={styles.chartBox} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="#3498db" /> Razorpay Payment Gateway
          </h3>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.formFull}`}>
              <label>Razorpay Public Key ID</label>
              <input
                type="text"
                className={styles.input}
                placeholder="rzp_test_..."
                value={settings.razorpay_key_id || ''}
                onChange={(e) => handleChange('razorpay_key_id', e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: '#888' }}>
                Used by customer checkout for frontend modal initiation (Private secret key remains strictly in server .env)
              </span>
            </div>
          </div>
        </div>

        {/* Developer Sandbox & Demo Data */}
        <div className={styles.chartBox} style={{ marginBottom: '1.5rem', border: '1px solid #E5E5E5', background: '#F7F7F7' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#111111' }}>
            <Database size={18} color="#666666" /> Developer Sandbox & Demonstration Data
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#666666', margin: '0.5rem 0 1rem 0', lineHeight: '1.5' }}>
            Populate or replenish realistic luxury menswear sample data across all admin tables: 37 catalog blazers, 6 categories, 45+ patron accounts, 36 orders, coupons, and customer reviews.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#666666' }}>
              <Shield size={14} color="#2ed573" />
              <span>Safe operation &bull; Automatically disabled in production</span>
            </div>
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seeding}
              className={styles.btnSecondary}
              style={{ padding: '0.6rem 1.25rem', borderColor: '#E5E5E5', color: '#111111' }}
            >
              <RefreshCw size={14} className={seeding ? styles.spinner : ''} style={{ marginRight: '6px' }} />
              {seeding ? 'Seeding Demonstration Data...' : 'Load Demo Data'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button type="submit" className={styles.btnPrimary} disabled={saving} style={{ padding: '0.75rem 2rem' }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
