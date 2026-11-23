const PENDING_ACTION_KEY = 'mb_pending_guest_action';

/**
 * Persists an unauthenticated guest action in sessionStorage.
 * Stores strictly identifiers (productId, variantId, size, quantity, returnUrl).
 * Never stores prices, discounts, stock, tokens or credentials.
 */
export const savePendingGuestAction = ({ action, productId, variantId, size, quantity = 1, returnUrl = '/' }) => {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      action,
      productId: Number(productId),
      variantId: variantId ? Number(variantId) : null,
      size: size || null,
      quantity: Math.max(1, Number(quantity) || 1),
      returnUrl: returnUrl || '/',
      timestamp: Date.now(),
    };
    sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save pending guest action to sessionStorage', err);
  }
};

/**
 * Retrieves the pending guest action if it exists and has not expired (2-hour limit).
 */
export const getPendingGuestAction = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ignore actions older than 2 hours to avoid stale replays
    if (Date.now() - (parsed.timestamp || 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_ACTION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Clears the pending guest action from sessionStorage.
 */
export const clearPendingGuestAction = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_ACTION_KEY);
  } catch {}
};

// In-memory set to prevent multiple execution in the same session lifecycle
const executedActionSignatures = new Set();

/**
 * Revalidates and executes a pending guest action post-authentication.
 * Guaranteed idempotent and atomic: clears the action immediately before execution.
 *
 * @param {Object} options
 * @param {Function} options.api - Axios/Fetch api service
 * @param {Object} options.user - Authenticated user
 * @param {Function} options.addToCart - CartContext addToCart
 * @param {Function} options.loadWishlist - WishlistContext loadWishlist
 * @param {Function} [options.success] - ToastContext success
 * @param {Function} [options.toastError] - ToastContext error
 */
export const executePendingGuestAction = async ({
  api,
  user,
  addToCart,
  loadWishlist,
  success = () => {},
  toastError = () => {},
}) => {
  if (!user) return null;

  const pending = getPendingGuestAction();
  if (!pending) return null;

  // Deduplication signature
  const signature = `${pending.action}_${pending.productId}_${pending.variantId}_${pending.timestamp}`;
  if (executedActionSignatures.has(signature)) {
    clearPendingGuestAction();
    return null;
  }

  // Clear immediately from storage so concurrent effects or refreshes cannot re-trigger
  clearPendingGuestAction();
  executedActionSignatures.add(signature);

  try {
    // -------------------------------------------------------------------------
    // 1. Wishlist Action
    // -------------------------------------------------------------------------
    if (pending.action === 'wishlist' || pending.action === 'toggleWishlist') {
      if (!pending.productId) return null;

      // Persist to backend
      await api.post('/wishlist', { productId: pending.productId }).catch(() => {});

      // Refresh frontend wishlist state and badge counters
      if (typeof loadWishlist === 'function') {
        await loadWishlist();
      }

      success('Saved to your bespoke wishlist.');
      return { handled: true, action: 'wishlist', returnUrl: pending.returnUrl };
    }

    // -------------------------------------------------------------------------
    // 2. Quick View Add to Bag Action
    // -------------------------------------------------------------------------
    if (pending.action === 'addToCart' || pending.action === 'buyNow') {
      if (!pending.productId) return null;

      // Revalidate product through backend: NEVER trust client-stored price or stock
      const prodRes = await api.get(`/products/id/${pending.productId}`).catch(() => null);
      const product = prodRes?.data;

      if (!product || !product.is_active || !product.is_purchasable) {
        toastError('The selected blazer is currently not available for purchase.');
        return { handled: false, returnUrl: pending.returnUrl };
      }

      // Revalidate variant and size
      const variants = product.variants || [];
      let variant = null;
      if (pending.variantId) {
        variant = variants.find((v) => v.id === pending.variantId);
      }
      if (!variant && pending.size) {
        variant = variants.find((v) => v.size === pending.size);
      }
      if (!variant) {
        variant = variants[0];
      }

      if (!variant) {
        toastError('The requested size is no longer available.');
        return { handled: false, returnUrl: pending.returnUrl };
      }

      // Revalidate real available stock
      const availableStock = Number(variant.stock_quantity || 0);
      if (availableStock <= 0) {
        toastError(`Size ${variant.size} is currently sold out.`);
        return { handled: false, returnUrl: pending.returnUrl };
      }

      const qtyToAdd = Math.max(1, Math.min(pending.quantity || 1, availableStock));

      // Add to cart with trusted backend product and variant data
      if (typeof addToCart === 'function') {
        const result = addToCart(product, variant, qtyToAdd);
        if (result?.updated) {
          success(`Updated quantity of "${product.name} (Size: ${variant.size})" to ${result.quantity} in your bag.`);
        } else {
          success(`Added "${product.name} (Size: ${variant.size})" to your bag.`);
        }
      }
      return { handled: true, action: pending.action, returnUrl: pending.returnUrl };
    }

    return null;
  } catch (err) {
    console.error('Failed to execute pending guest action:', err);
    return null;
  }
};
