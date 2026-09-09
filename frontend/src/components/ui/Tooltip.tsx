import { type FC, useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  text: string;
  shortcut?: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: FC<TooltipProps> = ({
  text,
  shortcut,
  children,
  position = 'bottom',
  delay = 120,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();

    let x = 0;
    let y = 0;

    switch (position) {
      case 'right':
        x = rect.right + 8;
        y = rect.top + rect.height / 2;
        break;
      case 'left':
        x = rect.left - 8;
        y = rect.top + rect.height / 2;
        break;
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - 8;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + 8;
        break;
    }

    setCoords({ x, y });

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTooltipTransform = () => {
    switch (position) {
      case 'right':
        return '-translate-y-1/2';
      case 'left':
        return '-translate-x-full -translate-y-1/2';
      case 'top':
        return '-translate-x-1/2 -translate-y-full';
      case 'bottom':
        return '-translate-x-1/2';
      default:
        return '';
    }
  };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isVisible && text && (
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] px-2 py-1 bg-zinc-900/95 border border-zinc-700/80 text-zinc-100 text-[11px] font-medium rounded-md shadow-2xl pointer-events-none whitespace-nowrap flex items-center gap-1.5 backdrop-blur-xs transition-opacity animate-in fade-in duration-100 ${getTooltipTransform()}`}
          style={{
            left: `${coords.x}px`,
            top: `${coords.y}px`,
          }}
        >
          <span>{text}</span>
          {shortcut && (
            <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-[9px] font-mono text-zinc-400 border border-zinc-700">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
