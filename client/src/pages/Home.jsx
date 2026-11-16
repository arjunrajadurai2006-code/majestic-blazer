import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Sparkles, Clock, MapPin, Award, CheckCircle2, ArrowRight } from 'lucide-react';
import ProductCard from '../components/common/ProductCard';
import QuickViewModal from '../components/common/QuickViewModal';
import Button from '../components/common/Button';
import { api } from '../services/api';
import { BUSINESS } from '../components/layout/Footer';
import styles from './Home.module.css';

const RENT_STEPS = [
  {
    no: '01',
    title: 'Select Your Silhouette',
    desc: 'Browse our curated collection of velvet peak lapels, double-breasted navy classics, and black-tie tuxedos.',
  },
  {
    no: '02',
    title: 'Choose Dates & Size',
    desc: 'Select your event dates (1 to 14 days). Real-time inventory verifies availability immediately.',
  },
  {
    no: '03',
    title: 'Wear With Regal Poise',
    desc: 'Collect from our Kurumbampalayam boutique or receive via insured courier. Professional dry-cleaning is on us.',
  },
  {
    no: '04',
    title: 'Simple Return & Deposit Refund',
    desc: 'Bring or send the blazer back on the scheduled return date. Your security deposit is refunded promptly.',
  },
];

const ADVANTAGES = [
  {
    icon: Award,
    title: 'Hand-Canvassed Tailoring',
    desc: 'Built with floating horsehair canvas that gently molds to your chest and shoulders for an unmistakable regal drape.',
  },
  {
    icon: Sparkles,
    title: 'Superfine European Cloth',
    desc: 'Woven with imported Italian cotton velvets, Super 140s Australian Merino wool, and pure silk brocade jacquards.',
  },
  {
    icon: Shield,
    title: 'Transparent Deposit Protection',
    desc: 'Clear rental terms and 100% refundable security deposits tracked seamlessly on your account portal.',
  },
  {
    icon: MapPin,
    title: 'Flagship Coimbatore Boutique',
    desc: 'Visit us on Sathy Road, Kurumbampalayam for private styling consultations, measurement sessions, and custom fittings.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'The navy velvet blazer was the talk of my brother’s reception. You cannot tell it is rented — the drape and peak lapels scream bespoke luxury. Coimbatore finally has a world-class menswear destination.',
    author: 'Karthik Subramanian',
    occasion: 'Wedding Reception Rental',
    city: 'Coimbatore',
    avatar: '/assets/testimonials/patron-karthik.webp',
  },
  {
    quote: 'Purchased the Super 140s black shawl collar tuxedo for an annual leadership gala. Impeccable shoulder construction and razor-sharp silhouette. Style that truly speaks.',
    author: 'Dr. Arvind Rajan',
    occasion: 'Black-Tie Purchase',
    city: 'Chennai',
    avatar: '/assets/testimonials/patron-arvind.webp',
  },
  {
    quote: 'Rented an embroidered bandhgala blazer for a two-day destination sangeet. The booking was effortless, the fit was true to size, and my deposit was credited within 24 hours of return.',
    author: 'Vikram Menon',
    occasion: 'Sangeet Ceremony Rental',
    city: 'Bangalore',
    avatar: '/assets/testimonials/patron-vikram.webp',
  },
];

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [rentalSpotlights, setRentalSpotlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [featRes, rentRes] = await Promise.all([
          api.get('/products?featured=true&limit=4'),
          api.get('/products?type=rent&limit=4'),
        ]);
        setFeaturedProducts(featRes.data || []);
        setRentalSpotlights(rentRes.data || []);
      } catch (err) {
        console.error('Failed to load home products', err);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  return (
    <div className={styles.home}>
      {/* 1. Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroEyebrow}>
            <span className={styles.silverDot} />
            <span>HAUTE COUTURE MENSWEAR • COIMBATORE</span>
          </div>

          <h1 className={styles.heroTitle}>
            STYLE THAT <span className={styles.silverItalic}>SPEAKS.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Command every room you walk into. Invest in a master-tailored blazer to own for life,
            or rent an iconic statement piece for the celebration ahead.
          </p>

          <div className={styles.heroCtas}>
            <Button to="/shop" className={styles.primaryBtn}>
              <span>Shop Collection</span>
              <ArrowRight size={18} />
            </Button>
            <Button to="/rent" variant="outline" className={styles.secondaryBtn}>
              <span>Explore Rentals</span>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Trust Indicators Bar */}
      <section className={styles.trustBar}>
        <div className={`container ${styles.trustGrid}`}>
          <div className={styles.trustItem}>
            <CheckCircle2 size={18} className={styles.trustIcon} />
            <span>Complimentary Fitting at Kurumbampalayam</span>
          </div>
          <div className={styles.trustDivider} />
          <div className={styles.trustItem}>
            <CheckCircle2 size={18} className={styles.trustIcon} />
            <span>Super 140s Wool & Italian Velvet</span>
          </div>
          <div className={styles.trustDivider} />
          <div className={styles.trustItem}>
            <CheckCircle2 size={18} className={styles.trustIcon} />
            <span>100% Refundable Security Deposit</span>
          </div>
        </div>
      </section>

      {/* 2. Buy vs Rent Distinction Banner */}
      <section className={styles.distinction}>
        <div className={`container ${styles.distinctionGrid}`}>
          <div className={styles.distinctionCard}>
            <div className={styles.distinctionMeta}>
              <span className={styles.metaTag}>OWN IT</span>
              <h2>Bespoke Tailoring to Keep</h2>
              <p>
                Timeless blazers crafted with English worsted wool, peak lapels and horn buttons.
                An essential pillar of the modern gentleman’s enduring wardrobe.
              </p>
              <Button to="/shop" variant="outline" className={styles.distinctionBtn}>
                <span>View Purchase Collection</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>

          <div className={`${styles.distinctionCard} ${styles.rentCard}`}>
            <div className={styles.distinctionMeta}>
              <span className={`${styles.metaTag} ${styles.silverMetaTag}`}>BORROW IT</span>
              <h2>Luxury Rentals for the Occasion</h2>
              <p>
                Wear opulence without commitment. Rent luxury tuxedos, royal velvets and brocade
                bandhgalas from ₹1,299 per day with seamless date booking and instant deposit refund.
              </p>
              <Button to="/rent" variant="outline" className={styles.distinctionBtn}>
                <span>View Rental Collection</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Blazer Collection */}
      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleWrap}>
            <span className={styles.sectionEyebrow}>FLAGSHIP TAILORING</span>
            <h2>Signature Blazer Collection</h2>
          </div>
          <Link to="/shop" className={styles.sectionLink}>
            <span>View All Pieces</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className={styles.skeletonGrid}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={styles.skeletonCard} />
            ))}
          </div>
        ) : (
          <div className={styles.productGrid}>
            {featuredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={(prod) => setQuickViewProduct(prod)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Curated Category Paths */}
      <section className={styles.categoriesSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionEyebrow}>CURATED EDITIONS</span>
              <h2>Explore by Sartorial Code</h2>
            </div>
          </div>

          <div className={styles.categoryGrid}>
            <Link to="/shop?category=wedding-partywear" className={styles.categoryCard}>
              <img
                src="/assets/collections/wedding-partywear.webp"
                alt="Wedding and Partywear Blazers"
                className={styles.categoryImage}
              />
              <div className={styles.categoryOverlay}>
                <span className={styles.catLabel}>Sangeet & Receptions</span>
                <h3>Wedding & Partywear</h3>
                <span className={styles.catExplore}>Explore Velvet & Brocades →</span>
              </div>
            </Link>

            <Link to="/shop?category=tuxedos-black-tie" className={styles.categoryCard}>
              <img
                src="/assets/collections/tuxedos-black-tie.webp"
                alt="Tuxedos and Black Tie"
                className={styles.categoryImage}
              />
              <div className={styles.categoryOverlay}>
                <span className={styles.catLabel}>Galas & Red Carpet</span>
                <h3>Tuxedos & Evening Wear</h3>
                <span className={styles.catExplore}>Explore Satin Shawl Silhouettes →</span>
              </div>
            </Link>

            <Link to="/shop?category=formal-blazers" className={styles.categoryCard}>
              <img
                src="/assets/collections/formal-blazers.webp"
                alt="Formal Corporate Blazers"
                className={styles.categoryImage}
              />
              <div className={styles.categoryOverlay}>
                <span className={styles.catLabel}>Boardrooms & Executive</span>
                <h3>Formal & Corporate</h3>
                <span className={styles.catExplore}>Explore Worsted Wool →</span>
              </div>
            </Link>

            <Link to="/shop?category=casual-smart" className={styles.categoryCard}>
              <img
                src="/assets/collections/casual-smart.webp"
                alt="Casual Smart Blazers"
                className={styles.categoryImage}
              />
              <div className={styles.categoryOverlay}>
                <span className={styles.catLabel}>Leisure & Weekends</span>
                <h3>Casual & Smart Blazers</h3>
                <span className={styles.catExplore}>Explore Unstructured Linens →</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. How Renting Works */}
      <section className={styles.howItWorks}>
        <div className="container">
          <div className={styles.howHeader}>
            <span className={styles.sectionEyebrow}>SEAMLESS OCCASION WEAR</span>
            <h2>How Blazer Renting Works</h2>
            <p className={styles.howSubtitle}>
              Experience world-class menswear without the full retail commitment.
              Four straightforward steps to an unforgettable evening.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            {RENT_STEPS.map((step) => (
              <div key={step.no} className={styles.stepCard}>
                <span className={styles.stepNo}>{step.no}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div className={styles.howAction}>
            <Button to="/rent">
              <span>Browse All Rentable Blazers</span>
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* 6. Rental Spotlight Grid */}
      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>MOST RENTED THIS MONTH</span>
            <h2>Trending Occasion Rentals</h2>
          </div>
          <Link to="/rent" className={styles.sectionLink}>
            <span>View All Rentals</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className={styles.productGrid}>
          {rentalSpotlights.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onQuickView={(prod) => setQuickViewProduct(prod)}
            />
          ))}
        </div>
      </section>

      {/* 7. Why Choose Us / Craftsmanship */}
      <section className={styles.craftsmanship}>
        <div className="container">
          <div className={styles.craftHeader}>
            <span className={styles.sectionEyebrow}>THE MAJESTIC STANDARD</span>
            <h2>Why Connoisseurs Choose Us</h2>
          </div>

          <div className={styles.advantagesGrid}>
            {ADVANTAGES.map((adv) => {
              const Icon = adv.icon;
              return (
                <div key={adv.title} className={styles.advCard}>
                  <div className={styles.advIconWrap}>
                    <Icon size={24} className={styles.advIcon} />
                  </div>
                  <h3>{adv.title}</h3>
                  <p>{adv.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Verified Patron Testimonials */}
      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>WORDS OF DISTINCTION</span>
            <h2>Client Experiences</h2>
          </div>
        </div>

        <div className={styles.testimonialsGrid}>
          {TESTIMONIALS.map((t, idx) => (
            <blockquote key={idx} className={styles.testCard}>
              <div className={styles.stars}>★★★★★</div>
              <p className={styles.quote}>"{t.quote}"</p>
              <footer className={styles.testAuthor}>
                {t.avatar && (
                  <img src={t.avatar} alt={t.author} className={styles.testAvatar} />
                )}
                <div className={styles.testAuthorInfo}>
                  <strong>{t.author}</strong>
                  <span>{t.occasion} • {t.city}</span>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* 9. Flagship Boutique Visit */}
      <section className={styles.boutiqueSection}>
        <div className={`container ${styles.boutiqueGrid}`}>
          <div className={styles.boutiqueImageWrap}>
            <img
              src="/assets/brand/flagship-atelier.webp"
              alt="Majestic Blazer Coimbatore Boutique and Atelier"
              className={styles.boutiqueImage}
            />
          </div>
          <div className={styles.boutiqueInfo}>
            <span className={styles.sectionEyebrow}>PRIVATE SARTORIAL ATELIER</span>
            <h2>Visit Our Coimbatore Boutique</h2>
            <p>
              Experience private fitting rooms, tactile fabric swatches, and one-on-one styling with
              our master consultants. Try any blazer before purchasing or scheduling your rental.
            </p>
            <address className={styles.boutiqueAddress}>
              <p><strong>Address:</strong> {BUSINESS.address}</p>
              <p><strong>Direct Line:</strong> <a href={`tel:+91${BUSINESS.phone}`}>+91 {BUSINESS.phone}</a></p>
              <p><strong>Consultation Hours:</strong> {BUSINESS.hours}</p>
            </address>
            <div className={styles.boutiqueBtns}>
              <Button to="/contact">Schedule Private Fitting</Button>
            </div>
          </div>
        </div>
      </section>

      <QuickViewModal
        productSummary={quickViewProduct}
        isOpen={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
}
