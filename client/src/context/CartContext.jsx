import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'mb_cart_v2';
const COUPON_STORAGE_KEY = 'mb_applied_coupon';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((i) => i && i.type === 'buy') : [];
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState(() => {
    try {
      const saved = localStorage.getItem(COUPON_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      if (appliedCoupon) {
        localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(appliedCoupon));
      } else {
        localStorage.removeItem(COUPON_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save coupon to localStorage', e);
    }
  }, [appliedCoupon]);

  const addToCart = (product, variant, quantity = 1) => {
    const key = `buy_${product.id}_${variant.id}`;
    let isUpdated = false;
    let finalQty = quantity;

    // Check against current items
    const existing = items.find((i) => i.key === key);
    if (existing) {
      isUpdated = true;
      const maxStock = variant.stock_quantity || 10;
      finalQty = Math.min(existing.quantity + quantity, maxStock);
    } else {
      finalQty = Math.min(quantity, variant.stock_quantity || 10);
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.key === key);
      if (existingIndex > -1) {
        const updated = [...prev];
        const maxStock = variant.stock_quantity || 10;
        const newQty = Math.min(updated[existingIndex].quantity + quantity, maxStock);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          maxQuantity: maxStock,
        };
        return updated;
      }
      return [
        ...prev,
        {
          key,
          type: 'buy',
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          slug: product.slug,
          color: product.color,
          size: variant.size,
          sku: variant.sku,
          price: Number(product.sale_price),
          imageUrl: product.image_url || product.images?.[0]?.url,
          quantity: Math.min(quantity, variant.stock_quantity || 10),
          maxQuantity: variant.stock_quantity || 10,
        },
      ];
    });

    return { updated: isUpdated, quantity: finalQty };
  };

  const updateQuantity = (key, quantity) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const newQty = Math.max(1, Math.min(quantity, item.maxQuantity || 10));
          return { ...item, quantity: newQty };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (key) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const applyCoupon = async (code) => {
    const cartTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const res = await api.post('/coupons/validate', { code, cartTotal });
    setAppliedCoupon(res.data);
    return res.data;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const totals = useMemo(() => {
    const buySubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const cartTotal = buySubtotal;
    let discount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        discount = (cartTotal * appliedCoupon.discountValue) / 100;
        if (appliedCoupon.maxDiscount && discount > appliedCoupon.maxDiscount) {
          discount = appliedCoupon.maxDiscount;
        }
      } else {
        discount = appliedCoupon.discountAmount || appliedCoupon.discountValue;
      }
      discount = Math.min(discount, cartTotal);
    }

    const deliveryFee = 0; // Complimentary luxury delivery
    const totalPayable = Math.max(0, cartTotal - discount + deliveryFee);

    return {
      buySubtotal,
      rentSubtotal: 0,
      depositSubtotal: 0,
      cartTotal,
      discount,
      deliveryFee,
      totalPayable,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }, [items, appliedCoupon]);

  const value = {
    items,
    appliedCoupon,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    ...totals,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

