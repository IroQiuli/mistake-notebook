import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { clampRect, type Rect } from './pipeline';
import { Button } from '../../ui/Button';

interface CropperProps {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  onConfirm: (rect: Rect) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Mode = 'idle' | 'draw' | 'move' | 'pinch';

/**
 * 框选器：
 * - 图片默认缩到一屏内，长卷子也能直接框到最底部
 * - 双指缩放 / 拖动移动视图（缩放后单指在框外拖动画新框）
 * - 单指按住已有框可整体拖动
 * - 坐标始终换算到图片自身，缩放不影响框选结果
 */
export function Cropper({ src, naturalWidth, naturalHeight, onConfirm }: CropperProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);

  const mode = useRef<Mode>('idle');
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const moveStart = useRef<{ x: number; y: number; rect: Rect } | null>(null);
  const pinchStart = useRef<{
    dist: number;
    scale: number;
    mid: { x: number; y: number };
    view: { scale: number; x: number; y: number };
  } | null>(null);

  /** 图片在容器内未经缩放时的显示尺寸 */
  const layout = useMemo(() => {
    if (!box.w || !box.h) return null;
    const scale = Math.min(box.w / naturalWidth, box.h / naturalHeight);
    const dw = naturalWidth * scale;
    const dh = naturalHeight * scale;
    return { dw, dh, ox: (box.w - dw) / 2, oy: (box.h - dh) / 2 };
  }, [box, naturalWidth, naturalHeight]);

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

  const resetView = useCallback(() => {
    if (!layout) return;
    setView({ scale: 1, x: layout.ox, y: layout.oy });
    setZoomed(false);
  }, [layout]);

  useEffect(() => {
    resetView();
  }, [resetView]);

  const clampView = (x: number, y: number, scale: number) => {
    if (!layout) return { x, y };
    const minX = Math.min(0, box.w - layout.dw * scale);
    const maxX = Math.max(0, box.w - layout.dw * scale);
    const minY = Math.min(0, box.h - layout.dh * scale);
    const maxY = Math.max(0, box.h - layout.dh * scale);
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
  };

  /** 屏幕坐标 → 图片归一化坐标 */
  const toNorm = useCallback(
    (clientX: number, clientY: number) => {
      const el = wrapRef.current;
      if (!el || !layout) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const ix = (clientX - r.left - view.x) / view.scale;
      const iy = (clientY - r.top - view.y) / view.scale;
      return { x: clamp01(ix / layout.dw), y: clamp01(iy / layout.dh) };
    },
    [layout, view]
  );

  const insideRect = useCallback(
    (norm: { x: number; y: number }) => {
      if (!rect) return false;
      return (
        norm.x >= rect.x &&
        norm.x <= rect.x + rect.w &&
        norm.y >= rect.y &&
        norm.y <= rect.y + rect.h
      );
    },
    [rect]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: view.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: { ...view },
      };
      mode.current = 'pinch';
      drawStart.current = null;
      moveStart.current = null;
      return;
    }

    if (pointers.current.size > 2) return;

    const norm = toNorm(e.clientX, e.clientY);
    if (insideRect(norm) && rect) {
      mode.current = 'move';
      moveStart.current = { x: norm.x, y: norm.y, rect };
      return;
    }

    mode.current = 'draw';
    drawStart.current = norm;
    setRect({ x: norm.x, y: norm.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (mode.current === 'pinch' && pinchStart.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const start = pinchStart.current;
      const nextScale = clamp((start.scale * dist) / start.dist, 1, 5);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const el = wrapRef.current!.getBoundingClientRect();
      // 保持双指中点下的图片位置不动
      const ix = (start.mid.x - el.left - start.view.x) / start.view.scale;
      const iy = (start.mid.y - el.top - start.view.y) / start.view.scale;
      const pos = clampView(
        mid.x - el.left - ix * nextScale,
        mid.y - el.top - iy * nextScale,
        nextScale
      );
      setView({ scale: nextScale, ...pos });
      setZoomed(nextScale > 1.01);
      return;
    }

    if (mode.current === 'move' && moveStart.current && rect) {
      const norm = toNorm(e.clientX, e.clientY);
      const start = moveStart.current;
      const nx = clamp(start.rect.x + (norm.x - start.x), 0, 1 - start.rect.w);
      const ny = clamp(start.rect.y + (norm.y - start.y), 0, 1 - start.rect.h);
      setRect({ ...start.rect, x: nx, y: ny });
      return;
    }

    if (mode.current === 'draw' && drawStart.current) {
      const norm = toNorm(e.clientX, e.clientY);
      const start = drawStart.current;
      setRect(
        clampRect({
          x: Math.min(start.x, norm.x),
          y: Math.min(start.y, norm.y),
          w: Math.abs(norm.x - start.x),
          h: Math.abs(norm.y - start.y),
        })
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      mode.current = 'idle';
      drawStart.current = null;
      moveStart.current = null;
      pinchStart.current = null;
    } else if (pointers.current.size === 1) {
      mode.current = 'idle';
      pinchStart.current = null;
    }
  };

  const zoomBy = (factor: number) => {
    if (!layout) return;
    const nextScale = clamp(view.scale * factor, 1, 5);
    const cx = box.w / 2;
    const cy = box.h / 2;
    const ix = (cx - view.x) / view.scale;
    const iy = (cy - view.y) / view.scale;
    const pos = clampView(cx - ix * nextScale, cy - iy * nextScale, nextScale);
    setView({ scale: nextScale, ...pos });
    setZoomed(nextScale > 1.01);
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
        {layout && (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: layout.dw,
              height: layout.dh,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          >
            <img
              src={src}
              alt="待裁剪"
              className="pointer-events-none h-full w-full"
              draggable={false}
            />
            {rect && (
              <div
                className="pointer-events-none absolute border-2 border-orange-400 bg-orange-400/10"
                style={{
                  left: rect.x * layout.dw,
                  top: rect.y * layout.dh,
                  width: rect.w * layout.dw,
                  height: rect.h * layout.dh,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                }}
              />
            )}
          </div>
        )}

        {/* 缩放控制 */}
        <div className="absolute right-2 top-2 z-20 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1.5)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur active:bg-black/70"
            aria-label="放大"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur active:bg-black/70"
            aria-label="缩小"
          >
            <Minus size={16} />
          </button>
          {zoomed && (
            <button
              type="button"
              onClick={resetView}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur active:bg-black/70"
              aria-label="复位"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>

        {!rect && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
            <span className="rounded-full bg-black/60 px-3 py-1.5 text-center text-xs leading-relaxed text-white">
              在题目上拖出选区；双指可缩放；按住框内可拖动
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
        图片已缩到一屏内；放大后单指拖动画框、双指拖动平移
      </p>
    </div>
  );
}
