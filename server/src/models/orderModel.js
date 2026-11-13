import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const create = async (userId, {
  items,
  addressId = null,
  deliveryType = 'delivery',
  shippingAddress = null,
  discount = 0,
  tax = 0,
  shipping = 0,
  notes = null,
  paymentMethod = 'razorpay',
}) => {
  if (!items || !items.length) {
    throw new AppError('Order must contain at least one item', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const { rows: variantRows } = await client.query(
        `SELECT pv.*, p.name AS product_name, p.sale_price, p.is_purchasable, p.is_active
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = $1 FOR UPDATE`,
        [item.variantId]
      );

      const variant = variantRows[0];
      if (!variant || !variant.is_active || !variant.is_purchasable) {
        throw new AppError(`Item "${item.name || 'product'}" is not available for purchase`, 400);
      }

      if (variant.stock_quantity < item.quantity) {
        throw new AppError(`Insufficient stock for "${variant.product_name}" (Size: ${variant.size}). Available: ${variant.stock_quantity}`, 400);
      }

      const unitPrice = Number(variant.sale_price);
      subtotal += unitPrice * item.quantity;

      validatedItems.push({
        productId: variant.product_id,
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice,
      });

      // Decrement stock
      await client.query(
        'UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, variant.id]
      );
    }

    const total = Math.max(0, subtotal - Number(discount) + Number(tax) + Number(shipping));
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `MB-ORD-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (
        order_number, user_id, address_id, delivery_type, shipping_address,
        subtotal, discount, tax, shipping, total, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)
      RETURNING *`,
      [
        orderNumber,
        userId,
        addressId,
        deliveryType,
        shippingAddress ? (typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress)) : null,
        subtotal,
        discount,
        tax,
        shipping,
        total,
        notes,
      ]
    );

    const order = orderRows[0];

    for (const item of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.productId, item.variantId, item.quantity, item.unitPrice]
      );
    }

    // Auto-create invoice record
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${randomSuffix}`;
    await client.query(
      `INSERT INTO invoices (invoice_number, order_id, amount, invoice_data)
       VALUES ($1, $2, $3, $4)`,
      [
        invoiceNumber,
        order.id,
        order.total,
        JSON.stringify({
          orderNumber,
          customerDetails: { userId },
          subtotal,
          discount,
          tax,
          shipping,
          total,
          items: validatedItems,
        }),
      ]
    );

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const listMine = async (userId) => {
  const { rows: orders } = await pool.query(
    `SELECT o.*,
       (SELECT json_agg(json_build_object(
         'id', oi.id,
         'productId', oi.product_id,
         'productName', p.name,
         'productSlug', p.slug,
         'imageUrl', (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1),
         'variantId', oi.variant_id,
         'size', pv.size,
         'sku', pv.sku,
         'quantity', oi.quantity,
         'unitPrice', oi.unit_price
       )) FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE oi.order_id = o.id) AS items,
       (SELECT i.invoice_number FROM invoices i WHERE i.order_id = o.id LIMIT 1) AS invoice_number
     FROM orders o
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return orders;
};

export const getById = async (id, userId = null) => {
  const where = ['o.id = $1'];
  const params = [id];
  if (userId) {
    where.push('o.user_id = $2');
    params.push(userId);
  }

  const { rows } = await pool.query(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
       a.line1, a.line2, a.city, a.state, a.pincode,
       (SELECT json_agg(json_build_object(
         'id', oi.id,
         'productId', oi.product_id,
         'productName', p.name,
         'productSlug', p.slug,
         'imageUrl', (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1),
         'variantId', oi.variant_id,
         'size', pv.size,
         'sku', pv.sku,
         'quantity', oi.quantity,
         'unitPrice', oi.unit_price
       )) FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE oi.order_id = o.id) AS items,
       (SELECT json_build_object(
         'id', p.id,
         'provider', p.provider,
         'status', p.status,
         'amount', p.amount,
         'paymentId', p.provider_payment_id
       ) FROM payments p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) AS payment,
       (SELECT i.invoice_number FROM invoices i WHERE i.order_id = o.id LIMIT 1) AS invoice_number
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN addresses a ON a.id = o.address_id
     WHERE ${where.join(' AND ')} LIMIT 1`,
    params
  );
  return rows[0] || null;
};

export const listAll = async ({ status, search, page = 1, limit = 20 }) => {
  const where = [];
  const params = [];

  if (status) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    const p1 = params.length;
    params.push(`%${search.trim()}%`);
    const p2 = params.length;
    where.push(`(o.order_number ILIKE $${p1} OR u.full_name ILIKE $${p2} OR u.email ILIKE $${p2})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRes = await pool.query(
    `SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id ${whereSql}`,
    params
  );
  const total = Number(countRes.rows[0]?.total || 0);

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const { rows: items } = await pool.query(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email,
       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count,
       (SELECT i.invoice_number FROM invoices i WHERE i.order_id = o.id LIMIT 1) AS invoice_number
     FROM orders o
     JOIN users u ON u.id = o.user_id
     ${whereSql}
     ORDER BY o.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    queryParams
  );

  return { items, total };
};

export const updateStatus = async (id, { status, trackingNumber, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!existing.length) throw new AppError('Order not found', 404);
    const order = existing[0];

    // If order is newly cancelled, restore stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const { rows: orderItems } = await client.query(
        'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
        [id]
      );
      for (const item of orderItems) {
        if (item.variant_id) {
          await client.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [item.quantity, item.variant_id]
          );
        }
      }
    }

    const { rows: updated } = await client.query(
      `UPDATE orders SET
        status = $1,
        tracking_number = COALESCE($2, tracking_number),
        notes = COALESCE($3, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, trackingNumber || null, notes || null, id]
    );

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

