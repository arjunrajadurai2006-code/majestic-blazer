import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, ShieldAlert } from 'lucide-react';
import styles from './NotFound.module.css';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ShieldAlert size={36} className={styles.icon} />
        </div>
        <span className={styles.eyebrow}>ATELIER MANAGEMENT CONSOLE</span>
        <h1 className={styles.title}>404 — Management Route Not Found</h1>
        <p className={styles.description}>
          The requested atelier administrative view or module does not exist, has been retired, or moved to another section.
        </p>
        <div className={styles.actions}>
          <Link to="/" className={styles.primaryBtn}>
            <Compass size={16} />
            <span>Return to Dashboard</span>
          </Link>
          <button type="button" onClick={() => navigate(-1)} className={styles.secondaryBtn}>
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
