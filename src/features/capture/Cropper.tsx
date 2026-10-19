import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clampRect, type Rect } from './pipeline';
import { Button } from '../../ui/Button';

interface CropperProps {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  onConfirm: (rect: Rect) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 整页可见的框选器：图片按 contain 缩放，保证再长的卷子也能一屏看全，
 * 不需要在图上滚动（滚动会和拖拽框选冲突）。
 * 坐标按「图片实际显示区域」换算，而不是按容器，避免黑边导致偏移。
 */
export function Cropper({ src, naturalWidth, naturalHeight, onConfirm }: CropperProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  /** 图片在容器内的实际显示矩形（object-contain 会居中留边） */
  const layout = useMemo(() => {
    if (!box.w || !box.h) return null;
    const scale = Math.min(box.w / naturalWidth, box.h / naturalHeight);
    const dw = naturalWidth * scale;
    const dh = naturalHeight * scale;
    return { dw, dh, ox: (box.w - dw) / 2, oy: (box.h - dh) / 2 };
  }, [box, naturalWidth, naturalHeight]);

  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapRef.current;
      if (!el || !layout) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: clamp01((clientX - r.left - layout.ox) / layout.dw),
        y: clamp01((clientY - r.top - layout.oy) / layout.dh),
      };
    },
    [layout]
  );

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
        ref={wrapRef}
        data-testid="cropper"
        className="relative w-full select-none overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900"
        style={{ height: 'min(58vh, 520px)', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt="待裁剪"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {rect && layout && (
          <div
            className="pointer-events-none absolute z-10 border-2 border-orange-400 bg-orange-400/10"
            style={{
              left: layout.ox + rect.x * layout.dw,
              top: layout.oy + rect.y * layout.dh,
              width: rect.w * layout.dw,
              height: rect.h * layout.dh,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            }}
          />
        )}

        {!rect && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
              在题目上拖出选区，整页都在框里也可以
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" block onClick={() => setRect(null)} disabled={!rect}>
          重画
        </Button>
        <Button variant="primary" block disabled={!valid} onClick={() => valid && onConfirm(rect!)}>
          用这个区域
        </Button>
      </div>

      <p className="text-center text-[11px] text-zinc-400">
        图片已缩到一屏内，长卷子也能直接框到最底部
      </p>
    </div>
  );
}
