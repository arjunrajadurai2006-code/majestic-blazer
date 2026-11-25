import { useEffect } from 'react';

export const SITE_URL = 'https://majestic-blazer-id.vercel.app';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/hero/luxury-menswear-hero.webp`;

function setMeta(attrName, attrValue, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function toAbsoluteUrl(urlOrPath) {
  if (!urlOrPath) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  const clean = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  return `${SITE_URL}${clean}`;
}

export function useDocumentSeo({
  title,
  description,
  path = '/',
  type = 'website',
  image,
  noindex = false,
  jsonLd = null,
}) {
  const jsonLdString = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const cleanPath = path === '/' ? '/' : path.replace(/\/+$/, '');
    const canonicalUrl = `${SITE_URL}${cleanPath}`;
    const ogImage = toAbsoluteUrl(image || DEFAULT_OG_IMAGE);

    if (title) document.title = title;
    if (description) setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(canonicalUrl);

    setMeta('property', 'og:title', title);
    if (description) setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:site_name', 'Majestic Blazer');

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    if (description) setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);

    let scriptEl = document.getElementById('mb-route-jsonld');
    if (jsonLdString) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'mb-route-jsonld';
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = jsonLdString;
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      const existing = document.getElementById('mb-route-jsonld');
      if (existing) existing.remove();
    };
  }, [title, description, path, type, image, noindex, jsonLdString]);
}
