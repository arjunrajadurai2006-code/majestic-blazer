import { pool } from '../config/db.js';

export const getOverview = async () => {
  const [
    orderStatsRes,
    customerCountRes,
    productCountRes,
    inventoryRes,
    paymentStatsRes,
    recentOrdersRes,
    recentCustomersRes,
    topBlazersRes,
  ] = await Promise.all([
    // Combined Sales Revenue & Order Status Breakdown (single table scan)
    pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled', 'refunded')), 0) AS total_sales_revenue,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_orders,
        COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders
      FROM orders
    `),
    // Customers
    pool.query("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'"),
    // Products
    pool.query('SELECT COUNT(*) AS total_products FROM products WHERE is_active = true'),
    // Combined Inventory & Low-Stock Counts (single table scan)
    pool.query(`
      SELECT
        COALESCE(SUM(stock_quantity), 0) AS total_stock,
        COUNT(DISTINCT product_id) FILTER (WHERE stock_quantity <= 2) AS low_stock_products,
        COUNT(*) FILTER (WHERE stock_quantity <= 2) AS low_stock_variants
      FROM product_variants
    `),
    // Payments
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'created') AS pending_payments,
        COUNT(*) FILTER (WHERE status = 'paid') AS successful_payments,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_payments,
        COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_payments
      FROM payments
    `),
    // Recent Orders (6)
    pool.query(`
      SELECT o.id, o.order_number, o.total, o.status, o.created_at,
        u.full_name AS customer_name, u.email AS customer_email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC
      LIMIT 6
    `),
    // Recent Customers (5)
    pool.query(`
      SELECT id, full_name, email, phone, is_active, created_at
      FROM users
      WHERE role = 'customer'
      ORDER BY created_at DESC
      LIMIT 5
    `),
    // Top Blazers (5)
    getTopBlazers(5),
  ]);

  const salesRev = Number(orderStatsRes.rows[0]?.total_sales_revenue || 0);
  const totalRevenue = salesRev;

  const totalOrders = Number(orderStatsRes.rows[0]?.total_orders || 0);
  const totalCustomers = Number(customerCountRes.rows[0]?.total_customers || 0);
  const totalProducts = Number(productCountRes.rows[0]?.total_products || 0);
  const totalStock = Number(inventoryRes.rows[0]?.total_stock || 0);

  const pendingOrders = Number(orderStatsRes.rows[0]?.pending_orders || 0);
  const confirmedOrders = Number(orderStatsRes.rows[0]?.confirmed_orders || 0);
  const shippedOrders = Number(orderStatsRes.rows[0]?.shipped_orders || 0);
  const deliveredOrders = Number(orderStatsRes.rows[0]?.delivered_orders || 0);
  const cancelledOrders = Number(orderStatsRes.rows[0]?.cancelled_orders || 0);

  const pendingPayments = Number(paymentStatsRes.rows[0]?.pending_payments || 0);
  const successfulPayments = Number(paymentStatsRes.rows[0]?.successful_payments || 0);
  const failedPayments = Number(paymentStatsRes.rows[0]?.failed_payments || 0);
  const refundedPayments = Number(paymentStatsRes.rows[0]?.refunded_payments || 0);

  const lowStockCount = Number(inventoryRes.rows[0]?.low_stock_products || 0);
  const lowStockVariants = Number(inventoryRes.rows[0]?.low_stock_variants || 0);

  // Return dual camelCase and snake_case for 100% frontend compatibility
  return {
    totalRevenue,
    total_revenue: totalRevenue,
    salesRevenue: salesRev,
    sales_revenue: salesRev,
    rentalRevenue: 0,
    rental_revenue: 0,

    totalOrders,
    total_orders: totalOrders,
    totalRentals: 0,
    total_rentals: 0,
    totalCustomers,
    total_customers: totalCustomers,
    totalProducts,
    total_products: totalProducts,

    totalStock,
    total_stock: totalStock,
    totalRentalStock: 0,
    total_rental_stock: 0,
    total_stock_units: totalStock,

    pendingOrders,
    pending_orders: pendingOrders,
    confirmedOrders,
    confirmed_orders: confirmedOrders,
    shippedOrders,
    shipped_orders: shippedOrders,
    deliveredOrders,
    delivered_orders: deliveredOrders,
    completedOrders: deliveredOrders,
    completed_orders: deliveredOrders,
    cancelledOrders,
    cancelled_orders: cancelledOrders,

    activeRentals: 0,
    active_rentals: 0,
    overdueRentals: 0,
    overdue_rentals: 0,
    returnedRentals: 0,
    returned_rentals: 0,
    requestedRentals: 0,
    requested_rentals: 0,

    pendingPayments,
    pending_payments: pendingPayments,
    successfulPayments,
    successful_payments: successfulPayments,
    failedPayments,
    failed_payments: failedPayments,
    refundedPayments,
    refunded_payments: refundedPayments,

    lowStockCount,
    low_stock_count: lowStockCount,
    lowStockVariants,
    low_stock_variants: lowStockVariants,

    recentOrders: recentOrdersRes.rows,
    recent_orders: recentOrdersRes.rows,
    recentCustomers: recentCustomersRes.rows,
    recent_customers: recentCustomersRes.rows,
    topBlazers: topBlazersRes,
    top_blazers: topBlazersRes,
  };
};

export const getRevenueTrends = async ({ range = '30d', days: daysParam }) => {
  let days = 30;
  if (range === '7d' || daysParam === '7') days = 7;
  else if (range === '90d' || daysParam === '90') days = 90;
  else if (range === '1y' || daysParam === '365') days = 365;
  else if (Number(daysParam)) days = Number(daysParam);

  const { rows: salesTrends } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
       COALESCE(SUM(total), 0) AS sales_amount
     FROM orders
     WHERE status NOT IN ('cancelled', 'refunded')
       AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
     GROUP BY date_trunc('day', created_at)
     ORDER BY date ASC`
  );

  const dateMap = {};
  for (const s of salesTrends) {
    dateMap[s.date] = { date: s.date, sales: Number(s.sales_amount), rentals: 0, total: Number(s.sales_amount) };
  }

  const trends = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  return trends;
};

export const getTopBlazers = async (limit = 5) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.slug, p.sale_price, c.name AS category_name,
       COALESCE(SUM(oi.quantity), 0) AS units_sold,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
       (SELECT url FROM product_images img WHERE img.product_id = p.id ORDER BY img.is_primary DESC LIMIT 1) AS image_url
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     GROUP BY p.id, c.name
     ORDER BY COALESCE(SUM(oi.quantity), 0) DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
};

export const getCategoryBreakdown = async () => {
  const { rows } = await pool.query(
    `SELECT c.name, COUNT(DISTINCT p.id) AS products_count,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     GROUP BY c.id, c.name
     ORDER BY total_revenue DESC`
  );
  return rows;
};

export const getInventoryHealth = async () => {
  const { rows: lowStock } = await pool.query(
    `SELECT p.name AS product_name, pv.sku, pv.size, pv.stock_quantity
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     WHERE pv.stock_quantity <= 2
     ORDER BY pv.stock_quantity ASC
     LIMIT 15`
  );
  return lowStock;
};
