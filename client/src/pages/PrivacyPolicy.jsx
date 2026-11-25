import { useDocumentSeo } from '../utils/seo';
import styles from './Legal.module.css';

export default function PrivacyPolicy() {
  useDocumentSeo({
    title: 'Privacy Policy | MAJESTIC BLAZER',
    description: 'Privacy Policy for Majestic Blazer menswear atelier and online storefront.',
    path: '/privacy-policy',
  });
  return (
    <div className={`container ${styles.page}`}>
      <span className={styles.eyebrow}>LEGAL POLICIES</span>
      <h1>Privacy Policy</h1>
      <p className={styles.updated}>Last Updated: November 2026</p>

      <div className={styles.content}>
        <section>
          <h2>1. Introduction & Brand Commitment</h2>
          <p>
            Majestic Blazer ("we", "our", or "us"), operating our flagship menswear atelier on Sathy Road, Kurumbampalayam, Coimbatore - 641107, is committed to safeguarding the privacy and personal data of our esteemed patrons. This Privacy Policy outlines our procedures regarding collection, use, and protection of your personal information.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>
            When you purchase a blazer or register an account, we collect:
          </p>
          <ul>
            <li>Full Name, contact telephone number, and email address</li>
            <li>Billing and shipping addresses for courier delivery</li>
            <li>Chest size, fitting preferences, and tailored measurements</li>
            <li>Transaction identifiers and payment status (we do NOT store credit card numbers or banking passwords)</li>
          </ul>
        </section>

        <section>
          <h2>3. Payment Security & Razorpay</h2>
          <p>
            All electronic payments, including credit cards, debit cards, net banking, and UPI, are processed through secure, PCI-DSS Level 1 compliant payment gateways (such as Razorpay). We never access or store raw cardholder data.
          </p>
        </section>

        <section>
          <h2>4. In-Store Consultations & Fitting Records</h2>
          <p>
            Fitting measurements and personal notes taken at our Coimbatore boutique are stored securely in our client database to provide seamless future alterations and re-orders.
          </p>
        </section>

        <section>
          <h2>5. Contact Our Privacy Officer</h2>
          <p>
            For inquiries regarding your personal data, reach out directly to:
            <br />
            <strong>Majestic Blazer</strong>
            <br />
            Sathy Road, Kurumbampalayam, Coimbatore - 641107
            <br />
            Phone: +91 8903238882 | Email: contact@majesticblazer.com
          </p>
        </section>
      </div>
    </div>
  );
}
