import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);
const WISHLIST_LOCAL_KEY = 'mb_wishlist_ids';

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

  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(WISHLIST_LOCAL_KEY, JSON.stringify(wishlistIds));
  }, [wishlistIds]);

  const loadWishlist = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get('/wishlist');
      setWishlistItems(res.data || []);
      setWishlistIds((res.data || []).map((i) => i.product_id));
    } catch (e) {
      console.error('Failed to fetch wishlist', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadWishlist();
    } else {
      setWishlistItems([]);
    }
  }, [user]);

  const toggleWishlist = async (product) => {
    const isPresent = wishlistIds.includes(product.id);
    if (isPresent) {
      setWishlistIds((prev) => prev.filter((id) => id !== product.id));
      setWishlistItems((prev) => prev.filter((i) => i.product_id !== product.id));
      if (user) {
        await api.delete(`/wishlist/${product.id}`).catch(() => {});
      }
    } else {
      setWishlistIds((prev) => [...prev, product.id]);
      setWishlistItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          slug: product.slug,
          sale_price: product.sale_price,
          rent_price_per_day: product.rent_price_per_day,
          is_purchasable: product.is_purchasable,
          is_rentable: product.is_rentable,
          image_url: product.image_url || product.images?.[0]?.url,
        },
      ]);
      if (user) {
        await api.post('/wishlist', { productId: product.id }).catch(() => {});
      }
    }
  };

  const isWishlisted = (productId) => wishlistIds.includes(productId);

  const value = {
    wishlistIds,
    wishlistItems,
    wishlistCount: wishlistIds.length,
    toggleWishlist,
    isWishlisted,
    loadWishlist,
    loading,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);

