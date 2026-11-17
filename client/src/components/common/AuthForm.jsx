import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import Logo from './Logo';
import styles from './AuthForm.module.css';

export default function AuthForm({ mode = 'login' }) {
  const { login, register, demoCustomerLogin, adminLogin, demoAdminLogin } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode selection: 'customer' or 'admin' (default: 'customer')
  const [activeRole, setActiveRole] = useState('customer');

  // Controlled form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // UI status states
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  // Check demo mode from backend configuration
  useEffect(() => {
    api('/auth/config', { auth: false })
      .then((res) => {
        if (res.data?.demoMode !== undefined) {
          setDemoMode(Boolean(res.data.demoMode));
        }
      })
      .catch(() => {
        // Graceful fallback to true
      });
  }, []);

  // Clear errors when switching roles or modes
  useEffect(() => {
    setError('');
    setActionSuccess('');
    setEmail('');
    setPassword('');
  }, [activeRole, mode]);

  // Handle Customer & Admin Submission
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

    if (mode === 'register' && !demoMode) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError('Password must include both a letter and a number.');
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === 'register') {
        // Customer Registration
        await register({ fullName: fullName.trim(), phone: phone.trim(), email: trimmedEmail, password });
        success('Account created successfully. Welcome to Majestic Blazer.');
        navigate(location.state?.from || '/', { replace: true });
      } else if (activeRole === 'admin') {
        // Administrator Login
        const data = await adminLogin({ email: trimmedEmail, password });
        setActionSuccess('Administrator access confirmed. Redirecting to Atelier Console...');
        const adminUrl = import.meta.env.VITE_ADMIN_URL ||
          (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:5174'
            : 'https://majestic-blazer-admin.vercel.app');

        setTimeout(() => {
          window.location.href = `${adminUrl.replace(/\/$/, '')}/?token=${encodeURIComponent(data.token)}`;
        }, 350);
      } else {
        // Customer Login
        await login({ email: trimmedEmail, password });
        navigate(location.state?.from || '/', { replace: true });
      }
    } catch (err) {
      setError(err.details?.[0]?.message || err.message || 'Authentication failed. Please verify your credentials.');
      setBusy(false);
    }
  };

  // 1-Click Customer Demo Login
  const handleContinueAsDemoCustomer = async () => {
    setError('');
    setActionSuccess('');
    setBusy(true);

    try {
      await demoCustomerLogin();
      success('Welcome to Majestic Blazer. Demo Customer session started.');
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to start demo customer session.');
      setBusy(false);
    }
  };

  // 1-Click Admin Demo Login
  const handleEnterAdminDemo = async () => {
    setError('');
    setActionSuccess('');
    setBusy(true);

    try {
      const data = await demoAdminLogin();
      setActionSuccess('Demo administrator authenticated. Redirecting to Atelier Console...');
      const adminUrl = import.meta.env.VITE_ADMIN_URL ||
        (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://localhost:5174'
          : 'https://majestic-blazer-admin.vercel.app');

      setTimeout(() => {
        window.location.href = `${adminUrl.replace(/\/$/, '')}/?token=${encodeURIComponent(data.token)}`;
      }, 350);
    } catch (err) {
      setError(err.message || 'Unable to access demo administrator portal.');
      setBusy(false);
    }
  };

  // Forgot password submission
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotBusy(true);
    try {
      const res = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: forgotEmail.trim() },
        auth: false,
      });
      setForgotMsg(res.message || 'If an account exists, password reset instructions have been generated.');
      success('Password reset initiated.');
    } catch (err) {
      toastError(err.message || 'Unable to process reset request.');
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.formCard}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <Logo height={42} />
          <span className={styles.tagline}>STYLE THAT SPEAKS</span>
        </div>

        {/* Unified Role Segmented Control (Only on Login mode) */}
        {mode === 'login' && (
          <div className={styles.segmentedControl} role="tablist" aria-label="Login Role Selection">
            <button
              type="button"
              role="tab"
              aria-selected={activeRole === 'customer'}
              className={`${styles.segmentBtn} ${activeRole === 'customer' ? styles.segmentActive : ''}`}
              onClick={() => setActiveRole('customer')}
            >
              <span className={styles.segmentTitle}>CUSTOMER</span>
              <span className={styles.segmentDesc}>Shopping &amp; Rentals</span>
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
        )}

        {/* Dynamic Heading based on Mode & Role */}
        <div className={styles.headingBlock}>
          <h1 className={styles.title}>
            {mode === 'register'
              ? 'Create Account'
              : activeRole === 'admin'
                ? 'Administrator Access'
                : 'Welcome Back'}
          </h1>
          <p className={styles.subtitle}>
            {mode === 'register'
              ? 'Join Majestic Blazer to manage bespoke orders and reserve rentals.'
              : activeRole === 'admin'
                ? 'Atelier Operations Console • Secure Management Gateway'
                : 'Sign in to access your orders, active rentals and saved preferences.'}
          </p>
        </div>

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
          {mode === 'register' && (
            <>
              <label>
                FULL NAME
                <input
                  name="fullName"
                  type="text"
                  placeholder="e.g. Arvind Rajan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                PHONE NUMBER
                <input
                  name="phone"
                  type="tel"
                  placeholder="e.g. 8903238882"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
            </>
          )}

          <label>
            {activeRole === 'admin' && mode === 'login' ? 'ADMIN EMAIL' : 'EMAIL ADDRESS'}
            <input
              name="email"
              type="email"
              placeholder={activeRole === 'admin' && mode === 'login' ? 'e.g. admin@majesticblazer.com' : 'e.g. patron@example.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            {activeRole === 'admin' && mode === 'login' ? 'ADMIN PASSWORD' : 'PASSWORD'}
            <input
              name="password"
              type="password"
              placeholder={
                mode === 'register' && !demoMode
                  ? 'Min 8 chars, 1 letter, 1 number'
                  : 'Your account password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {/* Forgot Password link (Customer mode only) */}
          {mode === 'login' && activeRole === 'customer' && (
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.forgotBtn}
                onClick={() => {
                  setForgotEmail(email);
                  setForgotMsg('');
                  setShowForgot(true);
                }}
              >
                Forgot your password?
              </button>
            </div>
          )}

          {/* Primary Action Button */}
          <button type="submit" disabled={busy} className={styles.submitBtn}>
            {busy ? (
              <span>Authenticating...</span>
            ) : mode === 'register' ? (
              <span>JOIN MAJESTIC BLAZER</span>
            ) : activeRole === 'admin' ? (
              <span>SECURE ADMIN SIGN IN</span>
            ) : (
              <span>SIGN IN</span>
            )}
          </button>

          {/* Demo Action Buttons (When DEMO_MODE is active) */}
          {demoMode && mode === 'login' && (
            <div className={styles.demoActionWrap}>
              {activeRole === 'customer' ? (
                <button
                  type="button"
                  disabled={busy}
                  className={styles.demoActionBtn}
                  onClick={handleContinueAsDemoCustomer}
                  title="Sign in instantly with a generated demo customer account"
                >
                  <UserCheck size={14} />
                  <span>Continue as Demo Customer</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className={styles.demoActionBtn}
                  onClick={handleEnterAdminDemo}
                  title="Sign in to the Atelier Management Portal using secure backend admin verification"
                >
                  <ShieldCheck size={14} />
                  <span>Enter Admin Demo</span>
                </button>
              )}
            </div>
          )}

          {/* Footer Navigation Link */}
          {mode === 'login' ? (
            activeRole === 'customer' && (
              <p className={styles.altText}>
                New to Majestic Blazer?{' '}
                <Link to="/register" className={styles.altLink}>
                  Create Account
                </Link>
              </p>
            )
          ) : (
            <p className={styles.altText}>
              Already registered?{' '}
              <Link to="/login" className={styles.altLink}>
                Sign In
              </Link>
            </p>
          )}
        </form>

        {/* Forgot Password Modal */}
        {showForgot && (
          <div className={styles.modalOverlay} onClick={() => setShowForgot(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Reset Password</h2>
              <p className={styles.modalDesc}>Enter the email address associated with your customer account.</p>

              {forgotMsg ? (
                <div className={styles.forgotSuccess}>
                  <p>{forgotMsg}</p>
                  <button type="button" onClick={() => setShowForgot(false)} className={styles.closeBtn}>
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className={styles.forgotForm}>
                  <input
                    type="email"
                    placeholder="Enter account email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                  <div className={styles.modalBtns}>
                    <button type="submit" disabled={forgotBusy} className={styles.resetBtn}>
                      {forgotBusy ? 'Sending...' : 'Send Reset Link'}
                    </button>
                    <button type="button" onClick={() => setShowForgot(false)} className={styles.cancelBtn}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
