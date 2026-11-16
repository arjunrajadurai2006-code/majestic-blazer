import { useState } from 'react';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { BUSINESS } from '../components/layout/Footer';
import styles from './Contact.module.css';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Private Fitting Consultation');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { success, error: toastError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/contact', { name, email, phone, subject, message });
      setSubmitted(true);
      success('Thank you. Our tailoring consultants will get in touch shortly.');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err) {
      toastError(err.message || 'Failed to submit enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>ATELIER & BESPOKE APPOINTMENTS</span>
        <h1>Connect With Majestic Blazer</h1>
        <p className={styles.subtitle}>
          Schedule a private fitting at our Coimbatore flagship boutique, inquire about wedding party rentals,
          or discuss custom tailoring with our master consultants.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Left: Contact Details */}
        <div className={styles.infoCol}>
          <div className={styles.infoCard}>
            <h2>Flagship Atelier</h2>

            <div className={styles.infoRow}>
              <MapPin size={22} className={styles.infoIcon} />
              <div>
                <strong>Physical Address</strong>
                <address className={styles.address}>
                  {BUSINESS.address}
                </address>
              </div>
            </div>

            <div className={styles.infoRow}>
              <Phone size={22} className={styles.infoIcon} />
              <div>
                <strong>Bespoke & Rental Hotline</strong>
                <a href={`tel:+91${BUSINESS.phone}`} className={styles.phoneLink}>
                  +91 {BUSINESS.phone}
                </a>
              </div>
            </div>

            <div className={styles.infoRow}>
              <Mail size={22} className={styles.infoIcon} />
              <div>
                <strong>Direct Correspondence</strong>
                <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
              </div>
            </div>

            <div className={styles.infoRow}>
              <Clock size={22} className={styles.infoIcon} />
              <div>
                <strong>Consultation Hours</strong>
                <span>{BUSINESS.hours}</span>
              </div>
            </div>
          </div>

          <div className={styles.coimbatoreNote}>
            <h3>Visiting from Outside Coimbatore?</h3>
            <p>
              We are located directly along Sathy Road, Kurumbampalayam, easily accessible within 20 minutes from Coimbatore International Airport. Valet parking and private fitting suites are available for our patrons.
            </p>
          </div>
        </div>

        {/* Right: Working Enquiry Form */}
        <div className={styles.formCol}>
          <div className={styles.formCard}>
            <h2>Send an Inquiry / Schedule a Fitting</h2>

            {submitted ? (
              <div className={styles.successBox}>
                <CheckCircle2 size={48} className={styles.successIcon} />
                <h3>Enquiry Recorded</h3>
                <p>
                  Our senior tailoring consultant has received your message and will reach out via
                  phone or email within 4 hours.
                </p>
                <button type="button" onClick={() => setSubmitted(false)} className={styles.newEnquiryBtn}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label htmlFor="contact-name" className={styles.label}>Full Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Arvind Rajan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="contact-phone" className={styles.label}>Phone Number</label>
                  <input
                    id="contact-phone"
                    type="tel"
                    className={styles.input}
                    placeholder="e.g. 8903238882"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="contact-email" className={styles.label}>Email Address</label>
                  <input
                    id="contact-email"
                    type="email"
                    className={styles.input}
                    placeholder="e.g. arvind@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="contact-subject" className={styles.label}>Subject</label>
                  <div className={styles.selectWrap}>
                    <select
                      id="contact-subject"
                      className={styles.select}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    >
                      <option value="Private Fitting Consultation">Private Fitting Consultation</option>
                      <option value="Wedding & Partywear Rental Inquiry">Wedding & Partywear Rental Inquiry</option>
                      <option value="Corporate Bulk / Group Tailoring">Corporate Bulk / Group Tailoring</option>
                      <option value="Order & Delivery Tracking">Order & Delivery Tracking</option>
                      <option value="Other Sartorial Question">Other Sartorial Question</option>
                    </select>
                  </div>
                </div>

                <div className={`${styles.field} ${styles.fieldTop}`}>
                  <label htmlFor="contact-message" className={styles.label}>Message / Details</label>
                  <textarea
                    id="contact-message"
                    className={styles.textarea}
                    rows={5}
                    placeholder="Mention event dates, preferred blazer style, or your specific requirements..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.buttonRow}>
                  <button type="submit" disabled={submitting} className={styles.submitBtn}>
                    <Send size={16} />
                    <span>{submitting ? 'Transmitting...' : 'Send Message'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
