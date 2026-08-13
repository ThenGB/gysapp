import { useEffect, useRef } from 'react';

const DURATION_MS = 190;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';

export function useRouteMotion(pathname: string, elementId = 'main-content') {
  const animationRef = useRef<Animation | null>(null);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }

    const element = document.getElementById(elementId);
    if (!element || typeof element.animate !== 'function') return;

    const systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const appReduced = document.documentElement.dataset.reduceMotion === 'true';
    if (systemReduced || appReduced) return;

    animationRef.current?.cancel();
    animationRef.current = element.animate(
      [
        { opacity: 0.72, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: DURATION_MS, easing: EASING },
    );

    return () => {
      animationRef.current?.cancel();
      animationRef.current = null;
    };
  }, [elementId, pathname]);
}
