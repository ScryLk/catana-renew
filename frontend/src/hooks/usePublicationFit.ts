import { useEffect, useState } from 'react';

/** Measure presentation space only; publication coordinates remain canonical. */
export function usePublicationFit(width: number, height: number, margin = 24) {
  const [element, ref] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    if (!element) return;
    const measure = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      setFit(Math.max(0.05, Math.min(1,
        (element.clientWidth - margin) / width,
        (element.clientHeight - margin) / height,
      )));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, width, height, margin]);
  return { ref, fit };
}
