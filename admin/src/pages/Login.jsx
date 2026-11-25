import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { CUSTOMER_APP_URL } from '../config/urls';
import { api } from '../services/api';
import logo from '../assets/majestic-blazer-logo.jpeg';
import styles from './Login.module.css';

export default function Login() {
  const { admin, loading, login, customerLogin } = useAuth();
  const { settings } = useSettings();
  const brandTagline = settings?.brand_tagline || 'Style That Speaks';
  const storeName = settings?.store_name || 'Majestic Blazer';
  const navigate = useNavigate();
  const location = useLocation();
  const logoutMessage = location.state?.message;

  // Active role tab: 'admin' or 'customer' (default: 'admin' for management console)
  const [activeRole, setActiveRole] = useState('admin');

  // Controlled form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  // Clear errors and form fields on role switch
  useEffect(() => {
    setError('');
    setActionSuccess('');
    setEmail('');
    setPassword('');
  }, [activeRole]);

  // If loading session / exchanging handoff code, hold rendering
  if (loading) return null;

  // If already authenticated as admin, redirect to root
  if (admin) return <Navigate to="/" replace />;

  const storefrontUrl = CUSTOMER_APP_URL;

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setActionSuccess('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(activeRole === 'admin' ? 'Please enter your administrator email.' : 'Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError(activeRole === 'admin' ? 'Please enter your administrator password.' : 'Please enter your password.');
      return;
    }

    setBusy(true);

    try {
      if (activeRole === 'admin') {
        await login({ email: trimmedEmail, password });
        navigate('/', { replace: true });
      } else {
        const data = await customerLogin({ email: trimmedEmail, password });
        setActionSuccess('Customer authenticated. Redirecting to Customer Storefront...');

        let handoffCode = data.handoffCode;
        if (!handoffCode) {
          const handoffRes = await api('/auth/handoff/create', {
            method: 'POST',
            body: { targetApp: 'customer' },
            headers: { Authorization: `Bearer ${data.token}` },
            auth: false,
          });
          handoffCode = handoffRes.data.handoffCode;
        }

        setTimeout(() => {
          window.location.href = `${storefrontUrl.replace(/\/$/, '')}/?code=${encodeURIComponent(handoffCode)}`;
        }, 350);
      }
    } catch (err) {
      setError(err.details?.[0]?.message || err.message || 'Authentication failed. Please verify your credentials.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* Brand Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <img src={logo} alt={`${storeName}: ${brandTagline}`} className={styles.logo} />
          </div>
          <span className={styles.eyebrow}>{brandTagline.toUpperCase()}</span>
        </div>

        {/* Unified Role Segmented Control */}
        <div className={styles.segmentedControl} role="tablist" aria-label="Login Role Selection">
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === 'customer'}
            className={`${styles.segmentBtn} ${activeRole === 'customer' ? styles.segmentActive : ''}`}
            onClick={() => setActiveRole('customer')}
          >
            <span className={styles.segmentTitle}>CUSTOMER</span>
            <span className={styles.segmentDesc}>Bespoke Menswear</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeRole === 'admin'}
            className={`${styles.segmentBtn} ${activeRole === 'admin' ? styles.segmentActive : ''}`}
            onClick={() => setActiveRole('admin')}
          >
            <span className={styles.segmentTitle}>ADMIN</span>
            <span className={styles.segmentDesc}>Management Portal</span>
          </button>
        </div>

        {/* Dynamic Heading based on Role */}
        <div className={styles.headingBlock}>
          <h1 className={styles.title}>
            {activeRole === 'admin' ? 'Administrator Access' : 'Welcome Back'}
          </h1>
          <p className={styles.subtitle}>
            {activeRole === 'admin'
              ? 'Atelier Operations Console • Secure Management Gateway'
              : 'Sign in to access your orders, saved pieces and preferences.'}
          </p>
        </div>

        {/* Temporary Logout or Success Message */}
        {logoutMessage && !actionSuccess && !error && (
          <div className={styles.successBanner} role="status">
            <CheckCircle2 size={16} className={styles.bannerIcon} />
            <span>{logoutMessage}</span>
          </div>
        )}

        {/* Action Success Alert (Compact & Temporary) */}
        {actionSuccess && (
          <div className={styles.successBanner} role="status">
            <CheckCircle2 size={16} className={styles.bannerIcon} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Error Alert (Compact) */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={16} className={styles.bannerIcon} />
            <span>{error}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.fieldLabel}>
            <span>{activeRole === 'admin' ? 'ADMIN EMAIL' : 'EMAIL ADDRESS'}</span>
            <input
              name="email"
              type="email"
              placeholder={activeRole === 'admin' ? 'e.g. admin@majesticblazer.com' : 'e.g. patron@example.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={activeRole === 'admin' ? 'username' : 'email'}
              required
              className={styles.input}
            />
          </label>

          <label className={styles.fieldLabel}>
            <span>{activeRole === 'admin' ? 'ADMIN PASSWORD' : 'PASSWORD'}</span>
            <input
              name="password"
              type="password"
              placeholder={activeRole === 'admin' ? 'Your administrator password' : 'Your account password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={styles.input}
            />
          </label>

          {/* Primary Action Button */}
          <button type="submit" disabled={busy} className={styles.submitBtn}>
            {busy ? (
              <span>Authenticating...</span>
            ) : activeRole === 'admin' ? (
              <span>SECURE ADMIN SIGN IN</span>
            ) : (
              <span>SIGN IN</span>
            )}
          </button>

          {/* Customer mode storefront link */}
          {activeRole === 'customer' && (
            <p className={styles.altText}>
              New to Majestic Blazer?{' '}
              <a href={`${storefrontUrl}/register`} className={styles.altLink}>
                Create Account at Storefront
              </a>
            </p>
          )}
        </form>

        {/* Security & Storefront Link Footer */}
        <footer className={styles.footer}>
          <div className={styles.securityNote}>
            <Lock size={13} className={styles.lockIcon} />
            <span>Strict Role-Based Access Control • Server-Side Session Enforcement</span>
          </div>
          <a href={storefrontUrl} className={styles.storefrontLink}>
            ← Return to Customer Storefront
          </a>
        </footer>
      </div>
    </div>
  );
}
