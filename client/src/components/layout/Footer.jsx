import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Logo from '../common/Logo';
import { useToast } from '../../context/ToastContext';
import { ADMIN_APP_URL } from '../../config/urls';
import styles from './Footer.module.css';

export const BUSINESS = {
  name: 'Majestic Blazer',
  tagline: 'Style That Speaks',
  address: 'Sathy Road, Kurumbampalayam, Coimbatore - 641107',
  phone: '8903238882',
  email: 'contact@majesticblazer.com',
  hours: 'Mon – Sat: 10:00 AM – 9:00 PM | Sunday: 11:00 AM – 8:00 PM',
};

export default function Footer() {
  const [email, setEmail] = useState('');
  const [openSection, setOpenSection] = useState(null);
  const { success } = useToast();
  const adminLoginUrl = `${ADMIN_APP_URL}/login`;

  const toggleSection = (section) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      success('Thank you for subscribing to Majestic Blazer private invitations.');
      setEmail('');
    }
  };

  return (
    <footer className={styles.footer} id="site-footer">
      <div className={`container ${styles.grid}`}>
        {/* Brand & Atelier Coordinates */}
        <div className={styles.brand}>
          <Logo height={48} variant="bare" className={styles.brandLogo} />
          <p className={styles.tagline}>{BUSINESS.tagline}</p>
          <address className={styles.address}>
            <p>{BUSINESS.address}</p>
            <div className={styles.contactRow}>
              <a href={`tel:+91${BUSINESS.phone}`} className={styles.phoneLink}>+91 {BUSINESS.phone}</a>
              <span className={styles.dotSeparator}>•</span>
              <a href={`mailto:${BUSINESS.email}`} className={styles.emailLink}>{BUSINESS.email}</a>
            </div>
            <p className={styles.hours}>{BUSINESS.hours}</p>
          </address>
        </div>

        {/* Column 1: Sartorial Collections */}
        <div className={styles.col}>
          <button
            type="button"
            className={styles.colHeaderBtn}
            onClick={() => toggleSection('collections')}
            aria-expanded={openSection === 'collections'}
          >
            <span>Sartorial Collections</span>
            <ChevronDown
              size={15}
              className={`${styles.colChevron} ${openSection === 'collections' ? styles.chevronRotated : ''}`}
            />
          </button>
          <ul className={`${styles.colList} ${openSection === 'collections' ? styles.listOpen : ''}`}>
            <li><Link to="/shop">All Blazers</Link></li>
            <li><Link to="/shop?category=wedding-partywear">Wedding & Partywear</Link></li>
            <li><Link to="/shop?category=formal-blazers">Formal & Corporate</Link></li>
            <li><Link to="/shop?category=tuxedos-black-tie">Tuxedos & Black Tie</Link></li>
            <li><Link to="/shop?category=casual-smart">Casual & Smart</Link></li>
          </ul>
        </div>

        {/* Column 2: Bespoke & Services */}
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
            <li><Link to="/terms-and-conditions">Delivery & Returns Policy</Link></li>
          </ul>
        </div>

        {/* Column 3: Client Service */}
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
            <li><Link to="/profile">My Account</Link></li>
            <li><Link to="/orders">Order History & Invoices</Link></li>
            <li><Link to="/wishlist">Saved Pieces</Link></li>
            <li><Link to="/contact">Contact Our Tailors</Link></li>
            <li><Link to="/access">Account Access</Link></li>
            <li><a href={adminLoginUrl} className={styles.adminFooterLink} target="_blank" rel="noopener noreferrer">Atelier Admin</a></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/terms-and-conditions">Terms & Conditions</Link></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div className={styles.newsletter}>
          <h3>The Private Gazette</h3>
          <p>Receive exclusive access to new fabric drops, trunk shows, and seasonal luxury blazer collections.</p>
          <form onSubmit={handleSubscribe} className={styles.newsForm}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.newsInput}
            />
            <button type="submit" className={styles.newsBtn}>Subscribe</button>
          </form>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>© {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
        <p className={styles.signature}>Crafted for distinguished gentlemen in Coimbatore, India.</p>
      </div>
    </footer>
  );
}
