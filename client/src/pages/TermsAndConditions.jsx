import { useDocumentSeo } from '../utils/seo';
import styles from './Legal.module.css';

export default function TermsAndConditions() {
  useDocumentSeo({
    title: 'Terms & Conditions | MAJESTIC BLAZER',
    description: 'Terms and Conditions for purchasing luxury blazers and tailoring services from Majestic Blazer.',
    path: '/terms-and-conditions',
  });
  return (
    <div className={`container ${styles.page}`}>
      <span className={styles.eyebrow}>LEGAL AGREEMENT</span>
      <h1>Terms & Conditions</h1>
      <p className={styles.updated}>Last Updated: November 2026</p>

      <div className={styles.content}>
        <section>
          <h2>1. Agreement to Terms</h2>
          <p>
            Welcome to Majestic Blazer ("Majestic Blazer", "we", "us", or "our"). By accessing or using our website or purchasing our premium menswear from our boutique located at Sathy Road, Kurumbampalayam, Coimbatore - 641107, you agree to be bound by these Terms and Conditions.
          </p>
        </section>

        <section>
          <h2>2. Sartorial Purchases & Order Fulfillment</h2>
          <p>
            All blazer purchases are subject to stock availability and quality inspection prior to dispatch.
          </p>
          <ul>
            <li><strong>Delivery:</strong> Express nationwide shipping takes 3–5 business days. Complimentary in-store collection is available at our Coimbatore atelier.</li>
            <li><strong>Alterations:</strong> Minor sleeve and waist adjustments are available in-store upon presentation of your purchase invoice.</li>
            <li><strong>Returns & Exchanges:</strong> Unaltered garments with original tags intact may be exchanged within 7 days of delivery.</li>
          </ul>
        </section>

        <section id="alterations-policy">
          <h2>3. Bespoke Alterations & Atelier Services</h2>
          <p>
            Majestic Blazer offers complimentary master alterations on all blazer purchases at our Coimbatore boutique.
          </p>
          <div className={styles.highlightBox}>
            <h3>Precision Tailoring & Custom Contour</h3>
            <p>
              Every garment is crafted to allow minor sleeve length and waist contour adjustments. Consult our master tailors in-store for personalized fitting appointments.
            </p>
          </div>
          <ul>
            <li><strong>Complimentary Alterations:</strong> Sleeve shortening/lengthening and waist adjustments are provided free of charge for patrons within 30 days of purchase.</li>
            <li><strong>Garment Care:</strong> All blazers are constructed with natural fibers and floating horsehair canvases. Professional dry-cleaning with low-moisture steam is recommended.</li>
          </ul>
        </section>

        <section>
          <h2>4. Care & Maintenance Policy</h2>
          <ul>
            <li><strong>Storage:</strong> Always store your blazer on the provided contoured wooden hanger inside a breathable garment bag.</li>
            <li><strong>Pressing:</strong> Use gentle steam only. Never iron directly onto velvet, silk lapels, or metallic thread embroideries.</li>
            <li><strong>Repairs:</strong> Our atelier offers lifetime button replacement and seam reinforcement services for registered patrons.</li>
          </ul>
        </section>

        <section>
          <h2>5. Cancellation & Refund Policy</h2>
          <ul>
            <li><strong>Purchases:</strong> Orders cancelled prior to courier dispatch will receive a 100% refund.</li>
          </ul>
        </section>

        <section>
          <h2>6. Invoices & Billing</h2>
          <p>
            An official GST-compliant tax invoice is generated for every purchase transaction, accessible from your customer dashboard or directly via email. The invoice itemizes garment pricing, taxes, and courier details.
          </p>
        </section>

        <section>
          <h2>7. Contact & Dispute Resolution</h2>
          <p>
            Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts in Coimbatore, Tamil Nadu, India.
            <br /><br />
            <strong>Majestic Blazer Flagship Boutique</strong><br />
            Sathy Road, Kurumbampalayam, Coimbatore - 641107<br />
            Helpline: +91 8903238882 | Email: contact@majesticblazer.com
          </p>
        </section>
      </div>
    </div>
  );
}
