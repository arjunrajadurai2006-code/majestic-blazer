import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'mb_cart_v2';
const COUPON_STORAGE_KEY = 'mb_applied_coupon';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
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
    setItems((prev) => {
      const key = `buy_${product.id}_${variant.id}`;
      const existingIndex = prev.findIndex((i) => i.key === key);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(newQty, variant.stock_quantity || 10),
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
          quantity,
          maxQuantity: variant.stock_quantity || 10,
        },
      ];
    });
  };

  const addRentalToCart = (product, variant, { startDate, endDate, rentalDays, rentAmount, depositAmount }) => {
    setItems((prev) => {
      const key = `rent_${product.id}_${variant.id}_${startDate}_${endDate}`;
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev; // already in cart
      return [
        ...prev,
        {
          key,
          type: 'rental',
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          slug: product.slug,
          color: product.color,
          size: variant.size,
          sku: variant.sku,
          imageUrl: product.image_url || product.images?.[0]?.url,
          startDate,
          endDate,
          rentalDays,
          rentAmount: Number(rentAmount),
          depositAmount: Number(depositAmount),
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (key, quantity) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          if (item.type === 'rental') return item; // rentals are single booking
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
    const buySubtotal = items
      .filter((i) => i.type === 'buy')
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    const rentSubtotal = items
      .filter((i) => i.type === 'rental')
      .reduce((sum, i) => sum + i.rentAmount, 0);
    const cartTotal = buySubtotal + rentSubtotal;

    const res = await api.post('/coupons/validate', { code, cartTotal });
    setAppliedCoupon(res.data);
    return res.data;
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const totals = useMemo(() => {
    let buySubtotal = 0;
    let rentSubtotal = 0;
    let depositSubtotal = 0;

    for (const item of items) {
      if (item.type === 'buy') {
        buySubtotal += item.price * item.quantity;
      } else if (item.type === 'rental') {
        rentSubtotal += item.rentAmount;
        depositSubtotal += item.depositAmount;
      }
    }

    const cartTotal = buySubtotal + rentSubtotal;
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
    const totalPayable = Math.max(0, cartTotal - discount + deliveryFee + depositSubtotal);

    return {
      buySubtotal,
      rentSubtotal,
      depositSubtotal,
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
    addRentalToCart,
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

