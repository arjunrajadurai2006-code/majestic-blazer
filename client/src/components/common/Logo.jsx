import { Link } from 'react-router-dom';
import logo from '../../assets/majestic-blazer-logo.jpeg';

// Official logo: never crop, recolor or stretch. Size by height only so proportions are preserved.
export default function Logo({ height = 56 }) {
  return (
    <Link to="/" aria-label="Majestic Blazer home">
      <img src={logo} alt="Majestic Blazer: Style that speaks" style={{ height, width: 'auto' }} />
    </Link>
  );
}
