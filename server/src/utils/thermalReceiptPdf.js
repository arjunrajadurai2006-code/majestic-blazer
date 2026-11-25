import PDFDocument from 'pdfkit';

/**
 * Calculates the exact height required for an 80mm thermal receipt
 * so that the PDF is rendered as a single continuous roll with zero blank space.
 * 
 * @param {Object} data 
 * @returns {number} Height in points (72 points/inch)
 */
export function calculateThermalReceiptHeight(data) {
  let h = 18; // Top margin

  // Business Header
  h += 15; // Brand Name
  h += 10; // Tagline
  h += 18; // Address (2 lines)
  h += 11; // Phone & Email
  h += 10; // Dotted line

  // Invoice / Bill of Supply Meta
  h += 13; // BILL OF SUPPLY
  h += 11; // Invoice No
  h += 11; // Order Ref
  h += 11; // Date
  h += 11; // Customer Name
  if (data.invoice?.customerPhone && data.invoice.customerPhone !== 'N/A') {
    h += 11; // Customer Phone
  }
  h += 10; // Dotted line

  // Product Table Header
  h += 13; // Table Header (# Item Qty Rate Amt)
  h += 8;  // Table separator

  // Items
  const items = data.items || [];
  for (const item of items) {
    const itemName = item.name || 'Majestic Blazer';
    const variantInfo = item.size ? ` (${item.size})` : '';
    const fullTitle = `${itemName}${variantInfo}`;
    // Approximate lines needed for width ~100pt at font size 7pt
    const estimatedLines = Math.max(1, Math.ceil(fullTitle.length / 22));
    h += (estimatedLines * 9) + 4;
  }
  h += 10; // Dotted line

  // Financials
  h += 11; // Subtotal
  if (Number(data.financials?.discount || 0) > 0) {
    h += 11; // Discount
  }
  h += 11; // Taxable Amount
  if (Number(data.financials?.tax || 0) > 0) {
    h += 11; // GST / Tax
  }
  h += 15; // TOTAL (Grand Total)
  h += 10; // Dotted line

  // Payment Breakdown
  h += 11; // Amount Received
  h += 13; // Balance Amount
  h += 10; // Dotted line

  // Terms and Conditions
  h += 11; // Terms Title
  const terms = data.terms || [];
  for (const term of terms) {
    const termLines = Math.max(1, Math.ceil(term.length / 42));
    h += (termLines * 8.5) + 2;
  }
  h += 10; // Dotted line

  // Footer
  h += 12; // Thank you message
  h += 11; // Tagline / sign-off
  h += 20; // Bottom margin

  // Minimum safety height
  return Math.max(380, Math.ceil(h));
}

/**
 * Generates an 80mm Thermal Receipt PDF buffer using PDFKit.
 * 
 * @param {Object} data - Structured receipt payload
 * @returns {Promise<Buffer>}
 */
