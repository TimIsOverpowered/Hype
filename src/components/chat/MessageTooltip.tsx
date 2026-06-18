import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function MessageTooltip({ children, title }: { children: React.ReactElement; title: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, align: 'center' });

  useEffect(() => {
    if (isHovered && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let newAlign = 'center';
      let newLeft = rect.left + rect.width / 2;

      const safeThreshold = 100;

      if (newLeft < safeThreshold) {
        newAlign = 'left';
        newLeft = rect.left;
      } else if (window.innerWidth - newLeft < safeThreshold) {
        newAlign = 'right';
        newLeft = rect.right;
      }

      setCoords({
        top: rect.top,
        left: newLeft,
        align: newAlign,
      });
    }
  }, [isHovered]);

  const getTransform = () => {
    if (coords.align === 'left') return 'translate(0, calc(-100% - 8px))';
    if (coords.align === 'right') return 'translate(-100%, calc(-100% - 8px))';
    return 'translate(-50%, calc(-100% - 8px))';
  };

  return (
    <span
      ref={containerRef}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[1300] w-max max-w-[calc(100vw-2rem)]"
            style={{
              top: coords.top,
              left: coords.left,
              transform: getTransform(),
            }}
          >
            <div className="w-fit animate-[fadeIn_0.15s_ease-out] rounded border border-[#222230] bg-[#16161e] px-3 py-2 text-sm text-[#f0f0f5] shadow-lg">
              {title}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
