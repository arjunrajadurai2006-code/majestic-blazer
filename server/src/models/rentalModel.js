import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const checkAvailability = async ({ productId, variantId, startDate, endDate }) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError('Invalid rental dates provided', 400);
  }
  if (end < start) {
    throw new AppError('Return date must be on or after start date', 400);
  }

  // Calculate rental duration in days
  const diffTime = Math.abs(end - start);
  const rentalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Fetch variant rental stock
  const { rows: variantRows } = await pool.query(
    `SELECT pv.*, p.name AS product_name, p.rent_price_per_day, p.security_deposit, p.is_rentable, p.is_active
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     WHERE pv.id = $1 AND p.id = $2 LIMIT 1`,
    [variantId, productId]
  );

  const variant = variantRows[0];
  if (!variant || !variant.is_active || !variant.is_rentable) {
    return { available: false, message: 'This blazer is currently not available for rental' };
  }

  const totalRentalStock = Number(variant.rental_stock_quantity || 0);
  if (totalRentalStock <= 0) {
    return { available: false, message: 'No rental stock exists for this size', availableStock: 0 };
  }

  // Count active overlapping bookings for this variant and date range
  const { rows: overlapRows } = await pool.query(
    `SELECT COUNT(*) AS booked_count
     FROM rental_bookings
     WHERE variant_id = $1
       AND status NOT IN ('cancelled', 'returned')
       AND (start_date <= $2 AND end_date >= $3)`,
    [variantId, endDate, startDate]
  );

  const bookedCount = Number(overlapRows[0]?.booked_count || 0);
  const availableStock = Math.max(0, totalRentalStock - bookedCount);
  const available = availableStock > 0;

  const rentPerDay = Number(variant.rent_price_per_day || 0);
  const rentAmount = rentPerDay * rentalDays;
  const depositAmount = Number(variant.security_deposit || 0);
  const totalAmount = rentAmount + depositAmount;

  return {
    available,
    rentalDays,
    totalRentalStock,
    bookedCount,
    availableStock,
    rentPricePerDay: rentPerDay,
    rentAmount,
    depositAmount,
    totalAmount,
    message: available ? 'Available for selected dates' : 'Already booked for selected dates. Try alternate dates or sizes.',
  };
};

