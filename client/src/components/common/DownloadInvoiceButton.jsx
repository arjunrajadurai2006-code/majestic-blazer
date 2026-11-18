import { useState, useRef, useEffect } from 'react';
import { Download, Check, Loader2, AlertCircle, FileText } from 'lucide-react';
import { downloadInvoicePdf } from '../../services/invoiceService';
import { useToast } from '../../context/ToastContext';
import styles from './DownloadInvoiceButton.module.css';

/**
 * Professional e-commerce invoice download button.
 * 
 * @param {Object} props
 * @param {string|number} props.invoiceIdentifier - Invoice number, order number, booking number, or invoice ID
 * @param {string} [props.orderNumber] - Associated human-readable order or booking number
 * @param {string} [props.label] - Custom button label
 * @param {'primary'|'outline'} [props.variant='outline'] - Visual button styling
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Button height/sizing
 * @param {string} [props.className] - Additional CSS class names
 * @param {Function} [props.onSuccess] - Optional callback fired on successful download
 * @param {Function} [props.onError] - Optional callback fired on failed download
 */
export default function DownloadInvoiceButton({
  invoiceIdentifier,
  orderNumber,
  invoiceType,
  label = 'Download Invoice (PDF)',
  variant = 'outline',
  size = 'md',
  className = '',
  onSuccess,
  onError,
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const toast = useToast();
  const resetTimerRef = useRef(null);

  // Clean up any pending reset timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent repeated clicks or duplicate requests
    if (status === 'loading') return;

    setStatus('loading');

    try {
      const ref = invoiceIdentifier || orderNumber;
      if (!ref) {
        throw new Error('Order or invoice reference is missing.');
      }

      const result = await downloadInvoicePdf({
        identifier: ref,
        orderNumber: orderNumber || String(ref),
        invoiceType: invoiceType || (label?.toLowerCase().includes('rental') ? 'rental' : 'purchase'),
      });

      setStatus('success');
      toast.success?.(`Official invoice for ${orderNumber || ref} downloaded successfully.`);
      if (onSuccess) onSuccess(result);

      // Restore button back to idle after 2.5s
      resetTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, 2500);
    } catch (err) {
      console.error('Invoice download error:', err);
      setStatus('error');
      const errorMsg = err?.message || 'Unable to download invoice. Please try again.';
      toast.error?.(errorMsg);
      if (onError) onError(err);

      // Restore button back to idle after 3s to allow retry
      resetTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };

  const getVariantClass = () => {
    if (variant === 'primary') return styles.variantPrimary;
    return styles.variantOutline;
  };

  const getSizeClass = () => {
    if (size === 'sm') return styles.sizeSm;
    if (size === 'lg') return styles.sizeLg;
    return styles.sizeMd;
  };

  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 17 : 15;

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={status === 'loading'}
      aria-busy={status === 'loading'}
      aria-label={`${label} for order ${orderNumber || invoiceIdentifier || ''}`}
      title={status === 'loading' ? 'Preparing your invoice PDF...' : label}
      className={`
        ${styles.button}
        ${getVariantClass()}
        ${getSizeClass()}
        ${status === 'loading' ? styles.loading : ''}
        ${status === 'success' ? styles.success : ''}
        ${status === 'error' ? styles.error : ''}
        ${className}
      `.trim()}
    >
      <span className={styles.iconWrap}>
        {status === 'loading' && <Loader2 size={iconSize} className={styles.spinner} />}
        {status === 'success' && <Check size={iconSize} className={styles.successIcon} />}
        {status === 'error' && <AlertCircle size={iconSize} className={styles.errorIcon} />}
        {status === 'idle' && <Download size={iconSize} />}
      </span>

      <span className={styles.label}>
        {status === 'loading' && 'Preparing PDF...'}
        {status === 'success' && 'Downloaded'}
        {status === 'error' && 'Retry Download'}
        {status === 'idle' && label}
      </span>
    </button>
  );
}
