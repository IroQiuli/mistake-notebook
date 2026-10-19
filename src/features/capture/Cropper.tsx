import { useRef, useState } from 'react';
import { clampRect, type Rect } from './pipeline';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

interface CropperProps {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  onConfirm: (rect: Rect) => void;
}

/**
 * 在图片上拖拽框选。图片按原始宽高比铺满容器，
 * 因此归一化坐标可以直接换算成像素坐标。
 */
export function Cropper({ src, naturalWidth, naturalHeight, onConfirm }: CropperProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const toNorm = (clientX: number, clientY: number) => {
    const box = boxRef.current!.getBoundingClientRect();
    return {
      x: (clientX - box.left) / box.width,
      y: (clientY - box.top) / box.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toNorm(e.clientX, e.clientY);
    dragStart.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const p = toNorm(e.clientX, e.clientY);
    const start = dragStart.current;
    setRect(
      clampRect({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      })
    );
  };

  const onPointerUp = () => {
    dragStart.current = null;
  };

  const valid = rect && rect.w > 0.02 && rect.h > 0.02;

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        className="relative select-none overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
        style={{ aspectRatio: `${naturalWidth} / ${naturalHeight}`, touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={src} alt="待裁剪" className="pointer-events-none h-full w-full" draggable={false} />
        {rect && (
          <div
            className="pointer-events-none absolute border-2 border-orange-400 bg-orange-400/10"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            }}
          />
        )}
        {!rect && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs text-white">
              在图片上拖出这道题的区域
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          block
          onClick={() => setRect(null)}
          className={cn(!rect && 'opacity-50')}
          disabled={!rect}
        >
          重画
        </Button>
        <Button variant="primary" block disabled={!valid} onClick={() => valid && onConfirm(rect)}>
          用这个区域
        </Button>
      </div>
    </div>
  );
}
