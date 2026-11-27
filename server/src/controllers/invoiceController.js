import { pool } from '../config/db.js';
import * as Order from '../models/orderModel.js';
import { generateInvoicePdf } from '../utils/pdfInvoice.js';
import { generateThermalReceiptPdf } from '../utils/thermalReceiptPdf.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const getByNumberOrId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);
  const sql = isNumeric
    ? `SELECT i.*, 
              o.user_id,
              o.order_number
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.id = $1 OR i.order_id = $1
       ORDER BY (CASE WHEN i.id = $1 THEN 0 ELSE 1 END), i.id DESC 
       LIMIT 1`
    : `SELECT i.*, 
              o.user_id,
              o.order_number
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.invoice_number = $1 OR o.order_number = $1
       ORDER BY (CASE WHEN i.invoice_number = $1 THEN 0 ELSE 1 END), i.id DESC 
       LIMIT 1`;
  const { rows } = await pool.query(sql, [id]);
  const invoice = rows[0];
  if (!invoice) throw new AppError('Invoice not found', 404);

  const isOwner = Number(invoice.user_id) === Number(req.user?.id);
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && !isOwner) {
    throw new AppError('You do not have permission to access this invoice', 403);
  }

  res.json({ success: true, data: invoice });
});

export const downloadPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);
  const sql = isNumeric
    ? `SELECT i.*, 
              o.user_id,
              o.order_number
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.id = $1 OR i.order_id = $1
       ORDER BY (CASE WHEN i.id = $1 THEN 0 ELSE 1 END), i.id DESC 
       LIMIT 1`
    : `SELECT i.*, 
              o.user_id,
              o.order_number
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.invoice_number = $1 OR o.order_number = $1
       ORDER BY (CASE WHEN i.invoice_number = $1 THEN 0 ELSE 1 END), i.id DESC 
       LIMIT 1`;
  const { rows } = await pool.query(sql, [id]);
  const invoice = rows[0];
  if (!invoice) throw new AppError('Invoice not found', 404);

  const isOwner = Number(invoice.user_id) === Number(req.user?.id);
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && !isOwner) {
    throw new AppError('You do not have permission to access this invoice', 403);
  }

  let invoicePayload;

  if (invoice.order_id) {
    const order = await Order.getById(invoice.order_id, isAdmin ? null : req.user.id);
    if (!order) throw new AppError('Associated order not found', 404);
    if (!isAdmin && Number(order.user_id) !== Number(req.user.id)) {
      throw new AppError('You do not have permission to access this invoice', 403);
    }
    invoicePayload = {
      invoiceNumber: invoice.invoice_number,
      issuedAt: invoice.issued_at,
      type: 'purchase',
      orderOrBookingNumber: order.order_number,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
        address: order.shipping_address || (order.line1 ? `${order.line1}, ${order.city}, ${order.state} - ${order.pincode}` : 'Store Pickup'),
      },
      items: (order.items || []).map((it) => ({
        name: it.productName,
        size: it.size,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
      financials: {
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        shipping: order.shipping,
        total: order.total,
      },
      payment: {
        status: order.status === 'cancelled' ? 'cancelled' : 'paid',
      },
    };
  } else {
    // Legacy invoice record without direct order_id pointer
    invoicePayload = {
      invoiceNumber: invoice.invoice_number,
      issuedAt: invoice.issued_at,
      type: 'purchase',
      orderOrBookingNumber: invoice.invoice_number,
      customer: {
        name: 'Patron',
        email: '',
        phone: '',
        address: 'Atelier Archive',
      },
      items: [],
      financials: {
        subtotal: invoice.amount || 0,
        discount: 0,
        tax: 0,
        shipping: 0,
        total: invoice.amount || 0,
      },
      payment: {
        status: 'paid',
      },
    };
  }

  const pdfBuffer = await generateInvoicePdf(invoicePayload);
  const refNumber = invoicePayload?.orderOrBookingNumber || invoice.invoice_number;
  const filename = `Majestic-Blazer-Invoice-${refNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(pdfBuffer);
});

export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const countRes = await pool.query('SELECT COUNT(*) AS total FROM invoices');
  const total = Number(countRes.rows[0]?.total || 0);

  const { rows: items } = await pool.query(
    `SELECT i.*, o.order_number,
       u.full_name AS customer_name
     FROM invoices i
     LEFT JOIN orders o ON o.id = i.order_id
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY i.issued_at DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  res.json({ success: true, data: items, meta: { total } });
});

/**
 * Prepares the complete thermal receipt billing payload for an order or invoice.
 * Reuses existing invoice numbers and calculates actual payment and balance states.
 * 
 * @param {string|number} id - Order ID, Order Number, Invoice ID, or Invoice Number
 * @returns {Promise<Object>}
 */
