import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Lock, ChevronDown, ChevronUp, Copy, Check, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import logo from '../assets/majestic-blazer-logo.jpeg';
import styles from './Login.module.css';

const DEMO_ADMIN_EMAIL = 'admin.demo@majesticblazer.com';
const DEMO_ADMIN_PASSWORD = 'MajesticAdmin2026!Secure';

export default function Login() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const logoutMessage = location.state?.message;

  // Controlled form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Demo section states
  const [demoExpanded, setDemoExpanded] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const isProduction = import.meta.env.PROD;

  // Development-only seed verification
  useEffect(() => {
    if (!isProduction) {
      api('/auth/demo-admin', { auth: false }).catch(() => {
        // Silently handled; server-side script also seeds
      });
    }
  }, [isProduction]);

  if (admin) return <Navigate to="/" replace />;

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      // Authenticate via existing admin endpoint (/api/auth/admin/login)
      await login({ email: email.trim(), password });
      // Redirect to existing admin dashboard
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid administrator credentials');
    } finally {
      setBusy(false);
    }
  };

  const handleAutoFillDemo = () => {
    setEmail(DEMO_ADMIN_EMAIL);
    setPassword(DEMO_ADMIN_PASSWORD);
    setError('');
  };

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText(DEMO_ADMIN_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleQuickDemoSignIn = async () => {
    setEmail(DEMO_ADMIN_EMAIL);
    setPassword(DEMO_ADMIN_PASSWORD);
    setError('');
    setBusy(true);

    try {
      // Real authentication via existing login system — server-side RBAC enforced
      await login({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  // Determine customer storefront URL for quick return
  const storefrontUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5173'
    : 'https://majesticblazer.com';

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* Brand Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <img src={logo} alt="Majestic Blazer: Style that speaks" className={styles.logo} />
          </div>
          <span className={styles.eyebrow}>ATELIER OPERATIONS CONSOLE</span>
          <h1 className={styles.title}>ADMINISTRATOR ACCESS</h1>
          <p className={styles.subtitle}>
            Authorized personnel only. Access inventory controls, customer orders, rental bookings and analytics.
          </p>
        </div>

        {logoutMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(46, 213, 115, 0.1)',
            border: '1px solid rgba(46, 213, 115, 0.3)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            color: '#2ed573',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}>
            <CheckCircle2 size={16} />
            <span>{logoutMessage}</span>
          </div>
        )}

        {/* Admin Login Form */}
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.fieldLabel}>
            <span>EMAIL ADDRESS</span>
            <input
              name="email"
              type="email"
              placeholder="e.g. admin@majesticblazer.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className={styles.input}
            />
          </label>

          <label className={styles.fieldLabel}>
            <span>PASSWORD</span>
            <input
              name="password"
              type="password"
              placeholder="Your administrator password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className={styles.input}
            />
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button type="submit" disabled={busy} className={styles.submitBtn}>
            {busy ? 'Authenticating...' : 'SIGN IN TO ATELIER CONSOLE'}
          </button>
        </form>

        {/* Expandable DEVELOPMENT DEMO ACCESS Section */}
        {!isProduction && (
          <div className={styles.demoSection}>
            <button
              type="button"
              className={styles.demoToggle}
              onClick={() => setDemoExpanded((prev) => !prev)}
              aria-expanded={demoExpanded}
            >
              <div className={styles.demoToggleLeft}>
                <ShieldCheck size={16} className={styles.demoShield} />
                <span>DEVELOPMENT DEMO ACCESS</span>
              </div>
              <div className={styles.demoToggleRight}>
                <span className={styles.demoBadge}>ADMIN RBAC</span>
                {demoExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {demoExpanded && (
              <div className={styles.demoContent}>
                <p className={styles.demoDesc}>
                  Pre-configured development administrator account with full privileges across catalog, orders, rentals, inventory and analytics.
                </p>

                <div className={styles.demoCreds}>
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Admin Email:</span>
                    <span className={styles.credValueWrap}>
                      <code className={styles.credValue}>{DEMO_ADMIN_EMAIL}</code>
                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className={styles.copyBtn}
                        title="Copy email"
                      >
                        {copiedEmail ? <Check size={14} className={styles.checkIcon} /> : <Copy size={14} />}
                      </button>
                    </span>
                  </div>
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Password:</span>
                    <code className={styles.credValue}>{DEMO_ADMIN_PASSWORD}</code>
                  </div>
                </div>

                <div className={styles.demoActions}>
                  <button
                    type="button"
                    className={styles.autoFillBtn}
                    onClick={handleAutoFillDemo}
                  >
                    Auto-fill Admin Credentials
                  </button>
                  <button
                    type="button"
                    className={styles.quickSignInBtn}
                    onClick={handleQuickDemoSignIn}
                    disabled={busy}
                  >
                    <span>{busy ? 'Authenticating...' : 'Sign in as Demo Admin'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Security & Return Footer */}
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
