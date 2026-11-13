import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import Button from './Button';
import styles from './AuthForm.module.css';

const COPY = {
  login: { title: 'Patron Sign In', action: 'Sign in to Account', alt: ['New to Majestic Blazer?', 'Create an account', '/register'] },
  register: { title: 'Create Patron Account', action: 'Join Majestic Blazer', alt: ['Already registered?', 'Sign in', '/login'] },
};

export default function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const copy = COPY[mode];

  const onSubmit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      await (mode === 'login' ? login(data) : register(data));
      navigate(location.state?.from || '/profile', { replace: true });
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

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {mode === 'register' && (
            <>
              <label>
                Full Name
                <input name="fullName" placeholder="e.g. Arvind Rajan" autoComplete="name" required />
              </label>
              <label>
                Phone Number
                <input name="phone" type="tel" placeholder="e.g. 8903238882" autoComplete="tel" />
              </label>
            </>
          )}

          <label>
            Email Address
            <input name="email" type="email" placeholder="e.g. patron@example.com" autoComplete="email" required />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              placeholder={mode === 'register' ? 'Min 8 chars, 1 letter, 1 number' : 'Your account password'}
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

          <Button type="submit" disabled={busy} className={styles.submitBtn}>
            {busy ? 'Authenticating...' : copy.action}
          </Button>

          <p className={styles.alt}>
            {copy.alt[0]} <Link to={copy.alt[2]}>{copy.alt[1]}</Link>
          </p>
        </form>

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
