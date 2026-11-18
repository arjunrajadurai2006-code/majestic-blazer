import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBackNavigationContext, getFallbackRoute, checkHasInAppHistory } from '../../context/BackNavigationContext';
import styles from './BackButton.module.css';

/**
 * Reusable BackButton component.
 * Uses React Router history to return to previous page with multi-factor safe fallback.
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

    // 2. Multi-factor verification of useful in-app history
    // (Checks reload status, session stack, history index, and location key)
    const hasInAppHistory = checkHasInAppHistory(location);

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
