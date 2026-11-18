import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Eye, Search, CheckCircle, XCircle, Upload } from 'lucide-react';
import { api, uploadImage } from '../services/api';
import styles from '../styles/adminShared.module.css';

const DEFAULT_SIZES = ['36R', '38R', '40R', '42R', '44R'];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    categoryId: '',
    description: '',
    color: 'Midnight Black',
    material: '100% Super 140s Italian Wool',
    fit: 'Tailored Slim Fit',
    careInstructions: 'Dry clean only. Store on wooden hanger.',
    salePrice: 14999,
    originalPrice: 18999,
    rentPricePerDay: 1999,
    securityDeposit: 5000,
    isPurchasable: true,
    isRentable: true,
    isFeatured: false,
    isActive: true,
    imageUrls: '',
    variants: DEFAULT_SIZES.map(s => ({ size: s, sku: '', stockQuantity: 3, rentalStockQuantity: 2 }))
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?limit=50&all=true'),
        api.get('/categories')
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      slug: '',
      categoryId: categories[0]?.id || '',
      description: 'Handcrafted luxury blazer with peak lapels and structured silhouette.',
      color: 'Midnight Black',
      material: '100% Super 140s Italian Wool',
      fit: 'Tailored Slim Fit',
      careInstructions: 'Dry clean only. Store on wooden hanger.',
      salePrice: 14999,
      originalPrice: 18999,
      rentPricePerDay: 1999,
      securityDeposit: 5000,
      isPurchasable: true,
      isRentable: true,
      isFeatured: false,
      isActive: true,
      imageUrls: '/assets/products/imperial-navy-velvet-front.webp',
      variants: DEFAULT_SIZES.map(s => ({ size: s, sku: `MB-${s}`, stockQuantity: 3, rentalStockQuantity: 2 }))
    });
    setIsModalOpen(true);
  };

  const openEditModal = async (product) => {
    try {
      setEditingProduct(product);
      // Fetch full details with variants
      const res = await api.get(`/products/id/${product.id}`);
      const full = res.data;
      
      const imgUrls = (full.images || []).map(i => i.url).join('\n');
      const vMap = (full.variants || []).reduce((acc, v) => {
        acc[v.size] = v;
        return acc;
      }, {});

      setFormData({
        name: full.name,
        slug: full.slug,
        categoryId: full.category_id,
        description: full.description || '',
        color: full.color || '',
        material: full.material || '',
        fit: full.fit || '',
        careInstructions: full.care_instructions || '',
        salePrice: full.sale_price || '',
        originalPrice: full.original_price || '',
        rentPricePerDay: full.rent_price_per_day || '',
        securityDeposit: full.security_deposit || '',
        isPurchasable: Boolean(full.is_purchasable),
        isRentable: Boolean(full.is_rentable),
        isFeatured: Boolean(full.is_featured),
        isActive: Boolean(full.is_active),
        imageUrls: imgUrls,
        variants: DEFAULT_SIZES.map(s => ({
          size: s,
          sku: vMap[s]?.sku || `MB-${full.slug}-${s}`,
          stockQuantity: vMap[s]?.stock_quantity ?? 0,
          rentalStockQuantity: vMap[s]?.rental_stock_quantity ?? 0
        }))
      });
      setIsModalOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to fetch product details');
    }
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    const generatedSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setFormData(prev => ({
      ...prev,
      name: val,
      slug: editingProduct ? prev.slug : generatedSlug
    }));
  };

  const handleVariantChange = (index, field, value) => {
    setFormData(prev => {
      const nextVariants = [...prev.variants];
      nextVariants[index] = { ...nextVariants[index], [field]: value };
      return { ...prev, variants: nextVariants };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPEG, PNG and WebP images are permitted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File exceeds 5MB limit.');
      return;
    }

    try {
      setUploadingImg(true);
      const res = await uploadImage(file);
      const uploadedUrl = res.data.url;
      setFormData(prev => ({
        ...prev,
        imageUrls: prev.imageUrls ? `${prev.imageUrls}\n${uploadedUrl}` : uploadedUrl,
      }));
    } catch (err) {
      alert(err.message || 'Image upload failed');
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const images = formData.imageUrls
        .split('\n')
        .map(u => u.trim())
        .filter(Boolean)
        .map((url, i) => ({
          url,
          altText: formData.name,
          isPrimary: i === 0
        }));

      const payload = {
        categoryId: Number(formData.categoryId),
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        color: formData.color,
        material: formData.material,
        fit: formData.fit,
        careInstructions: formData.careInstructions,
        salePrice: formData.salePrice ? Number(formData.salePrice) : null,
        originalPrice: formData.originalPrice ? Number(formData.originalPrice) : null,
        rentPricePerDay: formData.rentPricePerDay ? Number(formData.rentPricePerDay) : null,
        securityDeposit: formData.securityDeposit ? Number(formData.securityDeposit) : null,
        isPurchasable: Boolean(formData.isPurchasable),
        isRentable: Boolean(formData.isRentable),
        isFeatured: Boolean(formData.isFeatured),
        isActive: Boolean(formData.isActive),
        images,
        variants: formData.variants.map(v => ({
          size: v.size,
          sku: v.sku || `${formData.slug}-${v.size}`,
          stockQuantity: Number(v.stockQuantity) || 0,
          rentalStockQuantity: Number(v.rentalStockQuantity) || 0
        }))
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        setSuccess('Blazer updated successfully');
      } else {
        await api.post('/products', payload);
        setSuccess('Blazer added to catalog successfully');
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from the catalog?`)) return;
    try {
      await api.delete(`/products/${id}`);
      setSuccess('Product removed');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete product');
    }
  };

  const handleToggleActive = async (product) => {
    try {
      await api.put(`/products/${product.id}`, {
        categoryId: product.category_id,
        name: product.name,
        slug: product.slug,
        isActive: !product.is_active,
        isPurchasable: product.is_purchasable,
        isRentable: product.is_rentable,
        salePrice: product.sale_price,
        rentPricePerDay: product.rent_price_per_day,
        securityDeposit: product.security_deposit
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to toggle status');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = !search || 
      p.name?.toLowerCase().includes(search.toLowerCase()) || 
      p.slug?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCategory || String(p.category_id) === String(selectedCategory);
    return matchesSearch && matchesCat;
  });

  const formatCurrency = (amt) =>
    amt ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt) : '—';

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Blazer Catalog Management</h1>
          <p className={styles.subtitle}>Direct sartorial inventory and rental availability control</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={openAddModal}>
            <Plus size={16} /> Add New Blazer
          </button>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      {/* Filter and Search Bar */}
      <div className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search size={18} color="#888" style={{ marginRight: '8px' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search blazers by name or style code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.selectInput}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Garment</th>
              <th>Category</th>
              <th>Purchase Price</th>
              <th>Rental / Day</th>
              <th>Deposit</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img 
                        src={p.primary_image || '/assets/products/imperial-navy-velvet-front.webp'} 
                        alt={p.name}
                        style={{ width: '42px', height: '52px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #E5E5E5' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: '#111111' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666666' }}>{p.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.category_name}</td>
                  <td>{formatCurrency(p.sale_price)}</td>
                  <td>{formatCurrency(p.rent_price_per_day)}</td>
                  <td>{formatCurrency(p.security_deposit)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {p.is_purchasable && <span className={`${styles.badge} ${styles.badgeDefault}`}>Buy</span>}
                      {p.is_rentable && <span className={`${styles.badge} ${styles.badgeInfo}`}>Rent</span>}
                    </div>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleToggleActive(p)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      title="Toggle visibility"
                    >
                      {p.is_active ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeDanger}`}>Hidden</span>
                      )}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.btnSecondary} onClick={() => openEditModal(p)} title="Edit Blazer">
                        <Edit2 size={14} />
                      </button>
                      <button className={styles.btnDanger} onClick={() => handleDelete(p.id, p.name)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className={styles.emptyState}>
                  {loading ? 'Fetching catalog...' : 'No blazers found matching your criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <h2>{editingProduct ? 'Edit Sartorial Blazer' : 'Add New Blazer to Atelier'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Garment Name *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={formData.name}
                    onChange={handleNameChange}
                    placeholder="e.g. Royal Emerald Velvet Tuxedo"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Slug URL Identifier *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="royal-emerald-velvet-tuxedo"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Category *</label>
                  <select
                    required
                    className={styles.selectInput}
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Color</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g. Midnight Black, Charcoal"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Fabric / Material</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={formData.material}
                    onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                    placeholder="e.g. 100% Super 140s Wool"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Tailoring Fit</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={formData.fit}
                    onChange={(e) => setFormData({ ...formData, fit: e.target.value })}
                    placeholder="e.g. Tailored Slim Fit"
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Sartorial Description</label>
                  <textarea
                    rows="3"
                    className={styles.input}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe cut, lining, lapel style and occasion versatility..."
                  />
                </div>

                {/* Pricing Structure */}
                <div className={styles.formGroup}>
                  <label>Retail Selling Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Original MRP (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Rental Rate / Day (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={formData.rentPricePerDay}
                    onChange={(e) => setFormData({ ...formData, rentPricePerDay: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Refundable Security Deposit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={formData.securityDeposit}
                    onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                  />
                </div>

                {/* Flags */}
                <div className={`${styles.formGroup} ${styles.formFull}`} style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isPurchasable}
                      onChange={(e) => setFormData({ ...formData, isPurchasable: e.target.checked })}
                    />
                    Available for Direct Purchase
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isRentable}
                      onChange={(e) => setFormData({ ...formData, isRentable: e.target.checked })}
                    />
                    Available for Rental
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    />
                    Featured on Homepage
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active in Store
                  </label>
                </div>

                {/* Images */}
                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label>High-Resolution Image URLs (one per line, first is primary)</label>
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        className={`${styles.btnSecondary} ${styles.btnSmall}`}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImg}
                      >
                        <Upload size={13} /> {uploadingImg ? 'Uploading...' : 'Upload Local Image'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows="3"
                    className={styles.input}
                    value={formData.imageUrls}
                    onChange={(e) => setFormData({ ...formData, imageUrls: e.target.value })}
                    placeholder="https://images.unsplash.com/...&#10;https://images.unsplash.com/..."
                  />
                  {formData.imageUrls && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {formData.imageUrls.split('\n').filter(Boolean).map((u, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img
                            src={u.trim()}
                            alt={`Preview ${i}`}
                            style={{ width: '56px', height: '70px', objectFit: 'cover', borderRadius: '2px', border: i === 0 ? '2px solid #b99a58' : '1px solid #333' }}
                          />
                          {i === 0 && (
                            <span style={{ position: 'absolute', bottom: 2, left: 2, background: '#b99a58', color: '#000', fontSize: '9px', fontWeight: 700, padding: '1px 3px', borderRadius: '1px' }}>
                              Primary
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Size Variants & Stock */}
                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label style={{ marginBottom: '0.5rem', display: 'block' }}>Size Variants & Stock Units</label>
                  <div style={{ background: '#F7F7F7', padding: '0.75rem', borderRadius: '4px', border: '1px solid #E5E5E5' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px', gap: '8px', marginBottom: '8px', fontSize: '0.75rem', color: '#666666', textTransform: 'uppercase' }}>
                      <div>Size</div>
                      <div>SKU Code</div>
                      <div>Retail Stock</div>
                      <div>Rental Stock</div>
                    </div>
                    {formData.variants.map((v, i) => (
                      <div key={v.size} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 100px', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ padding: '6px 8px', fontWeight: 600, color: '#111111' }}>{v.size}</div>
                        <input
                          type="text"
                          className={styles.input}
                          style={{ padding: '4px 8px' }}
                          value={v.sku}
                          onChange={(e) => handleVariantChange(i, 'sku', e.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          className={styles.input}
                          style={{ padding: '4px 8px' }}
                          value={v.stockQuantity}
                          onChange={(e) => handleVariantChange(i, 'stockQuantity', e.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          className={styles.input}
                          style={{ padding: '4px 8px' }}
                          value={v.rentalStockQuantity}
                          onChange={(e) => handleVariantChange(i, 'rentalStockQuantity', e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update Blazer' : 'Publish to Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
