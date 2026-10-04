import { useEffect } from 'react';

/** One listener owner for browser chrome, rotation and the software keyboard. */
export function ViewportFoundation() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      if (viewport && viewport.scale !== 1) return;
      document.documentElement.dataset.keyboardOpen = String(Boolean(viewport && window.innerHeight - viewport.height > 120));
      document.documentElement.style.setProperty('--app-height', `${viewport?.height ?? window.innerHeight}px`);
      document.documentElement.style.setProperty('--viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    const reveal = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('input, textarea, [contenteditable="true"]')) {
        requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest' }));
      }
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', reveal);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', reveal);
      document.documentElement.style.removeProperty('--app-height');
      document.documentElement.style.removeProperty('--viewport-top');
      delete document.documentElement.dataset.keyboardOpen;
    };
  }, []);
  return null;
}
