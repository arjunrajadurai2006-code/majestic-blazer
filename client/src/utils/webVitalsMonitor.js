/**
 * Lightweight zero-dependency Core Web Vitals field observer (RUM).
 * Uses native PerformanceObserver for FCP, LCP, session-windowed CLS,
 * and p98 interaction-grouped INP.
 *
 * Note: Requires VITE_RUM_ENDPOINT to be configured with a receiving backend
 * endpoint. When unset, no network beacons are dispatched.
 */
export function initWebVitalsMonitor() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  const pageId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let fcp = null;
  let lcp = null;

  // Session-windowed CLS state (max 1s gap, max 5s window)
  let clsMax = 0;
  let sessionValue = 0;
  let sessionFirstTs = null;
  let sessionLastTs = 0;

  // INP state: map interactionId -> max duration for that interaction
  const interactions = new Map();
  const MAX_INTERACTIONS_TRACKED = 500;

  const observers = [];
  const observe = (type, opts, handler) => {
    try {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
      const po = new PerformanceObserver((list) => handler(list.getEntries()));
      po.observe({ type, buffered: true, ...opts });
      observers.push(po);
    } catch {
      // Ignore unsupported observer types
    }
  };

  observe('paint', {}, (entries) => {
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        fcp = Math.round(entry.startTime);
      }
    }
  });

  observe('largest-contentful-paint', {}, (entries) => {
    const last = entries[entries.length - 1];
    if (last) lcp = Math.round(last.startTime);
  });

  observe('layout-shift', {}, (entries) => {
    for (const entry of entries) {
      if (entry.hadRecentInput) continue;
      const ts = entry.startTime;
      if (
        sessionFirstTs !== null &&
        ts - sessionLastTs < 1000 &&
        ts - sessionFirstTs < 5000
      ) {
        sessionValue += entry.value;
        sessionLastTs = ts;
      } else {
        sessionValue = entry.value;
        sessionFirstTs = ts;
        sessionLastTs = ts;
      }
      if (sessionValue > clsMax) {
        clsMax = Number(sessionValue.toFixed(4));
      }
    }
  });

  observe('event', { durationThreshold: 16 }, (entries) => {
    for (const entry of entries) {
      if (!entry.interactionId) continue;
      const prev = interactions.get(entry.interactionId) || 0;
      if (entry.duration > prev) {
        if (interactions.size >= MAX_INTERACTIONS_TRACKED && !interactions.has(entry.interactionId)) {
          const oldestKey = interactions.keys().next().value;
          interactions.delete(oldestKey);
        }
        interactions.set(entry.interactionId, entry.duration);
      }
    }
  });

  const getTotalInteractionCount = () => {
    if (typeof performance !== 'undefined' && typeof performance.interactionCount === 'number') {
      return Math.max(interactions.size, performance.interactionCount);
    }
    return interactions.size;
  };

  const computeInp = () => {
    if (interactions.size === 0) return null;
    // Descending order: sorted[0] is the longest interaction
    const sorted = Array.from(interactions.values()).sort((a, b) => b - a);
    const totalCount = getTotalInteractionCount();
    // p98 methodology: ignore 1 outlier per 50 interactions (capped at top 10, clamped to available entries)
    const idx = Math.min(sorted.length - 1, Math.min(9, Math.floor(totalCount / 50)));
    return Math.round(sorted[idx]);
  };

  const reportUrl = (import.meta.env.VITE_RUM_ENDPOINT || '').trim();
  let flushed = false;

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };

  const flush = () => {
    if (flushed) return;
    flushed = true;

    document.removeEventListener('visibilitychange', onVisibilityChange);
    for (const po of observers) {
      try {
        po.disconnect();
      } catch {
        // Ignore
      }
    }

    if (!reportUrl || typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return;
    }

    const payload = JSON.stringify({
      pageId,
      path: window.location.pathname,
      fcp,
      lcp,
      cls: clsMax,
      inp: computeInp(),
      interactionCount: getTotalInteractionCount(),
      ts: Date.now(),
    });

    navigator.sendBeacon(reportUrl, new Blob([payload], { type: 'application/json' }));
  };

  document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
  window.addEventListener('pagehide', flush, { once: true, passive: true });
}
