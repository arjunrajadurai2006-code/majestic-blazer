import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBackNavigationContext, getFallbackRoute } from '../../context/BackNavigationContext';
import styles from './BackButton.module.css';

/**
 * Reusable BackButton component.
 * Uses React Router history to return to previous page with intelligent safe fallback.
 * 
 * @param {Object} props
 * @param {string} [props.fallback] - Fallback route override
 * @param {Function} [props.customHandler] - Custom click handler
 * @param {string} [props.label='Back'] - Button label
 * @param {string} [props.className] - Additional CSS class
 */
export default function BackButton({
  fallback,
  customHandler,
  label,
  className = '',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useBackNavigationContext();

  const effectiveLabel = label || config.label || 'Back';
  const effectiveHandler = customHandler || config.customHandler;
  const effectiveFallback = fallback || config.fallback || getFallbackRoute(location.pathname);

  const handleClick = (e) => {
    e.preventDefault();

    // 1. If page provides a custom back handler, execute it
    if (effectiveHandler) {
      effectiveHandler();
      return;
    }

    // 2. Check if valid in-app navigation history exists in the current session
    // In React Router v6:
    // - Initial entry or hard refresh has location.key === 'default' and window.history.state.idx === 0 (or null)
    const hasInAppHistory =
      typeof window !== 'undefined' &&
      window.history.state &&
      typeof window.history.state.idx === 'number' &&
      window.history.state.idx > 0 &&
      location.key !== 'default';

    if (hasInAppHistory) {
      // Safe to step back in browser history within app
      navigate(-1);
    } else {
      // Direct access, refresh, or external link -> use sensible in-app fallback
      navigate(effectiveFallback, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${styles.backButton} ${className}`.trim()}
      aria-label="Go back to previous page"
      title="Back"
    >
      <span className={styles.arrowIcon}>
        <ArrowLeft size={15} />
      </span>
      <span className={styles.label}>{effectiveLabel}</span>
    </button>
  );
}
