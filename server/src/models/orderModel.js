import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import * as Reservation from './reservationModel.js';
import { ORDER_STATUSES, PERMITTED_STATUS_TRANSITIONS } from '../validators/orderValidators.js';

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
      // 1. Lock variant row to serialize concurrent checks
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

      // 2. Calculate true available stock (physical stock minus active unexpired reservations)
      const { rows: resRows } = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) AS reserved_quantity
         FROM inventory_reservations
         WHERE variant_id = $1
           AND status = 'active'
           AND expires_at > NOW()`,
        [variant.id]
      );
      const activeReserved = Number(resRows[0]?.reserved_quantity || 0);
      const availableStock = variant.stock_quantity - activeReserved;

      if (availableStock < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${variant.product_name}" (Size: ${variant.size}). Available: ${Math.max(0, availableStock)}`,
          400
        );
      }

      const unitPrice = Number(variant.sale_price);
      subtotal += unitPrice * item.quantity;

      validatedItems.push({
        productId: variant.product_id,
        variantId: variant.id,
        productName: variant.product_name,
        size: variant.size,
        quantity: item.quantity,
        unitPrice,
      });

      // NOTE: Stock is NOT decremented here! It is temporarily reserved with a 15-minute expiry.
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

    // 3. Atomically create 15-minute inventory reservations
    await Reservation.reserveInventory({
      userId,
      orderId: order.id,
      items: validatedItems,
      expiryMinutes: 15,
    }, client);

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
  const isNumeric = /^\d+$/.test(String(id || '').trim());
  const where = [isNumeric ? 'o.id = $1' : 'o.order_number = $1'];
  const params = [isNumeric ? parseInt(id, 10) : String(id || '').trim()];
  if (userId) {
    where.push(`o.user_id = $${params.length + 1}`);
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
         'imageUrl', (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC, img.sort_order ASC LIMIT 1),
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
         'paymentId', p.provider_payment_id,
         'refundStatus', p.refund_status,
         'refundAmount', p.refund_amount
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

export const updateStatus = async (
  id,
  { status, trackingNumber, notes, reason, actorId = null, actorRole = 'admin', reqIp = null, restock = null } = {},
  externalClient = null
) => {
  const isOuterClient = Boolean(externalClient && externalClient.query);
  const client = isOuterClient ? externalClient : await pool.connect();

  try {
    if (!isOuterClient) await client.query('BEGIN');

    const isNumeric = /^\d+$/.test(String(id || '').trim());
    const whereClause = isNumeric ? 'WHERE id = $1' : 'WHERE order_number = $1';
    const whereParam = isNumeric ? parseInt(id, 10) : String(id || '').trim();

    const { rows: existing } = await client.query(
      `SELECT * FROM orders ${whereClause} FOR UPDATE`,
      [whereParam]
    );
    if (!existing.length) throw new AppError('Order not found', 404);
    const order = existing[0];

    // 1. Validate status format and presence
    let targetStatus = order.status;
    if (status !== undefined && status !== null) {
      const cleanStatus = String(status).trim().toLowerCase();
      if (!ORDER_STATUSES.includes(cleanStatus)) {
        throw new AppError(
          `Invalid order status: "${status}". Permitted statuses are: ${ORDER_STATUSES.join(', ')}`,
          400
        );
      }
      targetStatus = cleanStatus;
    }

    let didRestock = false;
    let stockPolicyNote = null;

    // 2. Validate state machine transition rules
    if (targetStatus !== order.status) {
      const permitted = PERMITTED_STATUS_TRANSITIONS[order.status] || [];

      if (order.status === 'cancelled') {
        throw new AppError('Cannot modify a cancelled order. Cancelled orders are terminal and cannot be reopened.', 409);
      }

      if (order.status === 'delivered' && targetStatus !== 'refunded') {
        throw new AppError(`Cannot change delivered order to "${targetStatus}". Delivered orders can only be refunded upon return.`, 409);
      }

      if (order.status === 'refunded') {
        throw new AppError('Cannot modify a refunded order. Refunded orders are terminal and cannot be reopened.', 409);
      }

      if (!permitted.includes(targetStatus)) {
        throw new AppError(
          `Invalid status transition: Cannot change order from "${order.status}" to "${targetStatus}".`,
          409
        );
      }

      // 3. Payment verification requirement:
      // Online orders cannot transition from 'pending' to 'confirmed' without a verified payment in database
      if (order.status === 'pending' && targetStatus === 'confirmed') {
        const { rows: payRows } = await client.query(
          "SELECT id, provider, status FROM payments WHERE order_id = $1 AND status = 'paid' LIMIT 1",
          [order.id]
        );
        if (!payRows.length) {
          throw new AppError(
            'Cannot mark order as confirmed without a verified payment record. Online payments must be verified through the payment gateway.',
            409
          );
        }
      }

      // 4. Inventory synchronization on status transitions
      if (targetStatus === 'cancelled') {
        if (order.status === 'confirmed') {
          // Confirmed order was in atelier preparation (not yet dispatched).
          // Restores physical stock exactly once.
          const { rows: orderItems } = await client.query(
            'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
            [order.id]
          );
          for (const item of orderItems) {
            if (item.variant_id) {
              await client.query(
                'UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2',
                [item.quantity, item.variant_id]
              );
            }
          }
          didRestock = true;
          stockPolicyNote = 'Physical stock restored to atelier inventory';
        } else if (order.status === 'shipped') {
          // Shipped order: Garment was handed over to courier (in transit).
          // Explicit Stock Policy: Physical stock is WITHHELD until item physically returns to atelier and passes quality inspection.
          // Restocking only occurs if explicitly confirmed by administrator (restock === true).
          if (restock === true) {
            const { rows: orderItems } = await client.query(
              'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
              [order.id]
            );
            for (const item of orderItems) {
              if (item.variant_id) {
                await client.query(
                  'UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2',
                  [item.quantity, item.variant_id]
                );
              }
            }
            didRestock = true;
            stockPolicyNote = 'Shipped order cancelled & restocked following physical atelier inspection';
          } else {
            stockPolicyNote = 'Shipped order cancelled: Item in transit (RTO). Physical stock withheld pending atelier return inspection';
          }
        }
        // Release active reservations if any still exist
        await Reservation.releaseReservationsForOrder(order.id, 'released', client);

        // If order had an uncollected COD payment in 'created' status, mark as 'failed' (uncollected / cancelled)
        await client.query(
          "UPDATE payments SET status = 'failed' WHERE order_id = $1 AND provider = 'cod' AND status = 'created'",
          [order.id]
        );
      }
    }

    // 5. Update order record
    const { rows: updated } = await client.query(
      `UPDATE orders SET
        status = $1,
        tracking_number = COALESCE($2, tracking_number),
        notes = COALESCE($3, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [targetStatus, trackingNumber || null, notes || null, order.id]
    );

    // 6. Record atomic audit log entry if status changed
    if (targetStatus !== order.status) {
      const auditDetails = {
        orderId: order.id,
        orderNumber: order.order_number,
        previousStatus: order.status,
        newStatus: targetStatus,
        actionSource: actorRole === 'admin' ? 'admin_portal' : 'customer_storefront',
        actorId,
        actorRole,
        reason: reason || notes || null,
        trackingNumber: trackingNumber || order.tracking_number || null,
        didRestock,
        stockPolicyNote,
      };

      await client.query(
        `INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, details, ip_address, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          actorId,
          targetStatus === 'cancelled' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_UPDATE',
          'orders',
          String(order.id),
          JSON.stringify(auditDetails),
          reqIp || null,
        ]
      );
    }

    if (!isOuterClient) await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    if (!isOuterClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (!isOuterClient) client.release();
  }
};

