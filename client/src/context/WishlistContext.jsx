import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);
const WISHLIST_LOCAL_KEY = 'mb_wishlist_ids';
const WISHLIST_ITEMS_KEY = 'mb_wishlist_items';

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_LOCAL_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const saved = localStorage.getItem(WISHLIST_ITEMS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_LOCAL_KEY, JSON.stringify(wishlistIds));
    } catch (e) {
      console.error('Failed to save wishlist IDs to localStorage', e);
    }
  }, [wishlistIds]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_ITEMS_KEY, JSON.stringify(wishlistItems));
    } catch (e) {
      console.error('Failed to save wishlist items to localStorage', e);
    }
  }, [wishlistItems]);

  const loadWishlist = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get('/wishlist');
      const backendItems = res.data || [];
      setWishlistItems(backendItems);
      setWishlistIds(backendItems.map((i) => i.product_id || i.id));
    } catch (e) {
      console.error('Failed to fetch wishlist', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWishlist();
    }
  }, [user, loadWishlist]);

  const toggleWishlist = useCallback(async (product) => {
    const productId = product?.id || product?.product_id;
    if (!productId) return;

    const isPresent = wishlistIds.includes(productId);
    if (isPresent) {
      setWishlistIds((prev) => prev.filter((id) => id !== productId));
      setWishlistItems((prev) => prev.filter((i) => (i.product_id || i.id) !== productId));
      if (user) {
        await api.delete(`/wishlist/${productId}`).catch(() => {});
      }
    } else {
      setWishlistIds((prev) => [...new Set([...prev, productId])]);
      const newItem = {
        product_id: productId,
        id: productId,
        name: product.name,
        slug: product.slug,
        sale_price: product.sale_price,
        is_purchasable: product.is_purchasable,
        image_url: product.image_url || product.images?.[0]?.url,
      };
      setWishlistItems((prev) => {
        const filtered = prev.filter((i) => (i.product_id || i.id) !== productId);
        return [...filtered, newItem];
      });
      if (user) {
        await api.post('/wishlist', { productId }).catch(() => {});
      }
    }
  }, [user, wishlistIds]);

  const isWishlisted = useCallback((productId) => wishlistIds.includes(productId), [wishlistIds]);

  const value = useMemo(() => ({
    wishlistIds,
    wishlistItems,
    wishlistCount: wishlistIds.length,
    toggleWishlist,
    isWishlisted,
    loadWishlist,
    loading,
  }), [wishlistIds, wishlistItems, toggleWishlist, isWishlisted, loadWishlist, loading]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
