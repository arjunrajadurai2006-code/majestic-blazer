import { useEffect, useState, useRef, useCallback } from 'react';
import { Printer, Download, X, Receipt } from 'lucide-react';
import { api } from '../services/api';
import styles from './ThermalReceiptModal.module.css';

export default function ThermalReceiptModal({ orderId, onClose, autoPrint = false, onPrintReady }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const receiptRef = useRef(null);
  const isPrintingRef = useRef(false);
  const autoPrintedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    autoPrintedRef.current = false;
    async function fetchThermalData() {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/invoices/${orderId}/thermal-data`);
        if (isMounted) {
          setData(res.data);
          if (onPrintReady) onPrintReady();
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to retrieve thermal receipt data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (orderId) {
      fetchThermalData();
    }

    return () => {
      isMounted = false;
    };
  }, [orderId, onPrintReady]);

  const triggerPrint = useCallback(async () => {
    if (isPrintingRef.current || loading || !data || !receiptRef.current) return;
    isPrintingRef.current = true;
    setPrinting(true);
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready.catch(() => {});
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      if (receiptRef.current) {
        window.print();
      }
    } catch (err) {
      setError(err.message || 'Unable to open browser print dialog.');
    } finally {
      isPrintingRef.current = false;
      setPrinting(false);
    }
  }, [loading, data]);

  // Reset print lock when browser print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      isPrintingRef.current = false;
      setPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      isPrintingRef.current = false;
    };
  }, []);

  // Auto-print once receipt DOM is committed when triggered from "Print Thermal Bill"
  useEffect(() => {
    if (autoPrint && !loading && data && !autoPrintedRef.current && receiptRef.current) {
      autoPrintedRef.current = true;
      triggerPrint();
    }
  }, [autoPrint, loading, data, triggerPrint]);

  // Support Ctrl + P / Cmd + P while modal is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        triggerPrint();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, triggerPrint]);

  const handlePrint = () => {
    triggerPrint();
  };

  const formatCurrency = (amt) =>
    `₹${Number(amt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <Receipt size={17} color="#b99a58" />
            <span>Thermal Receipt</span>
            <span className={styles.badge80mm}>80mm</span>
          </h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className={styles.actionBar}>
          <button
            type="button"
            className={styles.btnPrint}
            onClick={handlePrint}
            disabled={loading || !data || printing}
            title="Open Browser Print Dialog (Ctrl + P)"
          >
            <Printer size={15} />
            <span>{printing ? 'Preparing Print...' : 'Print Thermal Bill'}</span>
          </button>
          <a
            href={api.getApiUrl(`/invoices/${orderId}/thermal-pdf`)}
            target="_blank"
            rel="noreferrer"
            className={styles.btnDownload}
            title="Download 80mm PDF File"
          >
            <Download size={15} />
            <span>Download PDF</span>
          </a>
        </div>

        {/* Modal Content Body */}
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loadingBox}>Formatting 80mm thermal receipt...</div>
          ) : error ? (
            <div className={styles.errorBox}>{error}</div>
          ) : data ? (
            <div ref={receiptRef} className={styles.receiptContainer} id="thermal-receipt-container">
              {/* 1. BUSINESS HEADER */}
              <div className={styles.headerSection}>
                <div className={styles.brandName}>{data.business?.name || 'MAJESTIC BLAZER'}</div>
                <div className={styles.tagline}>{data.business?.tagline || 'STYLE THAT SPEAKS'}</div>
                <div className={styles.addressText}>{data.business?.address}</div>
                <div className={styles.contactText}>
                  Phone: {data.business?.phone} | {data.business?.email}
                </div>
              </div>

              <div className={styles.dashedDivider} />

              {/* 2. INVOICE META / BILL OF SUPPLY */}
              <div className={styles.metaSection}>
                <div className={styles.titleRow}>{data.invoice?.title || 'BILL OF SUPPLY'}</div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Invoice No:</span>
                  <span className={styles.metaValue}><strong>{data.invoice?.invoiceNumber}</strong></span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Order Ref:</span>
                  <span className={styles.metaValue}>#{data.invoice?.orderNumber}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Date:</span>
                  <span className={styles.metaValue}>{data.invoice?.date}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Customer:</span>
                  <span className={styles.metaValue}>{data.invoice?.customerName}</span>
                </div>
                {data.invoice?.customerPhone && data.invoice.customerPhone !== 'N/A' && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Phone:</span>
                    <span className={styles.metaValue}>{data.invoice?.customerPhone}</span>
                  </div>
                )}
              </div>

              <div className={styles.dashedDivider} />

              {/* 3. PRODUCT TABLE */}
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th className={styles.colNum}>#</th>
                    <th className={styles.colItem}>Item</th>
                    <th className={styles.colQty}>Qty</th>
                    <th className={styles.colRate}>Rate</th>
                    <th className={styles.colAmt}>Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className={styles.colNum}>{item.index || idx + 1}</td>
                      <td className={styles.colItem}>
                        {item.name}
                        {item.size && <span className={styles.itemVariant}>Size: {item.size}</span>}
                      </td>
                      <td className={styles.colQty}>{item.quantity}</td>
                      <td className={styles.colRate}>{Number(item.unitPrice).toFixed(2)}</td>
                      <td className={styles.colAmt}>{Number(item.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.dashedDivider} />

              {/* 4. PAYMENT SUMMARY */}
              <div className={styles.summarySection}>
                <div className={styles.summaryRow}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(data.financials?.subtotal)}</span>
                </div>
                {Number(data.financials?.discount || 0) > 0 && (
                  <div className={styles.summaryRow}>
                    <span>Discount:</span>
                    <span>- {formatCurrency(data.financials?.discount)}</span>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span>Taxable Amount:</span>
                  <span>{formatCurrency(data.financials?.taxableAmount)}</span>
                </div>
                {Number(data.financials?.tax || 0) > 0 && (
                  <div className={styles.summaryRow}>
                    <span>GST / Tax:</span>
                    <span>{formatCurrency(data.financials?.tax)}</span>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>TOTAL:</span>
                  <span>{formatCurrency(data.financials?.total)}</span>
                </div>
              </div>

              <div className={styles.dashedDivider} />

              {/* 5. PAYMENT BREAKDOWN */}
              <div className={styles.paymentBreakdown}>
                <div className={styles.receivedRow}>
                  <span>Amount Received:</span>
                  <span>{formatCurrency(data.financials?.amountReceived)}</span>
                </div>
                <div className={styles.balanceRow}>
                  <span>Balance Amount:</span>
                  <span className={styles.balanceHighlight}>
                    {formatCurrency(data.financials?.balanceAmount)}
                  </span>
                </div>
              </div>

              <div className={styles.dashedDivider} />

              {/* 6. TERMS AND CONDITIONS */}
              <div className={styles.termsSection}>
                <span className={styles.termsTitle}>Terms & Conditions:</span>
                <ul className={styles.termsList}>
                  {(data.terms || []).map((term, tIdx) => (
                    <li key={tIdx}>{term}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.dashedDivider} />

              {/* 7. FOOTER */}
              <div className={styles.footerSection}>
                <div className={styles.thankYouText}>{data.footer?.thankYou || 'Thank you for your purchase.'}</div>
                <div className={styles.taglineFooter}>{data.footer?.tagline || '*** STYLE THAT SPEAKS ***'}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
