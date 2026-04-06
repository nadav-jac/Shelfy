import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 60;   // px of pull needed to trigger refresh
const RESISTANCE = 0.45; // drag resistance factor (feels more native)

/**
 * Returns the current pull distance (0 when idle).
 * Calls onRefresh() when the user pulls past THRESHOLD.
 * Guards against concurrent calls — if onRefresh is already running, extra pulls are ignored.
 * onRefresh must be a stable reference (wrap in useCallback).
 */
export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);

  // Use refs so touch handlers don't capture stale closure values
  const startYRef    = useRef(0);
  const pullDistRef  = useRef(0);
  const isPullingRef = useRef(false);
  const isBusyRef    = useRef(false);

  useEffect(() => {
    function onTouchStart(e) {
      // Only start tracking when the page is already scrolled to the very top
      if (window.scrollY !== 0 || isBusyRef.current) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }

    function onTouchMove(e) {
      if (!isPullingRef.current) return;

      const dy = e.touches[0].clientY - startYRef.current;

      // Cancel pull if user scrolled back up (e.g. after a small bounce)
      if (window.scrollY > 0 || dy <= 0) {
        isPullingRef.current = false;
        pullDistRef.current  = 0;
        setPullDistance(0);
        return;
      }

      // Prevent the browser's own overscroll / pull-to-refresh
      e.preventDefault();

      // Apply resistance so the indicator doesn't race ahead of the finger
      pullDistRef.current = Math.min(dy * RESISTANCE, THRESHOLD * 1.5);
      setPullDistance(pullDistRef.current);
    }

    function onTouchEnd() {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      const dist = pullDistRef.current;
      pullDistRef.current = 0;
      setPullDistance(0);

      if (dist >= THRESHOLD && !isBusyRef.current) {
        isBusyRef.current = true;
        Promise.resolve(onRefresh()).finally(() => {
          isBusyRef.current = false;
        });
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    // passive: false is required so we can call preventDefault() on touchmove
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onRefresh]);

  return pullDistance;
}
