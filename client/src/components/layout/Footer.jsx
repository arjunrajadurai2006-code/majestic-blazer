import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Logo from '../common/Logo';
import styles from './Footer.module.css';

export const BUSINESS = {
  name: 'Majestic Blazer',
  tagline: 'Style That Speaks',
  address: 'Majestic Blazer Shop – First Floor, Shop No. 99/6, Sathy Rd, Opp. to Saravana Bhavan Hotel, Kurumbapalayam, Coimbatore - 641107',
  phone: '8903238882',
  email: 'contact@majesticblazer.com',
  hours: 'Mon – Sat: 10:00 AM – 9:00 PM | Sunday: 11:00 AM – 8:00 PM',
  instagram: 'https://www.instagram.com/majesticblazers/',
};

// Vector Instagram icon matching stroke/dimensions of theme icons
function InstagramIcon({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export default function Footer() {
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (section) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  return (
    <footer className={styles.footer} id="site-footer">
      <div className={`container ${styles.grid}`}>
        {/* Brand & Atelier Coordinates */}
        <div className={styles.brand}>
          <Logo height={44} variant="bare" className={styles.brandLogo} />
          <p className={styles.tagline}>{BUSINESS.tagline}</p>

          <address className={styles.address}>
            <p className={styles.addressTitle}>Majestic Blazer Shop</p>
            <p className={styles.addressLine}>First Floor, Shop No. 99/6, Sathy Rd</p>
            <p className={styles.addressLine}>Opp. to Saravana Bhavan Hotel</p>
            <p className={styles.addressLine}>Kurumbapalayam, Coimbatore - 641107</p>

            <div className={styles.contactRow}>
              <a href={`tel:+91${BUSINESS.phone}`} className={styles.phoneLink}>
                +91&nbsp;{BUSINESS.phone}
              </a>
              <span className={styles.dotSeparator}>•</span>
              <a href={`mailto:${BUSINESS.email}`} className={styles.emailLink}>
                {BUSINESS.email}
              </a>
            </div>

            <p className={styles.hours}>
              <span className={styles.hoursLabel}>Hours:</span> {BUSINESS.hours}
            </p>
          </address>

          {/* Instagram Official Store Link */}
          <div className={styles.socialRow}>
            <a
              href={BUSINESS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.instagramLink}
              aria-label="Visit Majestic Blazer on Instagram"
            >
              <InstagramIcon size={18} className={styles.instagramIcon} />
              <span>@majesticblazers</span>
            </a>
          </div>
        </div>

        {/* Column 1: Bespoke & Services */}
        <div className={styles.col}>
          <button
            type="button"
            className={styles.colHeaderBtn}
            onClick={() => toggleSection('bespoke')}
            aria-expanded={openSection === 'bespoke'}
          >
            <span>Bespoke & Services</span>
            <ChevronDown
              size={15}
              className={`${styles.colChevron} ${openSection === 'bespoke' ? styles.chevronRotated : ''}`}
            />
          </button>
          <ul className={`${styles.colList} ${openSection === 'bespoke' ? styles.listOpen : ''}`}>
            <li><Link to="/contact">Private Fitting Appointments</Link></li>
            <li><Link to="/contact">Bespoke Tailoring Consultations</Link></li>
            <li><Link to="/terms-and-conditions">Garment Care & Alterations</Link></li>
          </ul>
        </div>

        {/* Column 2: Client Service */}
        <div className={styles.col}>
          <button
            type="button"
            className={styles.colHeaderBtn}
            onClick={() => toggleSection('client')}
            aria-expanded={openSection === 'client'}
          >
            <span>Client Service</span>
            <ChevronDown
              size={15}
              className={`${styles.colChevron} ${openSection === 'client' ? styles.chevronRotated : ''}`}
            />
          </button>
          <ul className={`${styles.colList} ${openSection === 'client' ? styles.listOpen : ''}`}>
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/terms-and-conditions">Return & Delivery Policy</Link></li>
            <li><Link to="/terms-and-conditions">Terms & Conditions</Link></li>
          </ul>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>© {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
        <p className={styles.signature}>Crafted for distinguished gentlemen in Coimbatore, India.</p>
      </div>
    </footer>
  );
}
