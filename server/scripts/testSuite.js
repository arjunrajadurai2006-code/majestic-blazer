import http from 'node:http';
import app from '../src/app.js';
import { pool, testConnection } from '../src/config/db.js';

async function runTests() {
  console.log('--- 1. Testing Database Connection to Aiven PostgreSQL ---');
  const dbInfo = await testConnection();
  console.log('✓ Connected to PostgreSQL:', dbInfo.db, '| Version:', dbInfo.version.split(' ')[0], dbInfo.version.split(' ')[1]);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`✓ Test HTTP server listening on port ${port}`);

  const request = async (path, options = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body: json };
  };

  try {
    console.log('\n--- 2. Health & Store Settings ---');
    const health = await request('/health');
    if (health.status !== 200 || !health.body.success) throw new Error('Health check failed');
    const settings = await request('/settings');
    if (settings.status !== 200 || !settings.body.data?.store_name) throw new Error('Settings check failed');
    console.log('✓ Store Name:', settings.body.data.store_name, '| Phone:', settings.body.data.store_phone);

    console.log('\n--- 3. Customer Authentication & Profile ---');
    const testEmail = `tester_${Date.now()}@example.com`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Master Blazer Tester',
        email: testEmail,
        phone: '9876543210',
        password: 'Password123!',
      },
    });
    if (regRes.status !== 201 || !regRes.body.data?.token) throw new Error('Registration failed');
    const customerToken = regRes.body.data.token;
    const customerId = regRes.body.data.user.id;
    console.log('✓ Registered customer id:', customerId);

    // Profile update
    const profileRes = await request('/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { fullName: 'Sir Blazer Tester', phone: '9876543219' },
    });
    if (profileRes.status !== 200 || profileRes.body.data?.user?.fullName !== 'Sir Blazer Tester') {
      throw new Error('Profile update failed');
    }
    console.log('✓ Updated profile:', profileRes.body.data.user.fullName);

    // Address management
    const addAddrRes = await request('/auth/addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        line1: '123 Heritage Palace',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        pincode: '641107',
        isDefault: true,
      },
    });
    if (addAddrRes.status !== 201 || !addAddrRes.body.data?.id) throw new Error('Address creation failed');
    const addressId = addAddrRes.body.data.id;
    console.log('✓ Created address id:', addressId);

    console.log('\n--- 4. Admin Authentication ---');
    const adminLoginRes = await request('/auth/admin/login', {
      method: 'POST',
      body: {
        email: 'admin@majesticblazer.com',
        password: 'MajesticAdmin2026!Secure',
      },
    });
    if (adminLoginRes.status !== 200 || !adminLoginRes.body.data?.token) throw new Error('Admin login failed');
    const adminToken = adminLoginRes.body.data.token;
    console.log('✓ Admin authenticated');

    console.log('\n--- 5. Catalog Listing & Details ---');
    const prodList = await request('/products?limit=5');
    if (prodList.status !== 200 || !prodList.body.data?.length) throw new Error('Product list failed');
    const sampleProduct = prodList.body.data[0];
    console.log('✓ Loaded products. Sample:', sampleProduct.name, `(₹${sampleProduct.sale_price})`);

    const prodDetail = await request(`/products/${sampleProduct.slug}`);
    if (prodDetail.status !== 200 || !prodDetail.body.data?.variants?.length) throw new Error('Product detail failed');
    let variant = prodDetail.body.data.variants.find((v) => v.stock_quantity > 0 && v.rental_stock_quantity > 0);
    if (!variant) {
      variant = prodDetail.body.data.variants[0];
      await pool.query('UPDATE product_variants SET stock_quantity = 5, rental_stock_quantity = 5 WHERE id = $1', [variant.id]);
      variant.stock_quantity = 5;
      variant.rental_stock_quantity = 5;
    }
    console.log('✓ Loaded product details with variants. Sample variant:', variant.sku, `Size: ${variant.size}`);

    console.log('\n--- 6. Rental Availability & Booking ---');
    const daysAhead = 60 + Math.floor(Math.random() * 200);
    const startDate = new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0];
    const endDate = new Date(Date.now() + (daysAhead + 2) * 86400000).toISOString().split('T')[0];

    const availRes = await request(`/rentals/check?productId=${sampleProduct.id}&variantId=${variant.id}&startDate=${startDate}&endDate=${endDate}`);
    if (availRes.status !== 200 || !availRes.body.data?.available) throw new Error('Rental availability failed');
    console.log('✓ Rental availability confirmed for 3 days:', `Rent: ₹${availRes.body.data.rentAmount}, Deposit: ₹${availRes.body.data.depositAmount}`);

    const rentalBookingRes = await request('/rentals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        productId: sampleProduct.id,
        variantId: variant.id,
        startDate,
        endDate,
        deliveryType: 'pickup',
      },
    });
    if (rentalBookingRes.status !== 201 || !rentalBookingRes.body.data?.booking_number) {
      throw new Error(`Rental booking failed: ${JSON.stringify(rentalBookingRes.body)}`);
    }
    const booking = rentalBookingRes.body.data;
    console.log('✓ Created rental booking:', booking.booking_number);

    console.log('\n--- 7. Coupon Validation & Order Creation with Stock Decrement ---');
    const couponRes = await request('/coupons/validate', {
      method: 'POST',
      body: { code: 'MAJESTIC10', cartTotal: 10000 },
    });
    if (couponRes.status !== 200 || couponRes.body.data?.discountAmount !== 1000) {
      throw new Error('Coupon validation failed');
    }
    console.log('✓ Coupon validated:', couponRes.body.data.code, `Discount: ₹${couponRes.body.data.discountAmount}`);

    const initialStock = Number(variant.stock_quantity);
    const orderRes = await request('/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        items: [{ variantId: variant.id, quantity: 1 }],
        addressId,
        discount: 500,
        notes: 'Please pack in luxury garment bag',
      },
    });
    if (orderRes.status !== 201 || !orderRes.body.data?.order_number) {
      throw new Error(`Order creation failed: ${JSON.stringify(orderRes.body)}`);
    }
    const order = orderRes.body.data;
    console.log('✓ Created purchase order:', order.order_number, `Total: ₹${order.total}`);

    // Verify stock decremented in PostgreSQL
    const { rows: updatedVariant } = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = $1', [variant.id]);
    if (Number(updatedVariant[0].stock_quantity) !== initialStock - 1) {
      throw new Error('Stock decrement check failed');
    }
    console.log('✓ Stock decremented correctly:', initialStock, '->', updatedVariant[0].stock_quantity);

    console.log('\n--- 8. Wishlist, Reviews & Contact Enquiries ---');
    await request('/wishlist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: { productId: sampleProduct.id },
    });
    const wishCheck = await request(`/wishlist/check/${sampleProduct.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (!wishCheck.body.data?.isWishlisted) throw new Error('Wishlist check failed');
    console.log('✓ Wishlist verified');

    const revRes = await request('/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        productId: sampleProduct.id,
        rating: 5,
        title: 'Outstanding craftsmanship',
        comment: 'The shoulders fit like Savile Row bespoke. Impeccable velvet.',
      },
    });
    if (revRes.status !== 201) throw new Error('Review submission failed');
    console.log('✓ Review submitted');

    const contactRes = await request('/contact', {
      method: 'POST',
      body: {
        name: 'VIP Customer',
        email: 'vip@client.com',
        phone: '9876543210',
        subject: 'Custom Tuxedo Fitting Inquiry',
        message: 'Looking to schedule an in-store private fitting this Saturday.',
      },
    });
    if (contactRes.status !== 201) throw new Error('Contact enquiry failed');
    console.log('✓ Contact enquiry submitted');

    console.log('\n--- 9. PDF Invoice Generation ---');
    // Find invoice for the order
    const { rows: invRows } = await pool.query('SELECT invoice_number FROM invoices WHERE order_id = $1 LIMIT 1', [order.id]);
    if (invRows.length) {
      const invNum = invRows[0].invoice_number;
      const pdfRes = await fetch(`${baseUrl}/invoices/${invNum}/pdf`);
      if (pdfRes.status !== 200 || !pdfRes.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('PDF invoice streaming failed');
      }
      const pdfBytes = await pdfRes.arrayBuffer();
      console.log('✓ Generated and streamed PDF invoice:', invNum, `(${pdfBytes.byteLength} bytes)`);
    }

    console.log('\n--- 10. Admin Analytics & Reporting ---');
    const analyticsRes = await request('/analytics/summary', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (analyticsRes.status !== 200 || analyticsRes.body.data?.totalOrders < 1) {
      throw new Error('Analytics overview failed');
    }
    console.log('✓ Analytics summary: Total Orders:', analyticsRes.body.data.totalOrders, '| Total Rentals:', analyticsRes.body.data.totalRentals, '| Total Revenue: ₹' + analyticsRes.body.data.totalRevenue);

    console.log('\n========================================');
    console.log('ALL FULL-STACK BACKEND MODULES OPERATIONAL');
    console.log('========================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
