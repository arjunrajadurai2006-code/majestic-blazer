import { api, tokenStore } from './api';

/**
 * Downloads the official PDF invoice for a given order/booking/invoice reference.
 * 
 * @param {Object} options
 * @param {string|number} options.identifier - Invoice number, order number, booking number, or invoice/order ID
 * @param {string} [options.orderNumber] - Optional order/booking number for the saved filename
 * @returns {Promise<{ fileName: string, blob: Blob }>}
 */
export async function downloadInvoicePdf({ identifier, orderNumber }) {
  if (!identifier) {
    throw new Error('No invoice or order reference provided.');
  }

  const token = tokenStore.get();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = api.getApiUrl(`/invoices/${encodeURIComponent(identifier)}/pdf`);

  let response;
  try {
    response = await fetch(url, { headers });
  } catch (netErr) {
    throw new Error(`Network error while downloading invoice: ${netErr.message}`);
  }

  if (!response.ok) {
    let message = `Invoice download failed (HTTP ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.message) {
        message = errJson.message;
      }
    } catch {
      // Non-JSON error body
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('Received an empty invoice file from server.');
  }

  const refName = orderNumber || identifier;
  const fileName = `Majestic-Blazer-Invoice-${refName}.pdf`;

  // Create downloadable anchor and trigger download
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoke object URL after browser starts download
  setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl);
  }, 2000);

  return { fileName, blob };
}
