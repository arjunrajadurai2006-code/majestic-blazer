import { pool } from '../config/db.js';

export const getOverview = async () => {
  const [
    salesRes,
    rentalRes,
    orderStatsRes,
    rentalStatsRes,
    customerCountRes,
    productCountRes,
    inventoryRes,
  ] = await Promise.all([
    pool.query("SELECT COALESCE(SUM(total), 0) AS total_sales_revenue, COUNT(*) AS total_orders FROM orders WHERE status NOT IN ('cancelled', 'refunded')"),
    pool.query("SELECT COALESCE(SUM(rent_amount), 0) AS total_rental_revenue, COUNT(*) AS total_rentals FROM rental_bookings WHERE status != 'cancelled'"),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders
      FROM orders
    `),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'confirmed' OR status = 'picked_up') AS active_rentals,
        COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'picked_up' AND end_date < CURRENT_DATE)) AS overdue_rentals,
        COUNT(*) FILTER (WHERE status = 'returned') AS returned_rentals
      FROM rental_bookings
    `),
    pool.query("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'"),
    pool.query('SELECT COUNT(*) AS total_products FROM products WHERE is_active = true'),
    pool.query('SELECT COALESCE(SUM(stock_quantity), 0) AS total_stock, COALESCE(SUM(rental_stock_quantity), 0) AS total_rental_stock FROM product_variants'),
  ]);

  const salesRev = Number(salesRes.rows[0]?.total_sales_revenue || 0);
  const rentalRev = Number(rentalRes.rows[0]?.total_rental_revenue || 0);
  const totalRevenue = salesRev + rentalRev;

  return {
    totalRevenue,
    salesRevenue: salesRev,
    rentalRevenue: rentalRev,
    totalOrders: Number(salesRes.rows[0]?.total_orders || 0),
    totalRentals: Number(rentalRes.rows[0]?.total_rentals || 0),
    totalCustomers: Number(customerCountRes.rows[0]?.total_customers || 0),
    totalProducts: Number(productCountRes.rows[0]?.total_products || 0),
    totalStock: Number(inventoryRes.rows[0]?.total_stock || 0),
    totalRentalStock: Number(inventoryRes.rows[0]?.total_rental_stock || 0),
    pendingOrders: Number(orderStatsRes.rows[0]?.pending_orders || 0),
    deliveredOrders: Number(orderStatsRes.rows[0]?.delivered_orders || 0),
    cancelledOrders: Number(orderStatsRes.rows[0]?.cancelled_orders || 0),
    activeRentals: Number(rentalStatsRes.rows[0]?.active_rentals || 0),
    overdueRentals: Number(rentalStatsRes.rows[0]?.overdue_rentals || 0),
    returnedRentals: Number(rentalStatsRes.rows[0]?.returned_rentals || 0),
  };
};

export const getRevenueTrends = async ({ range = '30d' }) => {
  let days = 30;
  if (range === '7d') days = 7;
  else if (range === '90d') days = 90;
  else if (range === '1y') days = 365;

  const { rows: salesTrends } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
       COALESCE(SUM(total), 0) AS sales_amount
     FROM orders
     WHERE status NOT IN ('cancelled', 'refunded')
       AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
     GROUP BY date_trunc('day', created_at)
     ORDER BY date ASC`
  );

  const { rows: rentalTrends } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
       COALESCE(SUM(rent_amount), 0) AS rental_amount
     FROM rental_bookings
     WHERE status != 'cancelled'
       AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
     GROUP BY date_trunc('day', created_at)
     ORDER BY date ASC`
  );

  const dateMap = {};
  for (const s of salesTrends) {
    dateMap[s.date] = { date: s.date, sales: Number(s.sales_amount), rentals: 0, total: Number(s.sales_amount) };
  }
  for (const r of rentalTrends) {
    if (!dateMap[r.date]) {
      dateMap[r.date] = { date: r.date, sales: 0, rentals: Number(r.rental_amount), total: Number(r.rental_amount) };
    } else {
      dateMap[r.date].rentals = Number(r.rental_amount);
      dateMap[r.date].total += Number(r.rental_amount);
    }
  }

  const trends = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  return trends;
};

export const getTopBlazers = async (limit = 5) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.slug, c.name AS category_name,
       COALESCE(SUM(oi.quantity), 0) AS units_sold,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
       (SELECT COUNT(*) FROM rental_bookings rb WHERE rb.product_id = p.id AND rb.status != 'cancelled') AS rental_count
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     GROUP BY p.id, c.name
     ORDER BY (units_sold + (SELECT COUNT(*) FROM rental_bookings rb WHERE rb.product_id = p.id)) DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
};

export const getCategoryBreakdown = async () => {
  const { rows } = await pool.query(
    `SELECT c.name, COUNT(p.id) AS products_count,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     GROUP BY c.id
     ORDER BY total_revenue DESC`
  );
  return rows;
};

export const getInventoryHealth = async () => {
  const { rows: lowStock } = await pool.query(
    `SELECT p.name AS product_name, pv.sku, pv.size, pv.stock_quantity, pv.rental_stock_quantity
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     WHERE pv.stock_quantity <= 2 OR pv.rental_stock_quantity <= 1
     ORDER BY (pv.stock_quantity + pv.rental_stock_quantity) ASC
     LIMIT 10`
  );
  return lowStock;
};

