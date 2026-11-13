import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, X, Search, RotateCcw } from 'lucide-react';
import ProductCard from '../components/common/ProductCard';
import { api } from '../services/api';
import styles from './Shop.module.css';

const SIZES = ['36R', '38R', '40R', '42R', '44R'];
const COLORS = ['Midnight Navy', 'Onyx Black', 'Charcoal Grey', 'Wine Burgundy', 'Sand Tan', 'Oxford Navy'];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Filter states derived from search params
  const currentCategory = searchParams.get('category') || '';
  const currentType = searchParams.get('type') || ''; // 'buy' | 'rent' | ''
  const currentSearch = searchParams.get('search') || '';
  const currentColor = searchParams.get('color') || '';
  const currentSize = searchParams.get('size') || '';
  const currentSort = searchParams.get('sort') || 'newest';
  const currentPage = Number(searchParams.get('page')) || 1;
  const currentMinPrice = searchParams.get('minPrice') || '';
  const currentMaxPrice = searchParams.get('maxPrice') || '';

  // Load categories
  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data || [])).catch(() => {});
  }, []);

  // Fetch products when query params change
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        if (currentCategory) query.set('category', currentCategory);
        if (currentType) query.set('type', currentType);
        if (currentSearch) query.set('search', currentSearch);
        if (currentColor) query.set('color', currentColor);
        if (currentSize) query.set('size', currentSize);
        if (currentSort) query.set('sort', currentSort);
        if (currentMinPrice) query.set('minPrice', currentMinPrice);
        if (currentMaxPrice) query.set('maxPrice', currentMaxPrice);
        query.set('page', currentPage);
        query.set('limit', 12);

        const res = await api.get(`/products?${query.toString()}`);
        setProducts(res.data || []);
        setTotal(res.meta?.total || 0);
      } catch (err) {
        console.error('Failed to load products', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [searchParams]);

  const updateParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set(key, val);
    } else {
      next.delete(key);
    }
    next.set('page', '1'); // reset page on filter change
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(
    currentCategory || currentType || currentSearch || currentColor || currentSize || currentMinPrice || currentMaxPrice
  );

  return (
    <div className={styles.page}>
      {/* Header Banner */}
      <div className={styles.header}>
        <div className="container">
          <span className={styles.eyebrow}>THE MAJESTIC WARDROBE</span>
          <h1>Tailored Blazers</h1>
          <p className={styles.subtitle}>
            Explore our curated inventory of hand-canvassed formal blazers, midnight velvets, and black-tie tuxedos.
            Available for purchase or premium occasion rental.
          </p>
        </div>
      </div>

      <div className={`container ${styles.main}`}>
        {/* Mobile Filter Toggle */}
        <div className={styles.mobileBar}>
          <button
            className={styles.filterToggleBtn}
            onClick={() => setMobileFilterOpen((v) => !v)}
          >
            <SlidersHorizontal size={18} />
            <span>Filters {hasActiveFilters && '• Active'}</span>
          </button>

          <div className={styles.sortMobileWrap}>
            <select
              value={currentSort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className={styles.sortSelect}
            >
              <option value="newest">Sort: Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        <div className={styles.layout}>
          {/* Filter Sidebar */}
          <aside className={`${styles.sidebar} ${mobileFilterOpen ? styles.mobileOpen : ''}`}>
            <div className={styles.sidebarHeader}>
              <h3>Filters</h3>
              {hasActiveFilters && (
                <button type="button" onClick={clearAllFilters} className={styles.clearBtn}>
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              )}
              <button
                className={styles.closeMobileBtn}
                onClick={() => setMobileFilterOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Availability Option */}
            <div className={styles.filterGroup}>
              <h4>Availability</h4>
              <div className={styles.radioList}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    checked={!currentType}
                    onChange={() => updateParam('type', '')}
                  />
                  <span>All Blazers</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    checked={currentType === 'buy'}
                    onChange={() => updateParam('type', 'buy')}
                  />
                  <span>Buy to Own</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="type"
                    checked={currentType === 'rent'}
                    onChange={() => updateParam('type', 'rent')}
                  />
                  <span>Rent for Occasion</span>
                </label>
              </div>
            </div>

            {/* Categories */}
            <div className={styles.filterGroup}>
              <h4>Category</h4>
              <div className={styles.categoryList}>
                <button
                  type="button"
                  className={`${styles.filterChip} ${!currentCategory ? styles.chipActive : ''}`}
                  onClick={() => updateParam('category', '')}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.filterChip} ${currentCategory === cat.slug ? styles.chipActive : ''}`}
                    onClick={() => updateParam('category', cat.slug)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Filter */}
            <div className={styles.filterGroup}>
              <h4>Chest Size</h4>
              <div className={styles.sizeGrid}>
                {SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`${styles.sizeBtn} ${currentSize === sz ? styles.sizeActive : ''}`}
                    onClick={() => updateParam('size', currentSize === sz ? '' : sz)}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Filter */}
            <div className={styles.filterGroup}>
              <h4>Shade & Colour</h4>
              <div className={styles.colorList}>
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={`${styles.colorChip} ${currentColor === col ? styles.colorActive : ''}`}
                    onClick={() => updateParam('color', currentColor === col ? '' : col)}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className={styles.filterGroup}>
              <h4>Price Range (₹)</h4>
              <div className={styles.priceInputs}>
                <input
                  type="number"
                  placeholder="Min"
                  value={currentMinPrice}
                  onChange={(e) => updateParam('minPrice', e.target.value)}
                  className={styles.priceInput}
                />
                <span className={styles.priceDash}>–</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={currentMaxPrice}
                  onChange={(e) => updateParam('maxPrice', e.target.value)}
                  className={styles.priceInput}
                />
              </div>
            </div>
          </aside>

          {/* Catalog Content Area */}
          <main className={styles.content}>
            {/* Desktop Top Toolbar */}
            <div className={styles.toolbar}>
              <span className={styles.resultCount}>
                Showing <strong>{products.length}</strong> of <strong>{total}</strong> luxury blazers
              </span>

              <div className={styles.sortDesktopWrap}>
                <label htmlFor="sort-select">Sort by:</label>
                <select
                  id="sort-select"
                  value={currentSort}
                  onChange={(e) => updateParam('sort', e.target.value)}
                  className={styles.sortSelect}
                >
                  <option value="newest">Newest Additions</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rent_asc">Rental: Low to High</option>
                  <option value="rating">Top Rated</option>
                </select>
              </div>
            </div>

            {/* Active filter badges */}
            {hasActiveFilters && (
              <div className={styles.activePills}>
                {currentType && (
                  <span className={styles.pill}>
                    Type: {currentType === 'buy' ? 'Buy' : 'Rent'}
                    <button onClick={() => updateParam('type', '')}>×</button>
                  </span>
                )}
                {currentCategory && (
                  <span className={styles.pill}>
                    Category: {categories.find((c) => c.slug === currentCategory)?.name || currentCategory}
                    <button onClick={() => updateParam('category', '')}>×</button>
                  </span>
                )}
                {currentSize && (
                  <span className={styles.pill}>
                    Size: {currentSize}
                    <button onClick={() => updateParam('size', '')}>×</button>
                  </span>
                )}
                {currentColor && (
                  <span className={styles.pill}>
                    Colour: {currentColor}
                    <button onClick={() => updateParam('color', '')}>×</button>
                  </span>
                )}
                {currentSearch && (
                  <span className={styles.pill}>
                    Search: "{currentSearch}"
                    <button onClick={() => updateParam('search', '')}>×</button>
                  </span>
                )}
                <button onClick={clearAllFilters} className={styles.clearAllLink}>
                  Clear all filters
                </button>
              </div>
            )}

            {/* Products Grid */}
            {loading ? (
              <div className={styles.grid}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className={styles.skeleton} />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className={styles.grid}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <h3>No blazers match your filters</h3>
                <p>Try removing some filters or searching for alternative terms like "navy", "velvet", or "tuxedo".</p>
                <button onClick={clearAllFilters} className={styles.resetBtn}>
                  Reset All Filters
                </button>
              </div>
            )}

            {/* Pagination */}
            {total > 12 && (
              <div className={styles.pagination}>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => updateParam('page', String(currentPage - 1))}
                  className={styles.pageBtn}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {Math.ceil(total / 12)}
                </span>
                <button
                  disabled={currentPage >= Math.ceil(total / 12)}
                  onClick={() => updateParam('page', String(currentPage + 1))}
                  className={styles.pageBtn}
                >
                  Next
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