export const createBooking = async (userId, {
  productId,
  variantId,
  startDate,
  endDate,
  deliveryType = 'pickup',
  shippingAddress = null,
  notes = null,
}) => {
  const avail = await checkAvailability({ productId, variantId, startDate, endDate });
  if (!avail.available) {
    throw new AppError(avail.message || 'Blazer is unavailable for the selected dates', 400);
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const bookingNumber = `MB-RNT-${Date.now().toString().slice(-6)}-${randomSuffix}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO rental_bookings (
        booking_number, user_id, product_id, variant_id, start_date, end_date,
        rental_days, rent_amount, deposit_amount, delivery_type, shipping_address,
        status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'requested', $12)
      RETURNING *`,
      [
        bookingNumber,
        userId,
        productId,
        variantId,
        startDate,
        endDate,
        avail.rentalDays,
        avail.rentAmount,
        avail.depositAmount,
        deliveryType,
        shippingAddress ? (typeof shippingAddress === 'string' ? shippingAddress : JSON.stringify(shippingAddress)) : null,
        notes,
      ]
    );

    const booking = rows[0];

    // Create corresponding invoice
    const invoiceNumber = `INV-RNT-${Date.now().toString().slice(-6)}-${randomSuffix}`;
    await client.query(
      `INSERT INTO invoices (invoice_number, rental_booking_id, amount, invoice_data)
       VALUES ($1, $2, $3, $4)`,
      [
        invoiceNumber,
        booking.id,
        avail.totalAmount,
        JSON.stringify({
          bookingNumber,
          rentalDays: avail.rentalDays,
          startDate,
          endDate,
          rentAmount: avail.rentAmount,
          depositAmount: avail.depositAmount,
          totalAmount: avail.totalAmount,
        }),
      ]
    );

    await client.query('COMMIT');
    return booking;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const listMine = async (userId) => {
  const { rows } = await pool.query(
    `SELECT rb.*,
       p.name AS product_name, p.slug AS product_slug, p.color, p.material,
       (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1) AS image_url,
       pv.size, pv.sku,
       (SELECT i.invoice_number FROM invoices i WHERE i.rental_booking_id = rb.id LIMIT 1) AS invoice_number
     FROM rental_bookings rb
     JOIN products p ON p.id = rb.product_id
     LEFT JOIN product_variants pv ON pv.id = rb.variant_id
     WHERE rb.user_id = $1
     ORDER BY rb.created_at DESC`,
    [userId]
  );
  return rows;
};

export const getById = async (id, userId = null) => {
  const where = ['rb.id = $1'];
  const params = [id];
  if (userId) {
    where.push('rb.user_id = $2');
    params.push(userId);
  }

  const { rows } = await pool.query(
    `SELECT rb.*,
       p.name AS product_name, p.slug AS product_slug, p.color, p.material, p.fit,
       (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1) AS image_url,
       pv.size, pv.sku,
       u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
       (SELECT json_build_object(
         'id', pmt.id,
         'provider', pmt.provider,
         'status', pmt.status,
         'amount', pmt.amount,
         'paymentId', pmt.provider_payment_id
       ) FROM payments pmt WHERE pmt.rental_booking_id = rb.id ORDER BY pmt.id DESC LIMIT 1) AS payment,
       (SELECT i.invoice_number FROM invoices i WHERE i.rental_booking_id = rb.id LIMIT 1) AS invoice_number
     FROM rental_bookings rb
     JOIN products p ON p.id = rb.product_id
     LEFT JOIN product_variants pv ON pv.id = rb.variant_id
     JOIN users u ON u.id = rb.user_id
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
    where.push(`rb.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    const p1 = params.length;
    params.push(`%${search.trim()}%`);
    const p2 = params.length;
    where.push(`(rb.booking_number ILIKE $${p1} OR u.full_name ILIKE $${p2} OR u.email ILIKE $${p2} OR p.name ILIKE $${p1})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRes = await pool.query(
    `SELECT COUNT(*) AS total FROM rental_bookings rb JOIN users u ON u.id = rb.user_id JOIN products p ON p.id = rb.product_id ${whereSql}`,
    params
  );
  const total = Number(countRes.rows[0]?.total || 0);

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...params, Number(limit), offset];

  const { rows: items } = await pool.query(
    `SELECT rb.*, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
       p.name AS product_name, pv.size,
       (SELECT i.invoice_number FROM invoices i WHERE i.rental_booking_id = rb.id LIMIT 1) AS invoice_number
     FROM rental_bookings rb
     JOIN users u ON u.id = rb.user_id
     JOIN products p ON p.id = rb.product_id
     LEFT JOIN product_variants pv ON pv.id = rb.variant_id
     ${whereSql}
     ORDER BY rb.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    queryParams
  );

  return { items, total };
};

export const updateStatus = async (id, { status, notes }) => {
  const { rows } = await pool.query(
    `UPDATE rental_bookings SET
      status = $1,
      notes = COALESCE($2, notes),
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING *`,
    [status, notes || null, id]
  );
  return rows[0] || null;
};

export const recordReturn = async (id, { returnCondition, damageFee = 0, lateFee = 0, depositRefundStatus = 'refunded', depositRefundedAmount = 0 }) => {
  const { rows } = await pool.query(
    `UPDATE rental_bookings SET
      status = 'returned',
      returned_at = CURRENT_TIMESTAMP,
      return_condition = $1,
      damage_fee = $2,
      late_fee = $3,
      deposit_refund_status = $4,
      deposit_refunded_amount = $5,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`,
    [returnCondition, Number(damageFee) || 0, Number(lateFee) || 0, depositRefundStatus, Number(depositRefundedAmount) || 0, id]
  );
  return rows[0] || null;
};

