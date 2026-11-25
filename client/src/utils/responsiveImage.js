/**
 * Generates responsive srcSet attributes for local static WebP assets under /assets/.
 * External URLs and uploaded media paths are left untouched.
 */
const RESPONSIVE_FOLDERS = ['/assets/products/', '/assets/collections/', '/assets/craftsmanship/', '/assets/editorial/', '/assets/brand/'];

export function getResponsiveWebpSrcSet(src) {
  if (!src || typeof src !== 'string') return undefined;
  if (!src.endsWith('.webp')) return undefined;
  const matchesFolder = RESPONSIVE_FOLDERS.some((prefix) => src.startsWith(prefix));
  if (!matchesFolder) return undefined;

  const base = src.slice(0, -5);
  return `${base}-480w.webp 480w, ${base}-800w.webp 800w, ${src} 1200w`;
}
