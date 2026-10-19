import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from './cn';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** 双击/双指的缩放上限 */
  maxScale?: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * 支持双指缩放、单指平移（放大后）、双击放大的图片容器。
 * 用 Pointer Events 统一鼠标/触摸/触屏笔，容器需要 touch-action: none。
 */
export function ZoomableImage({ src, alt = '', className, maxScale = 5 }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ dist: number; scale: number; center: Point } | null>(null);
  const panStart = useRef<{ pointer: Point; offset: Point } | null>(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      panStart.current = {
        pointer: { x: e.clientX, y: e.clientY },
        offset,
      };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      panStart.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.min(maxScale, Math.max(1, (gesture.current.scale * dist) / (gesture.current.dist || 1)));
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return;
    }

    if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const dx = e.clientX - panStart.current.pointer.x;
      const dy = e.clientY - panStart.current.pointer.y;
      setOffset({ x: panStart.current.offset.x + dx, y: panStart.current.offset.y + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  const toggleZoom = () => {
    if (scale > 1) reset();
    else setScale(2.2);
  };

  return (
    <div
      className={cn('ink-canvas relative overflow-hidden bg-zinc-100', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={toggleZoom}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: gesture.current ? 'none' : 'transform 120ms ease-out',
        }}
      />
      {scale > 1.01 && (
        <button
          type="button"
          onClick={reset}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur"
        >
          复位
        </button>
      )}
    </div>
  );
}
