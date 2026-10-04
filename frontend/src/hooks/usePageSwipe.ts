import { useRef, type PointerEvent } from 'react';

/** Horizontal navigation only at fit zoom; vertical scrolling and native pinch stay available. */
export function usePageSwipe(previous: () => void, next: () => void, enabled: boolean) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || !event.isPrimary || event.pointerType === 'mouse' ||
        (event.target as HTMLElement).closest('button, input, textarea, select')) return;
      start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const origin = start.current;
      start.current = null;
      if (!origin || origin.id !== event.pointerId || !enabled) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        if (dx < 0) next(); else previous();
      }
    },
    onPointerCancel() { start.current = null; },
  };
}
