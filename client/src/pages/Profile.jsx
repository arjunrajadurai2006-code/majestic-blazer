import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, KeyRound, LogOut, Package, Heart, Plus, Trash2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { useDocumentSeo } from '../utils/seo';
import styles from './Profile.module.css';

export default function Profile() {
  useDocumentSeo({
    title: 'My Profile | MAJESTIC BLAZER',
    description: 'Manage your Majestic Blazer patron profile and saved addresses.',
    path: '/profile',
    noindex: true,
  });
  const { user, logout } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  // Profile fields
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Address fields
  const [addresses, setAddresses] = useState([]);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('Coimbatore');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('641107');
  const [isDefault, setIsDefault] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  const loadAddresses = async () => {
    try {
      const res = await api.get('/auth/addresses');
      setAddresses(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await api.put('/auth/profile', { fullName, phone });
      success('Profile details updated successfully');
    } catch (err) {
      toastError(err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toastError('New password must be at least 8 characters long');
      return;
    }
    setUpdatingPassword(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toastError(err.message || 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setSavingAddr(true);
    try {
      await api.post('/auth/addresses', { line1, line2, city, state, pincode, isDefault });
      success('Address added to your address book');
      setLine1('');
      setLine2('');
      setShowAddAddr(false);
      loadAddresses();
    } catch (err) {
      toastError(err.message || 'Failed to save address');
    } finally {
      setSavingAddr(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      await api.delete(`/auth/addresses/${id}`);
      success('Address deleted');
      loadAddresses();
    } catch (err) {
      toastError(err.message || 'Failed to remove address');
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to sign out of your Majestic Blazer account?')) return;
    await logout();
    success('You have been signed out successfully.');
    navigate('/login', { 
      replace: true,
      state: { message: 'You have been signed out successfully. We look forward to your return.' } 
    });
  };

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CLIENT SUITE</span>
          <h1>Welcome, {user?.fullName || 'Distinguished Patron'}</h1>
        </div>
        <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Quick Access Tiles */}
      <div className={styles.tileGrid}>
        <Link to="/orders" className={styles.tile}>
          <Package size={24} className={styles.tileIcon} />
          <div>
            <strong>My Orders</strong>
            <span>View order history and download official tax invoices</span>
          </div>
        </Link>
        <Link to="/wishlist" className={styles.tile}>
          <Heart size={24} className={styles.tileIcon} />
          <div>
            <strong>Saved Pieces</strong>
            <span>View your saved blazer silhouettes and private curation</span>
          </div>
        </Link>
      </div>

      <div className={styles.grid}>
        {/* Personal Details & Password */}
        <div className={styles.leftCol}>
          <section className={styles.card}>
            <h2>Personal Information</h2>
            <form onSubmit={handleUpdateProfile} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Email Address</label>
                <input type="email" value={user?.email || ''} disabled className={styles.disabledInput} />
                <small>Email cannot be modified directly.</small>
              </div>

              <div className={styles.formGroup}>
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 8903238882"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <button type="submit" disabled={updatingProfile} className={styles.saveBtn}>
                {updatingProfile ? 'Saving...' : 'Update Details'}
              </button>
            </form>
          </section>

          <section className={styles.card}>
            <h2>Security & Password</h2>
            <form onSubmit={handleChangePassword} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>New Password (min 8 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={updatingPassword} className={styles.saveBtn}>
                {updatingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </section>
        </div>

        {/* Address Book */}
        <aside className={styles.rightCol}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Saved Addresses</h2>
              <button
                type="button"
                className={styles.addAddrToggle}
                onClick={() => setShowAddAddr((v) => !v)}
              >
                <Plus size={16} />
                <span>Add Address</span>
              </button>
            </div>

            {showAddAddr && (
              <form onSubmit={handleAddAddress} className={styles.addAddrForm}>
                <div className={styles.formGroup}>
                  <label>Address Line 1</label>
                  <input
                    type="text"
                    placeholder="House / Street / Road"
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Address Line 2</label>
                  <input
                    type="text"
                    placeholder="Apartment, Landmark"
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                  />
                </div>
                <div className={styles.formRow3}>
                  <div>
                    <label>City</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required />
                  </div>
                  <div>
                    <label>State</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)} required />
                  </div>
                  <div>
                    <label>Pincode</label>
                    <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
                  </div>
                </div>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <span>Make this my default shipping address</span>
                </label>
                <div className={styles.formBtns}>
                  <button type="submit" disabled={savingAddr} className={styles.saveBtn}>
                    {savingAddr ? 'Saving...' : 'Save Address'}
                  </button>
                  <button type="button" onClick={() => setShowAddAddr(false)} className={styles.cancelBtn}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className={styles.addressList}>
              {addresses.length > 0 ? (
                addresses.map((addr) => (
                  <div key={addr.id} className={styles.addressItem}>
                    <div className={styles.addrText}>
                      <div className={styles.addrTitleRow}>
                        <strong>{addr.line1}</strong>
                        {addr.is_default && <span className={styles.defaultPill}>Default</span>}
                      </div>
                      {addr.line2 && <span>{addr.line2}</span>}
                      <span>{addr.city}, {addr.state} - {addr.pincode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className={styles.delAddrBtn}
                      aria-label="Delete address"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.noAddresses}>No saved addresses yet. Add one for expedited checkout.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