export async function getThermalReceiptData(id) {
  const isNumeric = /^\d+$/.test(String(id || '').trim());
  let orderId = null;

  // 1. Prioritize direct Order lookup (since Admin Orders page passes order.id or order_number)
  if (isNumeric) {
    const { rows: ordRows } = await pool.query(
      'SELECT id FROM orders WHERE id = $1 LIMIT 1',
      [parseInt(id, 10)]
    );
    if (ordRows.length > 0) {
      orderId = ordRows[0].id;
    }
  } else {
    const { rows: ordRows } = await pool.query(
      'SELECT id FROM orders WHERE order_number = $1 LIMIT 1',
      [String(id).trim()]
    );
    if (ordRows.length > 0) {
      orderId = ordRows[0].id;
    }
  }

  // 2. If not found by direct order ID/number, check invoices table (for Invoice Archive lookups)
  if (!orderId) {
    const invoiceSql = isNumeric
      ? 'SELECT order_id FROM invoices WHERE id = $1 OR order_id = $1 ORDER BY id DESC LIMIT 1'
      : 'SELECT order_id FROM invoices WHERE invoice_number = $1 ORDER BY id DESC LIMIT 1';
    const { rows: invRows } = await pool.query(invoiceSql, [id]);
    if (invRows.length > 0 && invRows[0].order_id) {
      orderId = invRows[0].order_id;
    }
  }

  if (!orderId) {
    throw new AppError('Order or invoice not found', 404);
  }

  const order = await Order.getById(orderId);
  if (!order) {
    throw new AppError('Order record not found', 404);
  }

  // 3. Ensure a persistent, unique invoice number without duplicates
  let invoiceNumber = order.invoice_number;
  if (!invoiceNumber) {
    const existingInv = await pool.query(
      'SELECT invoice_number FROM invoices WHERE order_id = $1 ORDER BY id DESC LIMIT 1',
      [order.id]
    );
    if (existingInv.rows.length > 0) {
      invoiceNumber = existingInv.rows[0].invoice_number;
    } else {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${randomSuffix}`;
      await pool.query(
        `INSERT INTO invoices (invoice_number, order_id, amount, invoice_data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (invoice_number) DO NOTHING`,
        [
          invoiceNumber,
          order.id,
          order.total,
          JSON.stringify({
            orderNumber: order.order_number,
            customerName: order.customer_name,
            total: order.total,
          }),
        ]
      );
    }
  }

  // 4. Retrieve real payment records to compute accurate Received and Outstanding Balance
  const { rows: payments } = await pool.query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY id ASC',
    [order.id]
  );

  const total = Number(order.total || 0);
  const subtotal = Number(order.subtotal || order.subtotal_amount || total);
  const discount = Number(order.discount || order.discount_amount || 0);
  const tax = Number(order.tax || order.tax_amount || 0);
  const taxableAmount = Math.max(0, subtotal - discount);

  // Calculate actual paid payments sum (only status = 'paid' counts as received)
  const paidPayments = payments.filter((p) => p.status === 'paid');
  const paidSum = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  let amountReceived = paidSum;
  let balanceAmount = Math.max(0, total - amountReceived);

  // If order was fully paid, ensure balance is exactly 0
  if (amountReceived >= total && total > 0) {
    balanceAmount = 0;
  }

  // 5. Structure line items with full names, quantities, and decimal-safe rates
  const items = (order.items || []).map((it, idx) => {
    const qty = Number(it.quantity || 1);
    const unitPrice = Number(it.unitPrice || it.unit_price || 0);
    return {
      index: idx + 1,
      name: it.productName || it.product_name || 'Tailored Blazer',
      size: it.size || '',
      sku: it.sku || '',
      quantity: qty,
      unitPrice,
      lineTotal: qty * unitPrice,
    };
  });

  return {
    business: {
      name: 'MAJESTIC BLAZER',
      tagline: 'STYLE THAT SPEAKS',
      address: 'Majestic Blazer Shop – First Floor, Shop No. 99/6, Sathy Rd, Opp. to Saravana Bhavan Hotel, Kurumbapalayam, Coimbatore - 641107',
      phone: '+91 8903238882',
      email: 'contact@majesticblazer.com',
    },
    invoice: {
      title: 'BILL OF SUPPLY',
      invoiceNumber,
      orderNumber: order.order_number,
      orderId: order.id,
      date: new Date(order.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      customerName: order.shipping_name || order.customer_name || 'Valued Patron',
      customerPhone: order.shipping_phone || order.customer_phone || 'N/A',
      customerEmail: order.customer_email || '',
    },
    items,
    financials: {
      subtotal,
      discount,
      taxableAmount,
      tax,
      total,
      amountReceived,
      balanceAmount,
    },
    paymentInfo: {
      provider: payments[0]?.provider || order.payment?.provider || 'N/A',
      status: payments[0]?.status || order.payment?.status || 'pending',
    },
    terms: [
      '1. Goods once sold will not be taken back or exchanged.',
      '2. All disputes are subject to Coimbatore jurisdiction only.',
    ],
    footer: {
      thankYou: 'Thank you for your purchase.',
      tagline: '*** STYLE THAT SPEAKS ***',
    },
  };
}

/**
 * Controller: Get JSON structured thermal bill data
 * GET /api/invoices/:id/thermal-data
 */
export const getThermalData = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const receiptData = await getThermalReceiptData(id);
  res.json({ success: true, data: receiptData });
});

/**
 * Controller: Download 80mm Thermal Receipt PDF
 * GET /api/invoices/:id/thermal-pdf
 */
export const downloadThermalPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const receiptData = await getThermalReceiptData(id);
  const pdfBuffer = await generateThermalReceiptPdf(receiptData);

  const filename = `Majestic-Blazer-Thermal-${receiptData.invoice.invoiceNumber || id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(pdfBuffer);
});
