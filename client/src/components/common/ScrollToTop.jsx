/**
 * ScrollToTop
 *
 * Provides intelligent route scroll management across all customer routes:
 * 1. PUSH / REPLACE navigation (navbar links, product cards, buttons, programmatic):
 *    Automatically scrolls to top (0, 0) instantly so new routes always begin at the top.
 *    If a hash target is present (e.g. #rental-policy), scrolls to the target anchor.
 * 2. POP navigation (browser Back / Forward buttons, in-app BackButton):
 *    Does NOT clobber the scroll position. Restores the sensible previously saved scroll position
 *    for that history entry.
 * 3. Page Refresh:
 *    Preserves native scroll position without layout or scroll errors.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'mb_scroll_positions';

function getStoredPositions() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistPosition(key, x, y) {
  try {
    const positions = getStoredPositions();
    positions[key] = { x, y };
    const keys = Object.keys(positions);
    if (keys.length > 50) {
      delete positions[keys[0]];
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {}
}

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // In-memory cache for fast lookup during the current session
  const positionsMap = useRef(new Map());
  const isFirstMount = useRef(true);
  const currentKeyRef = useRef(location.key);

  // Set manual scroll restoration on mount so browser doesn't flash or fight React
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Update current key reference synchronously on render
  currentKeyRef.current = location.key;

  // Continuously record scroll position for the current history entry
  useEffect(() => {
    const handleScroll = () => {
      const x = window.scrollX;
      const y = window.scrollY;
      const key = currentKeyRef.current;
      if (key) {
        positionsMap.current.set(key, { x, y });
        persistPosition(key, x, y);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleScroll, { passive: true });
    window.addEventListener('pagehide', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleScroll);
      window.removeEventListener('pagehide', handleScroll);
    };
  }, []);

  // Handle route change scrolling
  useLayoutEffect(() => {
    // 1. First mount (initial page load or refresh):
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (location.hash) {
        const targetId = location.hash.slice(1);
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    // 2. POP navigation (Browser Back/Forward or BackButton navigate(-1)):
    if (navigationType === 'POP') {
      const saved = positionsMap.current.get(location.key) || getStoredPositions()[location.key];
      const targetY = saved ? saved.y : 0;
      const targetX = saved ? saved.x : 0;

      // Immediate scroll to restore position
      window.scrollTo({ top: targetY, left: targetX, behavior: 'instant' });

      // If page content is still rendering asynchronously (e.g. products API),
      // re-check and restore targetY as the document height expands
      if (targetY > 0) {
        let attempts = 0;
        let cancelled = false;

        const onUserTouch = () => {
          cancelled = true;
        };
        window.addEventListener('wheel', onUserTouch, { once: true, passive: true });
        window.addEventListener('touchstart', onUserTouch, { once: true, passive: true });
        window.addEventListener('keydown', onUserTouch, { once: true, passive: true });

        const adjustScroll = () => {
          if (cancelled) return;
          const maxScroll = Math.max(
            document.documentElement.scrollHeight - window.innerHeight,
            document.body.scrollHeight - window.innerHeight,
            0
          );
          if (window.scrollY < targetY && maxScroll >= targetY) {
            window.scrollTo({ top: targetY, left: targetX, behavior: 'instant' });
          }
          attempts++;
          if (attempts < 20 && !cancelled) {
            requestAnimationFrame(adjustScroll);
          } else {
            window.removeEventListener('wheel', onUserTouch);
            window.removeEventListener('touchstart', onUserTouch);
            window.removeEventListener('keydown', onUserTouch);
          }
        };

        requestAnimationFrame(adjustScroll);
      }
      return;
    }

    // 3. PUSH or REPLACE navigation (New route navigated via links, cards, buttons, programmatic):
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          const elem = document.getElementById(targetId);
          if (elem) {
            elem.scrollIntoView({ behavior: 'smooth' });
            clearInterval(interval);
          } else if (attempts >= 10) {
            clearInterval(interval);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          }
        }, 50);
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname, location.search, location.hash, location.key, navigationType]);

  return null;
}