export function generateThermalReceiptPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const receiptWidth = 226.77; // 80mm in points
      const leftMargin = 10;
      const rightMargin = 10;
      const printableWidth = receiptWidth - leftMargin - rightMargin; // 206.77 pt

      const pageHeight = calculateThermalReceiptHeight(data);

      const doc = new PDFDocument({
        size: [receiptWidth, pageHeight],
        margin: leftMargin,
        autoFirstPage: true,
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const {
        business = {},
        invoice = {},
        items = [],
        financials = {},
        terms = [],
        footer = {},
      } = data;

      let y = 14;

      // Helper: draw clean dotted line across printable width
      const drawDottedLine = () => {
        doc.dash(2, { space: 2 })
          .lineWidth(0.6)
          .strokeColor('#222222')
          .moveTo(leftMargin, y + 4)
          .lineTo(receiptWidth - rightMargin, y + 4)
          .stroke();
        doc.undash();
        y += 9;
      };

      // Helper: print centered line
      const printCenter = (text, fontSize = 7.5, isBold = false) => {
        doc.fillColor('#000000')
          .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(fontSize)
          .text(text, leftMargin, y, { align: 'center', width: printableWidth });
        y = doc.y;
      };

      // Helper: print key-value row
      const printRow = (label, value, isBold = false, fontSize = 7.5, valColor = '#000000') => {
        doc.fillColor('#000000')
          .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(fontSize)
          .text(label, leftMargin, y, { width: 110, align: 'left' });

        doc.fillColor(valColor)
          .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(fontSize)
          .text(value, leftMargin + 100, y, { width: printableWidth - 100, align: 'right' });

        y += fontSize + 3.5;
      };

      // 1. BUSINESS HEADER
      printCenter(business.name || 'MAJESTIC BLAZER', 11, true);
      y += 1;
      printCenter(business.tagline || 'STYLE THAT SPEAKS', 6.5, false);
      y += 2;
      printCenter(business.address || 'Sathy Road, Kurumbampalayam, Coimbatore - 641107', 6.5, false);
      printCenter(`Phone: ${business.phone || '+91 8903238882'} | ${business.email || 'contact@majesticblazer.com'}`, 6.5, false);

      drawDottedLine();

      // 2. INVOICE META / BILL OF SUPPLY
      printCenter(invoice.title || 'BILL OF SUPPLY', 8.5, true);
      y += 3;

      printRow('Invoice No:', invoice.invoiceNumber || 'INV-0001', true, 7.5);
      printRow('Order Ref:', invoice.orderNumber || 'N/A', false, 7);
      printRow('Date:', invoice.date || new Date().toLocaleString('en-IN'), false, 7);
      printRow('Customer:', invoice.customerName || 'Valued Patron', true, 7.5);
      if (invoice.customerPhone && invoice.customerPhone !== 'N/A') {
        printRow('Phone:', invoice.customerPhone, false, 7);
      }

      drawDottedLine();

      // 3. PRODUCT TABLE HEADER
      const colX = {
        num: leftMargin,           // width ~12
        item: leftMargin + 13,     // width ~95
        qty: leftMargin + 110,     // width ~20
        rate: leftMargin + 132,    // width ~34
        amt: leftMargin + 168,     // width ~38
      };

      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7);
      doc.text('#', colX.num, y, { width: 12, align: 'left' });
      doc.text('Item', colX.item, y, { width: 95, align: 'left' });
      doc.text('Qty', colX.qty, y, { width: 20, align: 'center' });
      doc.text('Rate', colX.rate, y, { width: 34, align: 'right' });
      doc.text('Amt', colX.amt, y, { width: 38, align: 'right' });
      y += 10;

      // Thin separator under header
      doc.dash(1, { space: 1.5 })
        .lineWidth(0.5)
        .strokeColor('#555555')
        .moveTo(leftMargin, y + 1)
        .lineTo(receiptWidth - rightMargin, y + 1)
        .stroke();
      doc.undash();
      y += 5;

      // 4. PRODUCT ITEMS
      doc.font('Helvetica').fontSize(6.8);
      items.forEach((item, idx) => {
        const itemNumber = String(item.index || idx + 1);
        const itemName = item.name || 'Tailored Garment';
        const itemSize = item.size ? ` (${item.size})` : '';
        const itemLabel = `${itemName}${itemSize}`;
        const qty = String(item.quantity || 1);
        const rate = Number(item.unitPrice || 0).toFixed(2);
        const amt = Number(item.lineTotal || 0).toFixed(2);

        const rowStartY = y;

        // Print #
        doc.fillColor('#000000').font('Helvetica').fontSize(6.8);
        doc.text(itemNumber, colX.num, rowStartY, { width: 12, align: 'left' });

        // Print Item Name with clean line wrapping
        doc.text(itemLabel, colX.item, rowStartY, { width: 94, align: 'left' });
        const textEndY = doc.y;

        // Print Qty, Rate, Amt aligned to top of row
        doc.text(qty, colX.qty, rowStartY, { width: 20, align: 'center' });
        doc.text(rate, colX.rate, rowStartY, { width: 34, align: 'right' });
        doc.font('Helvetica-Bold');
        doc.text(amt, colX.amt, rowStartY, { width: 38, align: 'right' });

        y = Math.max(textEndY, rowStartY + 10) + 2.5;
      });

      drawDottedLine();

      // 5. PAYMENT SUMMARY / FINANCIALS
      const fmt = (num) => `Rs. ${Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      printRow('Subtotal:', fmt(financials.subtotal), false, 7.5);

      if (Number(financials.discount || 0) > 0) {
        printRow('Discount:', `-${fmt(financials.discount)}`, false, 7.5);
      }

      printRow('Taxable Amount:', fmt(financials.taxableAmount), false, 7.5);

      if (Number(financials.tax || 0) > 0) {
        printRow('GST / Tax:', fmt(financials.tax), false, 7.5);
      }

      y += 2;
      printRow('TOTAL:', fmt(financials.total), true, 9);
      y += 2;

      drawDottedLine();

      // 6. RECEIVED & BALANCE BREAKDOWN
      const amountReceived = Number(financials.amountReceived || 0);
      const balanceAmount = Number(financials.balanceAmount || 0);

      printRow('Amount Received:', fmt(amountReceived), true, 8, amountReceived > 0 ? '#000000' : '#444444');
      printRow('Balance Amount:', fmt(balanceAmount), true, 8.5, balanceAmount > 0 ? '#990000' : '#000000');

      drawDottedLine();

      // 7. TERMS & CONDITIONS
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(6.5);
      doc.text('TERMS & CONDITIONS:', leftMargin, y, { width: printableWidth, align: 'left' });
      y += 9;

      doc.font('Helvetica').fontSize(6);
      for (const t of terms) {
        doc.text(t, leftMargin, y, { width: printableWidth, align: 'left' });
        y = doc.y + 1.5;
      }

      drawDottedLine();

      // 8. FOOTER
      printCenter(footer.thankYou || 'Thank you for your purchase.', 7.5, true);
      y += 1;
      printCenter(footer.tagline || '*** STYLE THAT SPEAKS ***', 6.5, false);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
