import { type FC, useState, useRef, ReactNode } from 'react';

interface TooltipProps {
  text: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: FC<TooltipProps> = ({
  text,
  children,
  position = 'right',
  delay = 300
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();

    // Calcular posição baseada na direção do tooltip
    let x = 0;
    let y = 0;

    switch (position) {
      case 'right':
        x = rect.right + 10;
        y = rect.top + rect.height / 2;
        break;
      case 'left':
        x = rect.left - 10;
        y = rect.top + rect.height / 2;
        break;
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - 10;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + 10;
        break;
    }

    setCoords({ x, y });

    // Delay antes de mostrar
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

  const getArrowClass = () => {
    switch (position) {
      case 'right':
        return 'absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45';
      case 'left':
        return 'absolute right-0 top-1/2 translate-x-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45';
      case 'top':
        return 'absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1 w-2 h-2 bg-gray-900 rotate-45';
      case 'bottom':
        return 'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1 w-2 h-2 bg-gray-900 rotate-45';
      default:
        return '';
    }
  };

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
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap ${getTooltipTransform()}`}
          style={{
            left: `${coords.x}px`,
            top: `${coords.y}px`,
          }}
        >
          {text}
          <div className={getArrowClass()} />
        </div>
      )}
    </div>
  );
};
