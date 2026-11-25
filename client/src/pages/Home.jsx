import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Sparkles, Clock, MapPin, Award, CheckCircle2, ArrowRight, Phone } from 'lucide-react';
import ProductCard from '../components/common/ProductCard';
import QuickViewModal from '../components/common/QuickViewModal';
import Button from '../components/common/Button';
import { api } from '../services/api';
import { BUSINESS } from '../components/layout/Footer';
import { getResponsiveWebpSrcSet } from '../utils/responsiveImage';
import { useDocumentSeo } from '../utils/seo';
import styles from './Home.module.css';

const TAILORING_STEPS = [
  {
    no: '01',
    title: 'Select Your Silhouette',
    desc: 'Browse our curated collection of velvet peak lapels, double-breasted navy classics, and black-tie tuxedos.',
  },
  {
    no: '02',
    title: 'Precision Fitting & Sizing',
    desc: 'Consult our detailed size guide or schedule a boutique fitting. Complimentary sleeve and waist adjustments are available.',
  },
  {
    no: '03',
    title: 'Hand-Canvassed Construction',
    desc: 'Constructed with a floating horsehair canvas chest piece that gently molds to your physique for regal posture.',
  },
  {
    no: '04',
    title: 'Timeless Wardrobe Investment',
    desc: 'Delivered in a breathable garment bag with cedar hanger. Crafted to maintain its structure and elegance for years.',
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
    title: 'Complimentary Master Alterations',
    desc: 'Every blazer purchase includes bespoke sleeve and waist contouring for an impeccable custom fit.',
  },
  {
    icon: MapPin,
    title: 'Flagship Coimbatore Boutique',
    desc: 'Visit us on Sathy Road, Kurumbampalayam for private styling consultations, measurement sessions, and custom fittings.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'The navy velvet blazer was the talk of my brother’s reception. The drape and peak lapels scream bespoke luxury. Coimbatore finally has a world-class menswear destination.',
    author: 'Karthik Subramanian',
    occasion: 'Wedding Reception Purchase',
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
    quote: 'Selected an embroidered bandhgala blazer for a destination sangeet. The hand-canvassed construction was effortless to wear and the fit was true to size. Impeccable craftsmanship.',
    author: 'Vikram Menon',
    occasion: 'Sangeet Ceremony',
    city: 'Bangalore',
    avatar: '/assets/testimonials/patron-vikram.webp',
  },
];

