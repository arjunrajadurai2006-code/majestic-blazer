import PDFDocument from 'pdfkit';

export function generateInvoicePdf(invoiceData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const {
        invoiceNumber,
        issuedAt,
        orderOrBookingNumber,
        customer,
        items = [],
        financials = {},
        payment = {},
      } = invoiceData;

      // Header Banner
      doc.rect(40, 40, 515, 65).fill('#080808');

      // Title & Tagline
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('MAJESTIC BLAZER', 55, 52);
      doc.fillColor('#B99A58').font('Helvetica').fontSize(9).text('STYLE THAT SPEAKS', 56, 75);

      // Store Details (right aligned)
      doc.fillColor('#C0C0C0').font('Helvetica').fontSize(8);
      doc.text('Shop 99/6, 1st Flr, Opp Saravana Bhavan', 340, 50, { align: 'right', width: 200 });
      doc.text('Sathy Rd, Kurumbapalayam, Coimbatore - 641107', 340, 62, { align: 'right', width: 200 });
      doc.text('Phone: +91 8903238882', 340, 74, { align: 'right', width: 200 });
      doc.text('contact@majesticblazer.com', 340, 86, { align: 'right', width: 200 });

      // Invoice Meta Block
      doc.fillColor('#080808').font('Helvetica-Bold').fontSize(14).text('TAX INVOICE', 40, 125);
      doc.rect(40, 142, 515, 1).fill('#252525');

      const col1 = 40;
      const col2 = 320;
      let y = 155;

      doc.fillColor('#777777').font('Helvetica').fontSize(8);
      doc.text('INVOICE NUMBER', col1, y);
      doc.text('INVOICE DATE', col2, y);

      y += 12;
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10);
      doc.text(invoiceNumber || 'INV-0001', col1, y);
      doc.text(new Date(issuedAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), col2, y);

      y += 20;
      doc.fillColor('#777777').font('Helvetica').fontSize(8);
      doc.text('ORDER REFERENCE', col1, y);
      doc.text('PAYMENT STATUS', col2, y);

      y += 12;
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10);
      doc.text(orderOrBookingNumber || 'N/A', col1, y);
      doc.fillColor(payment.status === 'paid' ? '#1b7a2d' : '#8a6d1b').text((payment.status || 'PAID').toUpperCase(), col2, y);

      // Customer Details
      y += 25;
      doc.rect(40, y, 515, 60).fill('#F8F8F8');
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(8).text('BILLED TO', 52, y + 10);
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text(customer?.name || 'Valued Customer', 52, y + 22);
      doc.fillColor('#555555').font('Helvetica').fontSize(8.5);
      doc.text(`Email: ${customer?.email || 'N/A'} | Phone: ${customer?.phone || 'N/A'}`, 52, y + 36);
      if (customer?.address) {
        doc.text(`Address: ${customer.address}`, 52, y + 48, { width: 490 });
      }

      // Table Header
      y += 75;
      doc.rect(40, y, 515, 22).fill('#151515');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
      doc.text('ITEM DESCRIPTION', 50, y + 7);
      doc.text('SIZE / SKU', 280, y + 7);
      doc.text('QTY', 370, y + 7, { align: 'center', width: 30 });
      doc.text('UNIT PRICE', 410, y + 7, { align: 'right', width: 60 });
      doc.text('TOTAL', 480, y + 7, { align: 'right', width: 65 });

      y += 24;

      // Table rows
      doc.font('Helvetica').fontSize(8.5);
      for (const item of items) {
        doc.fillColor('#222222');
        doc.text(item.name || 'Majestic Blazer', 50, y + 6, { width: 220 });
        doc.fillColor('#666666');
        doc.text(`${item.size || 'Standard'} / ${item.sku || 'N/A'}`, 280, y + 6, { width: 85 });
        doc.text(String(item.quantity || 1), 370, y + 6, { align: 'center', width: 30 });
        doc.text(`₹${Number(item.unitPrice || 0).toLocaleString('en-IN')}`, 410, y + 6, { align: 'right', width: 60 });
        const lineTotal = Number(item.unitPrice || 0) * Number(item.quantity || 1);
        doc.fillColor('#111111').font('Helvetica-Bold');
        doc.text(`₹${lineTotal.toLocaleString('en-IN')}`, 480, y + 6, { align: 'right', width: 65 });
        doc.font('Helvetica');

        y += 24;
        doc.rect(40, y, 515, 0.5).fill('#EAEAEA');
      }

      y += 15;

      // Financials Summary (Right side)
      const sumX = 350;
      const valX = 475;
      const valW = 70;

      const printRow = (label, val, isBold = false, color = '#222222') => {
        doc.fillColor('#555555').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(label, sumX, y);
        doc.fillColor(color).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(isBold ? 10 : 8.5).text(val, valX, y, { align: 'right', width: valW });
        y += 16;
      };

      printRow('Subtotal:', `₹${Number(financials.subtotal || 0).toLocaleString('en-IN')}`);
      if (Number(financials.discount || 0) > 0) {
        printRow('Discount:', `-₹${Number(financials.discount).toLocaleString('en-IN')}`, false, '#b99a58');
      }

      if (Number(financials.tax || 0) > 0) {
        printRow('Taxes:', `₹${Number(financials.tax).toLocaleString('en-IN')}`);
      }
      if (Number(financials.shipping || 0) > 0) {
        printRow('Delivery Fee:', `₹${Number(financials.shipping).toLocaleString('en-IN')}`);
      } else {
        printRow('Delivery:', 'Complimentary', false, '#1b7a2d');
      }

      doc.rect(sumX, y, 205, 1).fill('#252525');
      y += 8;
      printRow('TOTAL PAYABLE:', `₹${Number(financials.total || 0).toLocaleString('en-IN')}`, true, '#080808');

      // Footer
      doc.rect(40, 750, 515, 1).fill('#C0C0C0');
      doc.fillColor('#888888').font('Helvetica').fontSize(7.5);
      doc.text('Thank you for choosing Majestic Blazer. Style That Speaks.', 40, 760, { align: 'center', width: 515 });
      doc.text('For queries or support, reach out to support@majesticblazer.com or call +91 8903238882.', 40, 772, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

