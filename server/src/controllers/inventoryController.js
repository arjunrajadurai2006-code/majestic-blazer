import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => {
  const { search, lowStockOnly } = req.query;
  const where = [];
  const params = [];

  if (lowStockOnly === 'true') {
    where.push('(pv.stock_quantity <= 2)');
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    const p1 = params.length;
    where.push(`(p.name ILIKE $${p1} OR pv.sku ILIKE $${p1})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT pv.*, p.name AS product_name, p.slug AS product_slug, p.is_purchasable,
       c.name AS category_name,
       COALESCE((
         SELECT SUM(ir.quantity)
         FROM inventory_reservations ir
         WHERE ir.variant_id = pv.id
           AND ir.status = 'active'
           AND ir.expires_at > NOW()
       ), 0)::INTEGER AS reserved_quantity,
       GREATEST(0, pv.stock_quantity - COALESCE((
         SELECT SUM(ir.quantity)
         FROM inventory_reservations ir
         WHERE ir.variant_id = pv.id
           AND ir.status = 'active'
           AND ir.expires_at > NOW()
       ), 0))::INTEGER AS available_quantity,
       (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1) AS image_url
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.name ASC, pv.size ASC`,
    params
  );
  res.json({ success: true, data: rows });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const variantId = parseInt(id, 10);
  if (isNaN(variantId) || variantId <= 0) {
    throw new AppError('Invalid inventory variant ID. ID must be a positive integer.', 400);
  }

  const { stockQuantity, reason } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the variant row with FOR UPDATE to serialize concurrent reservation and adjustment operations
    const { rows: vRows } = await client.query(
      `SELECT pv.*, p.name AS product_name, p.is_purchasable
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1 FOR UPDATE`,
      [variantId]
    );

    if (!vRows.length) {
      await client.query('ROLLBACK');
      throw new AppError('Variant not found', 404);
    }

    const currentVariant = vRows[0];
    const oldPhysicalStock = Number(currentVariant.stock_quantity);

    // 2. Query active, unexpired customer checkout reservations under the row lock
    const { rows: rRows } = await client.query(
      `SELECT COALESCE(SUM(quantity), 0)::INTEGER AS active_reserved
       FROM inventory_reservations
       WHERE variant_id = $1
         AND status = 'active'
         AND expires_at > NOW()`,
      [variantId]
    );

    const activeReservedQuantity = Number(rRows[0]?.active_reserved || 0);

    // 3. Validate new physical stock against active reservations
    let targetPhysicalStock = oldPhysicalStock;
    if (stockQuantity !== undefined && stockQuantity !== null) {
      const parsedStock = parseInt(stockQuantity, 10);
      if (isNaN(parsedStock) || parsedStock < 0) {
        await client.query('ROLLBACK');
        throw new AppError('stockQuantity must be a non-negative integer (0 or greater).', 400);
      }

      // STRICT SAFEGUARD: Reject if physical stock is reduced below currently active customer reservations
      if (parsedStock < activeReservedQuantity) {
        await client.query('ROLLBACK');
        throw new AppError(
          `Cannot reduce physical stock to ${parsedStock}. There are currently ${activeReservedQuantity} unit(s) actively reserved in customer checkout sessions. Minimum allowable physical stock is ${activeReservedQuantity}.`,
          409
        );
      }
      targetPhysicalStock = parsedStock;
    }

    // 4. Update product_variants atomically
    const { rows: updatedRows } = await client.query(
      `UPDATE product_variants SET
        stock_quantity = $1
       WHERE id = $2
       RETURNING *`,
      [targetPhysicalStock, variantId]
    );

    const updatedVariant = updatedRows[0];
    const newAvailableStock = Math.max(0, targetPhysicalStock - activeReservedQuantity);

    // 5. Record atomic audit entry in existing audit_logs table
    const auditDetails = {
      variantId,
      productId: currentVariant.product_id,
      productName: currentVariant.product_name,
      size: currentVariant.size,
      sku: currentVariant.sku,
      previousPhysicalStock: oldPhysicalStock,
      newPhysicalStock: targetPhysicalStock,
      activeReservations: activeReservedQuantity,
      availableStock: newAvailableStock,
      reason: (typeof reason === 'string' && reason.trim()) ? reason.trim() : 'Manual admin inventory adjustment',
    };

    await client.query(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        req.user?.id || null,
        'INVENTORY_ADJUSTMENT',
        'product_variants',
        String(variantId),
        JSON.stringify(auditDetails),
        req.ip || null,
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        ...updatedVariant,
        reserved_quantity: activeReservedQuantity,
        available_quantity: newAvailableStock,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});