export default function Home() {
  useDocumentSeo({
    title: "MAJESTIC BLAZER | Premium Men's Blazers & Formalwear",
    description:
      'Handcrafted luxury blazers, Italian velvet wedding silhouettes, and black-tie tuxedos tailored in Coimbatore. Style That Speaks.',
    path: '/',
  });

  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [formalwearProducts, setFormalwearProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const handleQuickView = useCallback((prod) => setQuickViewProduct(prod), []);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const [featRes, formalRes] = await Promise.all([
          api.get('/products?featured=true&limit=4'),
          api.get('/products?category=tuxedos-black-tie&limit=4'),
        ]);
        setFeaturedProducts(featRes.data || []);
        setFormalwearProducts(formalRes.data || []);
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
            handcrafted with superfine wool, silk, and plush Italian velvet.
          </p>

          <div className={styles.heroCtas}>
            <Button to="/shop" className={styles.primaryBtn}>
              <span>Shop Collection</span>
              <ArrowRight size={18} />
            </Button>
            <Button to="/shop?category=tuxedos-black-tie" variant="outline" className={styles.secondaryBtn}>
              <span>Evening & Tuxedos</span>
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
            <span>Complimentary Fitting & Alterations</span>
          </div>
        </div>
      </section>

      {/* 2. Sartorial Excellence & Bespoke Services Banner */}
      <section className={styles.distinction}>
        <div className={`container ${styles.distinctionGrid}`}>
          <div className={styles.distinctionCard}>
            <div className={styles.distinctionMeta}>
              <span className={styles.metaTag}>READY TO WEAR</span>
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
              <span className={`${styles.metaTag} ${styles.silverMetaTag}`}>PRIVATE ATELIER</span>
              <h2>Custom Fittings & Styling</h2>
              <p>
                Visit our Coimbatore atelier for private consultations, custom measurements,
                and master alterations ensuring a glove-like contour on every silhouette.
              </p>
              <Button to="/contact" variant="outline" className={styles.distinctionBtn}>
                <span>Schedule Consultation</span>
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
                onQuickView={handleQuickView}
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
                srcSet={getResponsiveWebpSrcSet('/assets/collections/wedding-partywear.webp')}
                sizes="(max-width: 768px) 92vw, 25vw"
                alt="Wedding and Partywear Blazers"
                className={styles.categoryImage}
                width="600"
                height="600"
                loading="lazy"
                decoding="async"
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
                srcSet={getResponsiveWebpSrcSet('/assets/collections/tuxedos-black-tie.webp')}
                sizes="(max-width: 768px) 92vw, 25vw"
                alt="Tuxedos and Black Tie"
                className={styles.categoryImage}
                width="600"
                height="900"
                loading="lazy"
                decoding="async"
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
                srcSet={getResponsiveWebpSrcSet('/assets/collections/formal-blazers.webp')}
                sizes="(max-width: 768px) 92vw, 25vw"
                alt="Formal Corporate Blazers"
                className={styles.categoryImage}
                width="600"
                height="600"
                loading="lazy"
                decoding="async"
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
                srcSet={getResponsiveWebpSrcSet('/assets/collections/casual-smart.webp')}
                sizes="(max-width: 768px) 92vw, 25vw"
                alt="Casual Smart Blazers"
                className={styles.categoryImage}
                width="600"
                height="600"
                loading="lazy"
                decoding="async"
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

      {/* 5. The Majestic Tailoring Journey */}
      <section className={styles.howItWorks}>
        <div className="container">
          <div className={styles.howHeader}>
            <span className={styles.sectionEyebrow}>SARTORIAL DISTINCTION</span>
            <h2>The Majestic Tailoring Journey</h2>
            <p className={styles.howSubtitle}>
              Experience world-class menswear crafted for life's most memorable moments.
              Four hallmarks of our heirloom garments.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            {TAILORING_STEPS.map((step) => (
              <div key={step.no} className={styles.stepCard}>
                <span className={styles.stepNo}>{step.no}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div className={styles.howAction}>
            <Button to="/shop">
              <span>Explore All Blazers</span>
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* 6. Seasonal Formalwear & Tuxedos Showcase */}
      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>BLACK TIE & EVENING EXCELLENCE</span>
            <h2>Seasonal Formalwear & Tuxedos</h2>
          </div>
          <Link to="/shop?category=tuxedos-black-tie" className={styles.sectionLink}>
            <span>View All Formalwear</span>
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
            {formalwearProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={handleQuickView}
              />
            ))}
          </div>
        )}
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
                  <img
                    src={t.avatar}
                    alt={t.author}
                    className={styles.testAvatar}
                    loading="lazy"
                    decoding="async"
                    width="64"
                    height="64"
                  />
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
              srcSet={getResponsiveWebpSrcSet('/assets/brand/flagship-atelier.webp')}
              sizes="(max-width: 768px) 92vw, 580px"
              alt="Majestic Blazer Coimbatore Boutique and Atelier"
              className={styles.boutiqueImage}
              loading="lazy"
              decoding="async"
              width="800"
              height="533"
            />
          </div>
          <div className={styles.boutiqueInfo}>
            <span className={styles.sectionEyebrow}>PRIVATE SARTORIAL ATELIER</span>
            <h2>Visit Our Coimbatore Boutique</h2>
            <p>
              Experience private fitting rooms, tactile fabric swatches, and one-on-one styling with
              our master consultants. Try any blazer and consult our master tailors before purchasing.
            </p>
            <div className={styles.boutiqueAddress}>
              <div className={styles.addressItem}>
                <MapPin size={18} className={styles.addressIcon} />
                <div className={styles.addressText}>
                  <span className={styles.addressLabel}>Address</span>
                  <span className={styles.addressVal}>{BUSINESS.address}</span>
                </div>
              </div>
              <div className={styles.addressItem}>
                <Phone size={18} className={styles.addressIcon} />
                <div className={styles.addressText}>
                  <span className={styles.addressLabel}>Direct Line</span>
                  <a href={`tel:+91${BUSINESS.phone}`} className={styles.addressLink}>+91 {BUSINESS.phone}</a>
                </div>
              </div>
              <div className={styles.addressItem}>
                <Clock size={18} className={styles.addressIcon} />
                <div className={styles.addressText}>
                  <span className={styles.addressLabel}>Consultation Hours</span>
                  <span className={styles.addressVal}>{BUSINESS.hours}</span>
                </div>
              </div>
            </div>
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
