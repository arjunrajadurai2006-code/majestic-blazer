import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, FolderTree } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    sortOrder: 0,
    isActive: true,
  });

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/categories?includeInactive=true');
      setCategories(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      sortOrder: categories.length,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      sortOrder: category.sort_order || 0,
      isActive: Boolean(category.is_active),
    });
    setIsModalOpen(true);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    const generatedSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setFormData(prev => ({
      ...prev,
      name: val,
      slug: editingCategory ? prev.slug : generatedSlug,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        sortOrder: Number(formData.sortOrder) || 0,
        isActive: Boolean(formData.isActive),
      };

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, payload);
        setSuccess('Category updated successfully');
      } else {
        await api.post('/categories', payload);
        setSuccess('Category created successfully');
      }

      setIsModalOpen(false);
      loadCategories();
    } catch (err) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name, count) => {
    if (count > 0) {
      alert(`Cannot delete category "${name}" because it contains ${count} active blazers. Reassign or delete those products first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      await api.delete(`/categories/${id}`);
      setSuccess('Category removed');
      loadCategories();
    } catch (err) {
      setError(err.message || 'Failed to delete category');
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Category Architecture</h1>
          <p className={styles.subtitle}>Curate collections and sartorial taxonomy</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnPrimary} onClick={openAddModal}>
            <Plus size={16} /> New Category
          </button>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Collection Name</th>
              <th>Slug</th>
              <th>Description</th>
              <th>Active Products</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length > 0 ? (
              categories.map(c => (
                <tr key={c.id}>
                  <td style={{ width: '60px', color: '#888' }}>{c.sort_order}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderTree size={16} color="#b99a58" />
                      <strong style={{ color: '#fff' }}>{c.name}</strong>
                    </div>
                  </td>
                  <td style={{ color: '#888', fontSize: '0.8rem' }}>{c.slug}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.description || '—'}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeDefault}`}>
                      {c.products_count || 0} Blazers
                    </span>
                  </td>
                  <td>
                    {c.is_active ? (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>Active</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeDanger}`}>Hidden</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.btnSecondary} onClick={() => openEditModal(c)} title="Edit Category">
                        <Edit2 size={14} />
                      </button>
                      <button className={styles.btnDanger} onClick={() => handleDelete(c.id, c.name, c.products_count)} title="Delete Category">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className={styles.emptyState}>
                  {loading ? 'Loading collections...' : 'No categories configured.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingCategory ? 'Edit Collection Category' : 'Create New Collection'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Category Name *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={formData.name}
                    onChange={handleNameChange}
                    placeholder="e.g. Wedding & Gala Tuxedos"
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Slug URL Identifier *</label>
                  <input
                    type="text"
                    required
                    className={styles.input}
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="wedding-gala-tuxedos"
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label>Curatorial Description</label>
                  <textarea
                    rows="3"
                    className={styles.input}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description displayed on customer catalog navigation..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Display Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup} style={{ justifyContent: 'center' }}>
                  <label className={styles.checkboxLabel} style={{ marginTop: '1.25rem' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Category is Visible on Store
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={submitting}>
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
