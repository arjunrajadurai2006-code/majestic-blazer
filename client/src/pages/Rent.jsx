import { useEffect, useState } from 'react';
import { Calendar, Shield, Clock, Sparkles } from 'lucide-react';
import ProductCard from '../components/common/ProductCard';
import QuickViewModal from '../components/common/QuickViewModal';
import { api } from '../services/api';
import styles from './Rent.module.css';

export default function Rent() {
  const [blazers, setBlazers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  useEffect(() => {
    async function loadRentals() {
      setLoading(true);
      try {
        const res = await api.get('/products?type=rent&limit=24');
        setBlazers(res.data || []);
      } catch (err) {
        console.error('Failed to load rentals', err);
      } finally {
        setLoading(false);
      }
    }
    loadRentals();
  }, []);

  return (
    <div className={styles.page}>
      {/* Editorial Header */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <span className={styles.eyebrow}>OCCASION COUTURE • WITHOUT COMPROMISE</span>
          <h1>The Rental Wardrobe</h1>
          <p className={styles.lead}>
            Own the evening, not the closet space. Rent iconic Italian velvets, hand-canvassed
            tuxedos, and regal sangeet bandhgalas for weddings, galas, and keynotes.
          </p>

          <div className={styles.features}>
            <div className={styles.feat}>
              <Clock size={18} className={styles.featIcon} />
              <div>
                <strong>Flexible Durations</strong>
                <span>1 to 14 days with extension support</span>
              </div>
            </div>
            <div className={styles.feat}>
              <Shield size={18} className={styles.featIcon} />
              <div>
                <strong>100% Refundable Deposit</strong>
                <span>Instant deposit return upon inspection</span>
              </div>
            </div>
            <div className={styles.feat}>
              <Sparkles size={18} className={styles.featIcon} />
              <div>
                <strong>Dry Cleaning on Us</strong>
                <span>Return as-is; we take care of sanitization</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <section className={`container ${styles.main}`}>
        <div className={styles.countBar}>
          <span>Showing <strong>{blazers.length}</strong> rentable luxury blazers</span>
        </div>

        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className={styles.skeleton} />
            ))}
          </div>
        ) : blazers.length > 0 ? (
          <div className={styles.grid}>
            {blazers.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onQuickView={(prod) => setQuickViewProduct(prod)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <h3>No rental blazers available at this moment</h3>
          </div>
        )}
      </section>

      <QuickViewModal
        productSummary={quickViewProduct}
        isOpen={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
      />
    </div>
  );
}
