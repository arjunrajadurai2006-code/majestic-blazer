import { useEffect, useState } from 'react';
import { Search, AlertTriangle, CheckCircle, RefreshCw, Layers } from 'lucide-react';
import { api } from '../services/api';
import styles from '../styles/adminShared.module.css';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editing state for quick update
  const [updatingId, setUpdatingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (lowStockOnly) q.set('lowStockOnly', 'true');

      const res = await api.get(`/inventory?${q.toString()}`);
      setItems(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [lowStockOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadInventory();
  };

  const startEdit = (item) => {
    setUpdatingId(item.id);
    setEditValues({
      stockQuantity: item.stock_quantity,
      rentalStockQuantity: item.rental_stock_quantity
    });
  };

  const cancelEdit = () => {
    setUpdatingId(null);
    setEditValues({});
  };

  const saveEdit = async (id) => {
    try {
      setError('');
      setSuccess('');
      await api.patch(`/inventory/${id}`, {
        stockQuantity: Number(editValues.stockQuantity),
        rentalStockQuantity: Number(editValues.rentalStockQuantity)
      });
      setSuccess('Inventory stock updated successfully');
      setUpdatingId(null);
      loadInventory();
    } catch (err) {
      setError(err.message || 'Failed to update stock');
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1>Inventory & Stock Control</h1>
          <p className={styles.subtitle}>Track physical garments across retail sales and rental wardrobe</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={loadInventory}>
            <RefreshCw size={14} /> Refresh Counts
          </button>
        </div>
      </div>

      {error && <div className={`${styles.badge} ${styles.badgeDanger}`} style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
      {success && <div className={`${styles.badge} ${styles.badgeSuccess}`} style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

      {/* Filter Bar */}
      <form onSubmit={handleSearchSubmit} className={styles.filterBar}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search size={18} color="#888" style={{ marginRight: '8px' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by blazer name or SKU code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className={styles.checkboxLabel} style={{ marginLeft: '1rem' }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Show Low Stock Only (&le; 2 units)
        </label>
        <button type="submit" className={styles.btnSecondary} style={{ marginLeft: 'auto' }}>
          Filter
        </button>
      </form>

      {/* Inventory Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Garment & Collection</th>
              <th>SKU</th>
              <th>Chest Size</th>
              <th>Retail Stock</th>
              <th>Rental Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map(item => {
                const isEditing = updatingId === item.id;
                const isRetailLow = item.stock_quantity <= 2 && item.is_purchasable;
                const isRentalLow = item.rental_stock_quantity <= 1 && item.is_rentable;

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={item.image_url || '/assets/products/imperial-navy-velvet-front.webp'}
                          alt={item.product_name}
                          style={{ width: '38px', height: '48px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #333' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: '#111111' }}>{item.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666666' }}>{item.category_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ background: '#F7F7F7', border: '1px solid #E5E5E5', padding: '2px 6px', borderRadius: '2px', color: '#b99a58' }}>
                        {item.sku}
                      </code>
                    </td>
                    <td>
                      <strong style={{ color: '#111111' }}>{item.size}</strong>
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          style={{ width: '70px', padding: '4px 6px' }}
                          className={styles.input}
                          value={editValues.stockQuantity}
                          onChange={(e) => setEditValues({ ...editValues, stockQuantity: e.target.value })}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, color: isRetailLow ? '#ff4757' : '#fff' }}>
                          {item.stock_quantity} units
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          style={{ width: '70px', padding: '4px 6px' }}
                          className={styles.input}
                          value={editValues.rentalStockQuantity}
                          onChange={(e) => setEditValues({ ...editValues, rentalStockQuantity: e.target.value })}
                        />
                      ) : (
                        <span style={{ fontWeight: 600, color: isRentalLow ? '#ffab00' : '#b99a58' }}>
                          {item.rental_stock_quantity} units
                        </span>
                      )}
                    </td>
                    <td>
                      {isRetailLow || isRentalLow ? (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>
                          <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          Low Stock
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                          <CheckCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          In Stock
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className={`${styles.btnPrimary} ${styles.btnSmall}`} onClick={() => saveEdit(item.id)}>
                            Save
                          </button>
                          <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => startEdit(item)}>
                          Adjust
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className={styles.emptyState}>
                  {loading ? 'Fetching stock counts...' : 'No inventory items match query.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
