import { pool } from '../config/db.js';
import * as Order from '../models/orderModel.js';
import * as Rental from '../models/rentalModel.js';
import { generateInvoicePdf } from '../utils/pdfInvoice.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const getByNumberOrId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);
  const sql = isNumeric
    ? 'SELECT * FROM invoices WHERE id = $1 LIMIT 1'
    : 'SELECT * FROM invoices WHERE invoice_number = $1 LIMIT 1';
  const { rows } = await pool.query(sql, [id]);
  const invoice = rows[0];
  if (!invoice) throw new AppError('Invoice not found', 404);
  res.json({ success: true, data: invoice });
});

export const downloadPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);
  const sql = isNumeric
    ? 'SELECT * FROM invoices WHERE id = $1 LIMIT 1'
    : 'SELECT * FROM invoices WHERE invoice_number = $1 LIMIT 1';
  const { rows } = await pool.query(sql, [id]);
  const invoice = rows[0];
  if (!invoice) throw new AppError('Invoice not found', 404);

  let invoicePayload;

  if (invoice.order_id) {
    const order = await Order.getById(invoice.order_id);
    if (!order) throw new AppError('Associated order not found', 404);
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
  } else if (invoice.rental_booking_id) {
    const rental = await Rental.getById(invoice.rental_booking_id);
    if (!rental) throw new AppError('Associated rental not found', 404);
    invoicePayload = {
      invoiceNumber: invoice.invoice_number,
      issuedAt: invoice.issued_at,
      type: 'rental',
      orderOrBookingNumber: rental.booking_number,
      customer: {
        name: rental.customer_name,
        email: rental.customer_email,
        phone: rental.customer_phone,
        address: rental.shipping_address || 'Store Collection (Kurumbampalayam, Coimbatore)',
      },
      items: [
        {
          name: `${rental.product_name} (${rental.color || 'Tailored'})`,
          size: rental.size,
          sku: rental.sku,
          quantity: 1,
          unitPrice: rental.rent_amount,
        },
      ],
      rentalDetails: {
        rentalDays: rental.rental_days,
        startDate: rental.start_date,
        endDate: rental.end_date,
      },
      financials: {
        rentAmount: rental.rent_amount,
        depositAmount: rental.deposit_amount,
        total: Number(rental.rent_amount) + Number(rental.deposit_amount),
      },
      payment: {
        status: rental.status === 'cancelled' ? 'cancelled' : 'paid',
      },
    };
  } else {
    throw new AppError('Invoice has no associated order or booking', 400);
  }

  const pdfBuffer = await generateInvoicePdf(invoicePayload);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
  res.send(pdfBuffer);
});

export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const countRes = await pool.query('SELECT COUNT(*) AS total FROM invoices');
  const total = Number(countRes.rows[0]?.total || 0);

  const { rows: items } = await pool.query(
    `SELECT i.*, o.order_number, rb.booking_number,
       COALESCE(u1.full_name, u2.full_name) AS customer_name
     FROM invoices i
     LEFT JOIN orders o ON o.id = i.order_id
     LEFT JOIN rental_bookings rb ON rb.id = i.rental_booking_id
     LEFT JOIN users u1 ON u1.id = o.user_id
     LEFT JOIN users u2 ON u2.id = rb.user_id
     ORDER BY i.issued_at DESC
     LIMIT $1 OFFSET $2`,
    [Number(limit), offset]
  );

  res.json({ success: true, data: items, meta: { total } });
});
