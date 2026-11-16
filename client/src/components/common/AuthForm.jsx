import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, ChevronDown, ChevronUp, Copy, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import styles from './AuthForm.module.css';

const DEMO_EMAIL = 'customer.demo@majesticblazer.com';
const DEMO_PASSWORD = 'CustomerDemo2026!';

const COPY = {
  login: {
    title: 'Patron Sign In',
    action: 'SIGN IN TO ACCOUNT',
    alt: ['New to Majestic Blazer?', 'Create an account', '/register'],
  },
  register: {
    title: 'Create Patron Account',
    action: 'JOIN MAJESTIC BLAZER',
    alt: ['Already registered?', 'Sign in', '/login'],
  },
};

export default function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Controlled form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // UI & Demo states
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoExpanded, setDemoExpanded] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const copy = COPY[mode];
  const isProduction = import.meta.env.PROD;

  // Development-only: ensure demo account is seeded in PostgreSQL
  useEffect(() => {
    if (mode === 'login' && !isProduction) {
      api.get('/auth/demo-customer').catch(() => {
        // Handled silently; backend script also seeds on server
      });
    }
  }, [mode, isProduction]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    const payload =
      mode === 'login'
        ? { email: email.trim(), password }
        : { fullName: fullName.trim(), phone: phone.trim(), email: email.trim(), password };

    try {
      await (mode === 'login' ? login(payload) : register(payload));
      // Redirect to customer homepage or originally requested page
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAutoFillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
    success('Demo credentials loaded into form.');
  };

  const handleCopyDemoEmail = () => {
    navigator.clipboard?.writeText(DEMO_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleQuickDemoSignIn = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
    setBusy(true);

    try {
      // Real authentication via existing login system — never bypassed
      await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      success('Authenticated as Demo Patron.');
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotMsg(res.message || 'Password reset instructions generated.');
      success('Password reset initiated.');
    } catch (err) {
      toastError(err.message || 'Unable to process reset request.');
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <div className={`container ${styles.wrap}`}>
      <div className={styles.formCard}>
        <h1>{copy.title}</h1>
        <p className={styles.subtext}>
          {mode === 'login'
            ? 'Access your purchase history, active rentals, saved addresses and tax invoices.'
            : 'Register to manage your bespoke blazer orders and reserve rentals seamlessly.'}
        </p>

        {location.state?.message && (
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
            <Check size={16} />
            <span>{location.state.message}</span>
          </div>
        )}

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
            EMAIL ADDRESS
            <input
              name="email"
              type="email"
              placeholder="e.g. patron@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            PASSWORD
            <input
              name="password"
              type="password"
              placeholder={mode === 'register' ? 'Min 8 chars, 1 letter, 1 number' : 'Your account password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {mode === 'login' && (
            <div className={styles.forgotRow}>
              <button
                type="button"
                className={styles.forgotBtn}
                onClick={() => setShowForgot(true)}
              >
                Forgot your password?
              </button>
            </div>
          )}

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button type="submit" disabled={busy} className={styles.submitBtn}>
            {busy ? 'Authenticating...' : copy.action}
          </button>

          <p className={styles.alt}>
            {copy.alt[0]} <Link to={copy.alt[2]}>{copy.alt[1]}</Link>
          </p>
        </form>

        {/* Expandable DEMO CUSTOMER ACCESS Section (Development-only) */}
        {mode === 'login' && !isProduction && (
          <div className={styles.demoSection}>
            <button
              type="button"
              className={styles.demoToggle}
              onClick={() => setDemoExpanded((prev) => !prev)}
              aria-expanded={demoExpanded}
            >
              <div className={styles.demoToggleLeft}>
                <Sparkles size={16} className={styles.demoSparkle} />
                <span>DEMO CUSTOMER ACCESS</span>
              </div>
              <div className={styles.demoToggleRight}>
                <span className={styles.demoBadge}>SANDBOX</span>
                {demoExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {demoExpanded && (
              <div className={styles.demoContent}>
                <p className={styles.demoDesc}>
                  Experience the customer portal with pre-configured order history, active rentals, and saved address preferences.
                </p>

                <div className={styles.demoCreds}>
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Email:</span>
                    <span className={styles.credValueWrap}>
                      <code className={styles.credValue}>{DEMO_EMAIL}</code>
                      <button
                        type="button"
                        onClick={handleCopyDemoEmail}
                        className={styles.copyBtn}
                        title="Copy demo email"
                      >
                        {copiedEmail ? <Check size={14} className={styles.checkIcon} /> : <Copy size={14} />}
                      </button>
                    </span>
                  </div>
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Password:</span>
                    <code className={styles.credValue}>{DEMO_PASSWORD}</code>
                  </div>
                </div>

                <div className={styles.demoActions}>
                  <button
                    type="button"
                    className={styles.autoFillBtn}
                    onClick={handleAutoFillDemo}
                  >
                    Auto-fill Credentials
                  </button>
                  <button
                    type="button"
                    className={styles.quickSignInBtn}
                    onClick={handleQuickDemoSignIn}
                    disabled={busy}
                  >
                    <span>{busy ? 'Authenticating...' : 'Sign in as Demo Patron'}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Forgot Password Modal */}
        {showForgot && (
          <div className={styles.modalOverlay} onClick={() => setShowForgot(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h2>Reset Password</h2>
              <p>Enter the email address associated with your account.</p>

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
                      {forgotBusy ? 'Generating...' : 'Send Reset Link'}
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
