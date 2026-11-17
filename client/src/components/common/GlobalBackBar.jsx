import { useLocation } from 'react-router-dom';
import { useBackNavigationContext } from '../../context/BackNavigationContext';
import BackButton from './BackButton';
import styles from './GlobalBackBar.module.css';

/**
 * Global back navigation sub-bar.
 * Automatically displays on all non-home customer routes.
 */
export default function GlobalBackBar() {
  const location = useLocation();
  const { config } = useBackNavigationContext();

  // Never render on the homepage root or if explicitly configured as hidden
  const isHome = location.pathname === '/';
  if (isHome || config.hidden) {
    return null;
  }

  return (
    <nav className={styles.bar} aria-label="Breadcrumb navigation">
      <div className="container">
        <BackButton />
      </div>
    </nav>
  );
}
