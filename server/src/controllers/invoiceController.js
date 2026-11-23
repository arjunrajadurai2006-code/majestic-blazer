import { pool } from '../config/db.js';
import * as Order from '../models/orderModel.js';
import { generateInvoicePdf } from '../utils/pdfInvoice.js';
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
