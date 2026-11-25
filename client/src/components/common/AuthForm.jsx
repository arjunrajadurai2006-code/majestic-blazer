import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../context/ToastContext';
import { getPendingGuestAction, executePendingGuestAction } from '../../services/guestAction';
import { api, tokenStore } from '../../services/api';
import { ADMIN_APP_URL } from '../../config/urls';
import Logo from './Logo';
import styles from './AuthForm.module.css';

export default function AuthForm({ mode = 'login' }) {
  const { login, register, adminLogin } = useAuth();
  const { addToCart } = useCart();
  const { loadWishlist } = useWishlist();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const adminUrl = ADMIN_APP_URL;

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
  const [cooldown, setCooldown] = useState(0);
  const [brandTagline, setBrandTagline] = useState('STYLE THAT SPEAKS');

  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  // Fetch brand tagline
  useEffect(() => {
    api('/settings', { auth: false })
      .then((res) => {
        if (res.data?.brand_tagline) {
          setBrandTagline(res.data.brand_tagline.toUpperCase());
        }
      })
      .catch(() => {});
  }, []);

  // Clear errors when switching roles or modes
  useEffect(() => {
    if (cooldown <= 0) {
      setError('');
    }
    setActionSuccess('');
    setEmail('');
    setPassword('');
  }, [activeRole, mode]);

  // Rate-limit cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError(''); // Restore form state on cooldown expiry
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle Customer & Admin Submission
  const onSubmit = async (event) => {
    event.preventDefault();
    if (cooldown > 0) return;
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

    if (mode === 'register') {
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
        const authenticatedUser = await register({ fullName: fullName.trim(), phone: phone.trim(), email: trimmedEmail, password });
        success('Account created successfully. Welcome to Majestic Blazer.');
        const pending = getPendingGuestAction();
        const returnTo = location.state?.from || pending?.returnUrl || '/';
        const result = await executePendingGuestAction({
          api,
          user: authenticatedUser,
          addToCart,
          loadWishlist,
          success,
          toastError,
        });
        const destination = (result?.action === 'buyNow' ? '/checkout' : null) || returnTo;
        navigate(destination, { replace: true });
      } else {
        // Shared Unified Login (Customer or Administrator)
        let authenticatedUser;
        let token;
        if (activeRole === 'admin') {
          const data = await adminLogin({ email: trimmedEmail, password });
          authenticatedUser = data.user;
          token = data.token;
          tokenStore.set(token);
        } else {
          authenticatedUser = await login({ email: trimmedEmail, password });
          token = tokenStore.get();
        }

        // Backend determines authenticated user's role
        if (authenticatedUser?.role === 'admin') {
          localStorage.setItem('mb_admin_token', token);
          localStorage.setItem('mb_token', token);
          setActionSuccess('Administrator access confirmed. Redirecting to Atelier Console...');
          setTimeout(() => {
            window.location.href = `${ADMIN_APP_URL}/`;
          }, 350);
          return;
        }

        // Customer post-login redirect
        const pending = getPendingGuestAction();
        const returnTo = location.state?.from || pending?.returnUrl || '/';
        const result = await executePendingGuestAction({
          api,
          user: authenticatedUser,
          addToCart,
          loadWishlist,
          success,
          toastError,
        });
        const destination = (result?.action === 'buyNow' ? '/checkout' : null) || returnTo;
        navigate(destination, { replace: true });
      }
    } catch (err) {
      if (err.status === 429) {
        const waitSec = Math.max(1, Number(err.retryAfter) || 60);
        setCooldown(waitSec);
        setError(`Too many attempts. For security, please wait ${waitSec} seconds before trying again.`);
      } else {
        setError(err.details?.[0]?.message || err.message || 'Authentication failed. Please verify your credentials.');
      }
      setBusy(false);
    }
  };

  // Forgot password submission
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (cooldown > 0 || !forgotEmail.trim()) return;
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
      if (err.status === 429) {
        const waitSec = Math.max(1, Number(err.retryAfter) || 60);
        setCooldown(waitSec);
        toastError(`Too many attempts. For security, please wait ${waitSec} seconds before trying again.`);
      } else {
        toastError(err.message || 'Unable to process reset request.');
      }
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.formCard}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <Logo height={42} variant="bare" />
          <span className={styles.tagline}>{brandTagline}</span>
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
              ? 'Join Majestic Blazer to manage bespoke orders and saved pieces.'
              : activeRole === 'admin'
                ? 'Atelier Operations Console • Secure Management Gateway'
                : 'Sign in to access your orders, saved pieces and preferences.'}
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
            <span>
              {cooldown > 0
                ? `Too many attempts. For security, please wait ${cooldown} seconds before trying again.`
                : error}
            </span>
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
                  disabled={busy || cooldown > 0}
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
                  disabled={busy || cooldown > 0}
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
              disabled={busy || cooldown > 0}
              required
            />
          </label>

          <label>
            {activeRole === 'admin' && mode === 'login' ? 'ADMIN PASSWORD' : 'PASSWORD'}
            <input
              name="password"
              type="password"
              placeholder={
                mode === 'register'
                  ? 'Min 8 chars, 1 letter, 1 number'
                  : 'Your account password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={busy || cooldown > 0}
              required
            />
          </label>

          {/* Forgot Password link (Customer mode only) */}
          {mode === 'login' && activeRole === 'customer' && (
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.forgotBtn}
                disabled={busy || cooldown > 0}
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
          <button type="submit" disabled={busy || cooldown > 0} className={styles.submitBtn}>
            {cooldown > 0 ? (
              <span>PLEASE WAIT ({cooldown}s)</span>
            ) : busy ? (
              <span>Authenticating...</span>
            ) : mode === 'register' ? (
              <span>JOIN MAJESTIC BLAZER</span>
            ) : activeRole === 'admin' ? (
              <span>SECURE ADMIN SIGN IN</span>
            ) : (
              <span>SIGN IN</span>
            )}
          </button>

          {/* Footer Navigation Link */}
          {mode === 'login' ? (
            activeRole === 'customer' ? (
              <p className={styles.altText}>
                New to Majestic Blazer?{' '}
                <Link to="/register" className={styles.altLink}>
                  Create Account
                </Link>
              </p>
            ) : (
              <p className={styles.altText}>
                Need dedicated management portal?{' '}
                <a href={`${adminUrl}/login`} className={styles.altLink} target="_blank" rel="noopener noreferrer">
                  Open Atelier Console ↗
                </a>
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
