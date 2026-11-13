import { pool } from '../config/db.js';

const LIST_COLUMNS = `p.id, p.name, p.slug, p.description, p.color, p.material, p.fit,
  p.sale_price, p.original_price, p.rent_price_per_day, p.security_deposit,
  p.is_purchasable, p.is_rentable, p.is_featured, p.is_active, p.created_at,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
  (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY i.is_primary DESC, i.sort_order LIMIT 1) AS image_url,
  (SELECT COALESCE(AVG(r.rating), 5.0) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = true) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = true) AS reviews_count`;

export const list = async ({
  type,
  category,
  search,
  color,
  material,
  fit,
  size,
  minPrice,
  maxPrice,
  featured,
  sort = 'newest',
  page = 1,
  limit = 12,
  includeInactive = false,
}) => {
  const where = [];
  const whereParams = [];

  if (!includeInactive) {
    where.push('p.is_active = true');
  }

  if (type === 'buy') where.push('p.is_purchasable = true');
  if (type === 'rent') where.push('p.is_rentable = true');
  if (featured === true || featured === 'true') where.push('p.is_featured = true');

  if (category) {
    whereParams.push(category);
    where.push(`c.slug = $${whereParams.length}`);
  }

  if (color) {
    whereParams.push(`%${color}%`);
    where.push(`p.color ILIKE $${whereParams.length}`);
  }

  if (material) {
    whereParams.push(`%${material}%`);
    where.push(`p.material ILIKE $${whereParams.length}`);
  }

  if (fit) {
    whereParams.push(`%${fit}%`);
    where.push(`p.fit ILIKE $${whereParams.length}`);
  }

  if (size) {
    whereParams.push(size);
    where.push(`EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.size = $${whereParams.length} AND (pv.stock_quantity > 0 OR pv.rental_stock_quantity > 0))`);
  }

  if (minPrice != null && minPrice !== '') {
    whereParams.push(Number(minPrice));
    where.push(`p.sale_price >= $${whereParams.length}`);
  }

  if (maxPrice != null && maxPrice !== '') {
    whereParams.push(Number(maxPrice));
    where.push(`p.sale_price <= $${whereParams.length}`);
  }

  if (search) {
    whereParams.push(`%${search.trim()}%`);
    const p1 = whereParams.length;
    whereParams.push(`%${search.trim()}%`);
    const p2 = whereParams.length;
    where.push(`(p.name ILIKE $${p1} OR p.description ILIKE $${p2} OR p.color ILIKE $${p1} OR p.material ILIKE $${p2})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let orderBy = 'p.created_at DESC';
  if (sort === 'price_asc') orderBy = 'p.sale_price ASC NULLS LAST';
  else if (sort === 'price_desc') orderBy = 'p.sale_price DESC NULLS LAST';
  else if (sort === 'rent_asc') orderBy = 'p.rent_price_per_day ASC NULLS LAST';
  else if (sort === 'rent_desc') orderBy = 'p.rent_price_per_day DESC NULLS LAST';
  else if (sort === 'rating') orderBy = 'avg_rating DESC, p.created_at DESC';

  const countSql = `SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`;
  const { rows: countRows } = await pool.query(countSql, whereParams);
  const total = Number(countRows[0]?.total || 0);

  const offset = (Number(page) - 1) * Number(limit);
  const queryParams = [...whereParams, Number(limit), offset];
  const itemsSql = `SELECT ${LIST_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
     ${whereSql} ORDER BY ${orderBy} LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`;

  const { rows: items } = await pool.query(itemsSql, queryParams);
  return { items, total };
};

export const findBySlug = async (slug) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
       (SELECT COALESCE(AVG(r.rating), 5.0) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = true) AS avg_rating,
       (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.is_approved = true) AS reviews_count
     FROM products p JOIN categories c ON c.id = p.category_id WHERE p.slug = $1 AND p.is_active = true LIMIT 1`,
    [slug]
  );
  const product = rows[0];
  if (!product) return null;

  const { rows: images } = await pool.query(
    'SELECT id, url, alt_text, is_primary, sort_order FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order',
    [product.id]
  );

  const { rows: variants } = await pool.query(
    'SELECT id, sku, size, stock_quantity, rental_stock_quantity FROM product_variants WHERE product_id = $1 ORDER BY id',
    [product.id]
  );

  const { rows: reviews } = await pool.query(
    `SELECT r.id, r.rating, r.title, r.comment, r.created_at, u.full_name AS user_name
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND r.is_approved = true
     ORDER BY r.created_at DESC LIMIT 10`,
    [product.id]
  );

  return { ...product, images, variants, reviews };
};

export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1 LIMIT 1`,
    [id]
  );
  const product = rows[0];
  if (!product) return null;

  const { rows: images } = await pool.query(
    'SELECT id, url, alt_text, is_primary, sort_order FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order',
    [product.id]
  );

  const { rows: variants } = await pool.query(
    'SELECT id, sku, size, stock_quantity, rental_stock_quantity FROM product_variants WHERE product_id = $1 ORDER BY id',
    [product.id]
  );

  return { ...product, images, variants };
};

export const create = async (p) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO products (
        category_id, name, slug, description, color, material, fit, care_instructions,
        is_purchasable, is_rentable, is_featured, sale_price, original_price,
        rent_price_per_day, security_deposit, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id`,
      [
        p.categoryId,
        p.name.trim(),
        p.slug.trim().toLowerCase(),
        p.description ?? null,
        p.color ?? null,
        p.material ?? null,
        p.fit ?? 'Tailored Slim Fit',
        p.careInstructions ?? 'Dry clean only. Store on wooden hanger.',
        p.isPurchasable ?? true,
        p.isRentable ?? false,
        p.isFeatured ?? false,
        p.salePrice ?? null,
        p.originalPrice ?? null,
        p.rentPricePerDay ?? null,
        p.securityDeposit ?? null,
        p.isActive ?? true,
      ]
    );
    const productId = rows[0].id;

    if (Array.isArray(p.images) && p.images.length) {
      for (let i = 0; i < p.images.length; i++) {
        const img = p.images[i];
        await client.query(
          `INSERT INTO product_images (product_id, url, alt_text, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, img.url, img.altText || p.name, Boolean(img.isPrimary ?? (i === 0)), i]
        );
      }
    }

    if (Array.isArray(p.variants) && p.variants.length) {
      for (const v of p.variants) {
        await client.query(
          `INSERT INTO product_variants (product_id, sku, size, stock_quantity, rental_stock_quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [productId, v.sku.trim(), v.size.trim(), Number(v.stockQuantity) || 0, Number(v.rentalStockQuantity) || 0]
        );
      }
    }

    await client.query('COMMIT');
    return productId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const update = async (id, p) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE products SET
        category_id = $1, name = $2, slug = $3, description = $4, color = $5, material = $6,
        fit = $7, care_instructions = $8, is_purchasable = $9, is_rentable = $10, is_featured = $11,
        sale_price = $12, original_price = $13, rent_price_per_day = $14, security_deposit = $15,
        is_active = $16, updated_at = CURRENT_TIMESTAMP
       WHERE id = $17
       RETURNING id`,
      [
        p.categoryId,
        p.name.trim(),
        p.slug.trim().toLowerCase(),
        p.description ?? null,
        p.color ?? null,
        p.material ?? null,
        p.fit ?? 'Tailored Slim Fit',
        p.careInstructions ?? 'Dry clean only. Store on wooden hanger.',
        p.isPurchasable ?? true,
        p.isRentable ?? false,
        p.isFeatured ?? false,
        p.salePrice ?? null,
        p.originalPrice ?? null,
        p.rentPricePerDay ?? null,
        p.securityDeposit ?? null,
        p.isActive ?? true,
        id,
      ]
    );

    if (Array.isArray(p.images)) {
      await client.query('DELETE FROM product_images WHERE product_id = $1', [id]);
      for (let i = 0; i < p.images.length; i++) {
        const img = p.images[i];
        await client.query(
          `INSERT INTO product_images (product_id, url, alt_text, is_primary, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, img.url, img.altText || p.name, Boolean(img.isPrimary ?? (i === 0)), i]
        );
      }
    }

    if (Array.isArray(p.variants)) {
      for (const v of p.variants) {
        await client.query(
          `INSERT INTO product_variants (product_id, sku, size, stock_quantity, rental_stock_quantity)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (product_id, size) DO UPDATE SET
             sku = EXCLUDED.sku,
             stock_quantity = EXCLUDED.stock_quantity,
             rental_stock_quantity = EXCLUDED.rental_stock_quantity`,
          [id, v.sku.trim(), v.size.trim(), Number(v.stockQuantity) || 0, Number(v.rentalStockQuantity) || 0]
        );
      }
    }

    await client.query('COMMIT');
    return rows[0] ? rows[0].id : null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const remove = async (id) => {
  const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id]);
  return rowCount > 0;
};

export const getRelated = async (productId, categoryId, limit = 4) => {
  const { rows } = await pool.query(
    `SELECT ${LIST_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id != $1 AND p.category_id = $2 AND p.is_active = true
     ORDER BY p.is_featured DESC, p.created_at DESC LIMIT $3`,
    [productId, categoryId, limit]
  );
  return rows;
};
