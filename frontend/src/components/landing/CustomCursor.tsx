import { useEffect, useState } from 'react';

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cursorText, setCursorText] = useState('');

  useEffect(() => {
    // Check if device supports fine pointer (mouse)
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!visible) setVisible(true);

      // Detect hover target
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-cursor-label]')) {
        const label = target.closest('[data-cursor-label]')?.getAttribute('data-cursor-label') || '';
        setCursorText(label);
      } else if (target?.closest('a, button, [role="button"]')) {
        setCursorText('VIEW');
      } else {
        setCursorText('');
      }
    };

    const handleMouseLeave = () => setVisible(false);
    const handleMouseEnter = () => setVisible(true);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      clearInterval(timer);
    };
  }, [visible]);

  if (!visible) return null;

  const formattedTime = new Date(seconds * 1000).toISOString().substring(14, 19);

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-50 transition-opacity duration-300 select-none"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        mixBlendMode: 'difference',
      }}
    >
      {/* 4px Precision Cube */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-white" />

      {/* Floating Coordinate & State Tag */}
      <div className="absolute top-3 left-4 flex flex-col items-start gap-0.5 text-white font-mono text-[9px] tracking-widest uppercase opacity-80 whitespace-nowrap">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-1 h-1 bg-white rounded-full animate-ping inline-block" />
          <span>{cursorText || 'CATANA · 12-COL'}</span>
        </span>
        <span className="opacity-60 text-[8px]">
          X:{Math.round(position.x)} Y:{Math.round(position.y)} · {formattedTime}
        </span>
      </div>
    </div>
  );
}
