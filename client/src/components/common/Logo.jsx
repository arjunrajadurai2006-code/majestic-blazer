import { Link } from 'react-router-dom';
import logo from '../../assets/majestic-blazer-logo.jpeg';
import styles from './Logo.module.css';

/**
 * Majestic Blazer Official Brand Logo
 * 
 * @param {'header'|'bare'} [variant='header'] - 'header' renders a refined luxury surface badge; 'bare' renders clean without container styles
 * @param {number} [height] - Optional explicit height override
 * @param {string} [className] - Additional CSS classes
 * @param {function} [onClick] - Optional click handler (e.g. close mobile drawer)
 */
export default function Logo({ 
  height, 
  variant = 'header', 
  className = '', 
  onClick 
}) {
  const isHeader = variant === 'header';
  const badgeClass = isHeader ? styles.headerBadge : styles.bare;

  const linkStyle = height && !isHeader ? { height } : undefined;
  const imgStyle = height && !isHeader ? { height: '100%' } : undefined;

  return (
    <Link 
      to="/" 
      aria-label="Majestic Blazer home" 
      className={`${styles.logoLink} ${badgeClass} ${className}`.trim()}
      onClick={onClick}
      style={linkStyle}
    >
      <img 
        src={logo} 
        alt="Majestic Blazer: Style that speaks" 
        className={styles.logoImg}
        width="180"
        height="100"
        style={imgStyle}
      />
    </Link>
  );
}
