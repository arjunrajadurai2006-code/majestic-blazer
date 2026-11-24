import { Link } from 'react-router-dom';
import { User, ShieldCheck, ArrowRight, Lock, Sparkles } from 'lucide-react';
import Logo from '../components/common/Logo';
import { ADMIN_APP_URL } from '../config/urls';
import styles from './AccountAccess.module.css';

export default function AccountAccess() {
  const adminLoginUrl = `${ADMIN_APP_URL}/login`;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* Brand Header */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <Logo height={52} variant="bare" />
          </div>
          <span className={styles.eyebrow}>MAJESTIC BLAZER</span>
          <h1 className={styles.title}>Account Access</h1>
          <p className={styles.subtitle}>
            Select your portal to proceed to your dedicated authentication environment.
          </p>
        </div>

        {/* Section 1: Customer / Patron */}
        <section className={`${styles.portalSection} ${styles.customerSection}`} aria-labelledby="customer-portal-title">
          <div className={styles.sectionMeta}>
            <div className={styles.iconWrap}>
              <User size={20} className={styles.portalIcon} />
            </div>
            <div className={styles.sectionHeaderInfo}>
              <div className={styles.portalBadge}>
                <Sparkles size={12} className={styles.badgeIcon} />
                <span>Patron Services</span>
              </div>
              <h2 id="customer-portal-title" className={styles.sectionTitle}>
                CUSTOMER / PATRON
              </h2>
            </div>
          </div>

          <p className={styles.description}>
            Access shopping history, saved pieces, address book and official tax invoices.
          </p>

          <Link to="/login" className={styles.customerBtn}>
            <span>CUSTOMER SIGN IN</span>
            <ArrowRight size={16} />
          </Link>
        </section>

        {/* Subtle Luxury Divider */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>SECURE ACCESS DOMAINS</span>
          <span className={styles.dividerLine} />
        </div>

        {/* Section 2: Administrator */}
        <section className={`${styles.portalSection} ${styles.adminSection}`} aria-labelledby="admin-portal-title">
          <div className={styles.sectionMeta}>
            <div className={`${styles.iconWrap} ${styles.adminIconWrap}`}>
              <ShieldCheck size={20} className={styles.adminPortalIcon} />
            </div>
            <div className={styles.sectionHeaderInfo}>
              <div className={`${styles.portalBadge} ${styles.adminBadge}`}>
                <Lock size={12} className={styles.badgeIcon} />
                <span>Atelier Operations</span>
              </div>
              <h2 id="admin-portal-title" className={styles.sectionTitle}>
                ADMINISTRATOR
              </h2>
            </div>
          </div>

          <p className={styles.description}>
            Manage products, inventory, orders, customers, finances and analytics.
          </p>

          <a
            href={adminLoginUrl}
            className={styles.adminBtn}
            rel="noopener noreferrer"
          >
            <span>ADMIN SIGN IN</span>
            <ArrowRight size={16} />
          </a>
        </section>

        {/* Security & Navigation Footer */}
        <footer className={styles.footer}>
          <div className={styles.securityNote}>
            <Lock size={14} className={styles.lockIcon} />
            <span>256-Bit Encrypted TLS Session • Isolated Permission Domains</span>
          </div>
          <Link to="/" className={styles.backLink}>
            ← Return to Majestic Blazer Boutique
          </Link>
        </footer>
      </div>
    </div>
  );
}
