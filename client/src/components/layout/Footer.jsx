import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  const { success } = useToast();
  const adminLoginUrl = `${ADMIN_APP_URL}/login`;

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
        <div className={styles.brand}>
          <Logo height={56} variant="bare" />
          <p className={styles.tagline}>{BUSINESS.tagline}</p>
          <address className={styles.address}>
            <p>{BUSINESS.address}</p>
            <p><a href={`tel:+91${BUSINESS.phone}`} className={styles.phoneLink}>Phone: +91 {BUSINESS.phone}</a></p>
            <p><a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a></p>
            <p className={styles.hours}>{BUSINESS.hours}</p>
          </address>
        </div>

        <div className={styles.col}>
          <h3>Sartorial Collections</h3>
          <ul>
            <li><Link to="/shop">All Blazers</Link></li>
            <li><Link to="/shop?category=wedding-partywear">Wedding & Partywear</Link></li>
            <li><Link to="/shop?category=formal-blazers">Formal & Corporate</Link></li>
            <li><Link to="/shop?category=tuxedos-black-tie">Tuxedos & Black Tie</Link></li>
            <li><Link to="/shop?category=casual-smart">Casual & Smart</Link></li>
          </ul>
        </div>

        <div className={styles.col}>
          <h3>Bespoke & Services</h3>
          <ul>
            <li><Link to="/contact">Private Fitting Appointments</Link></li>
            <li><Link to="/contact">Bespoke Tailoring Consultations</Link></li>
            <li><Link to="/terms-and-conditions">Garment Care & Alterations</Link></li>
            <li><Link to="/terms-and-conditions">Delivery & Returns Policy</Link></li>
          </ul>
        </div>

        <div className={styles.col}>
          <h3>Client Service</h3>
          <ul>
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

        <div className={styles.newsletter}>
          <h3>The Private Gazette</h3>
          <p>Receive exclusive access to new fabric drops, trunk shows, and seasonal luxury blazer collections.</p>
          <form onSubmit={handleSubscribe} className={styles.newsForm}>
            <input
              type="email"
              aria-label="Email address for The Private Gazette newsletter"
              placeholder="Enter your email address"
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
