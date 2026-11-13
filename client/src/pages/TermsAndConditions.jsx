import styles from './Legal.module.css';

export default function TermsAndConditions() {
  return (
    <div className={`container ${styles.page}`}>
      <span className={styles.eyebrow}>LEGAL AGREEMENT</span>
      <h1>Terms & Conditions</h1>
      <p className={styles.updated}>Last Updated: November 2026</p>

      <div className={styles.content}>
        <section>
          <h2>1. Agreement to Terms</h2>
          <p>
            Welcome to Majestic Blazer ("Majestic Blazer", "we", "us", or "our"). By accessing or using our website, purchasing our premium menswear, or reserving rental garments from our boutique located at Sathy Road, Kurumbampalayam, Coimbatore - 641107, you agree to be bound by these Terms and Conditions.
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

        <section>
          <h2>3. Blazer Rental Service Agreement</h2>
          <p>
            Majestic Blazer offers luxury blazer and tuxedo rentals for weddings, black-tie galas, convocations, and corporate engagements.
          </p>
          <div className={styles.highlightBox}>
            <h3>Rental Period & Timing</h3>
            <p>
              Standard rental duration options are 3 Days, 5 Days, or 7 Days. Your rental period begins on the selected delivery/pickup date and concludes when the garment is received back at our store or handed to our courier.
            </p>
          </div>
          <ul>
            <li><strong>Refundable Security Deposit:</strong> A mandatory refundable security deposit is collected for each rental garment. This deposit is held separately from rental charges and is refunded to your original payment method within 24–48 hours following garment return and condition inspection.</li>
            <li><strong>Complimentary Dry Cleaning:</strong> You do NOT need to dry clean the blazer prior to return. Every rental blazer undergoes certified eco-friendly dry cleaning and sanitization by our specialists.</li>
            <li><strong>Garment Care:</strong> Patrons agree to treat garments with utmost care. Do not iron directly on velvet, satin lapels, or metallic thread embroideries.</li>
          </ul>
        </section>

        <section>
          <h2>4. Late Returns, Damage & Loss Policy</h2>
          <ul>
            <li><strong>Late Returns:</strong> Garments returned past the scheduled end date incur a daily late fee of ₹500/day, deducted directly from the security deposit.</li>
            <li><strong>Minor Wear:</strong> Normal creases and minor dust are expected and covered under standard rental fees.</li>
            <li><strong>Major Damage:</strong> Irreparable tears, cigarette burns, permanent ink/dye stains, or missing hardware (custom brass buttons) will be assessed. Repair costs or replacement fees up to the retail value of the blazer will be deducted from the deposit.</li>
            <li><strong>Total Loss / Non-Return:</strong> Failure to return the garment within 7 days of the scheduled return date will be treated as purchase at full retail price, forfeiting the full deposit and initiating recovery proceedings.</li>
          </ul>
        </section>

        <section>
          <h2>5. Cancellation & Refund Policy</h2>
          <ul>
            <li><strong>Purchases:</strong> Orders cancelled prior to courier dispatch will receive a 100% refund.</li>
            <li><strong>Rental Bookings:</strong> Cancellations made at least 48 hours before the rental start date qualify for a full refund of rental charges and security deposit. Cancellations made within 48 hours will incur a 20% restocking fee.</li>
          </ul>
        </section>

        <section>
          <h2>6. Invoices & Billing</h2>
          <p>
            An official GST-compliant tax invoice is generated for every purchase and rental transaction, accessible from your customer dashboard or directly via email. The invoice itemizes garment pricing, rental fees, taxes, and explicitly distinguishes refundable security deposits.
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
