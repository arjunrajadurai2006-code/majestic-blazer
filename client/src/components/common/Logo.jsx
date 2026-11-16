import { Link } from 'react-router-dom';
import logo from '../../assets/majestic-blazer-logo.jpeg';

// Official logo: never crop, recolor or stretch. Size by height only so proportions are preserved.
export default function Logo({ height = 48, className, onClick }) {
  return (
    <Link 
      to="/" 
      aria-label="Majestic Blazer home" 
      className={className}
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
    >
      <img 
        src={logo} 
        alt="Majestic Blazer: Style that speaks" 
        style={{ height, width: 'auto', display: 'block', objectFit: 'contain' }} 
      />
    </Link>
  );
}
