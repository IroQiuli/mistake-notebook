import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { InkPoint, Stroke, Tool } from '../domain/types';
import { clearCanvas, drawSegment, drawStroke } from './renderer';
import { hitTest, simplify } from './strokes';
import { newId } from '../lib/id';

export type InkTool = Tool | 'eraser';

export interface InkSurfaceHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

interface InkSurfaceProps {
  src?: string | null;
  /** 无底图时的宽高比 */
  aspect?: number;
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  tool: InkTool;
  color: string;
  /** 基准线宽，相对画布宽度的比例，如 0.0045 */
  width: number;
  className?: string;
  alt?: string;
  onFirstStroke?: () => void;
  /** 只展示、不接收输入的旧笔迹（复习时切换显示） */
  backgroundStrokes?: Stroke[];
  readOnly?: boolean;
}

const ERASER_RADIUS = 0.018;

export const InkSurface = forwardRef<InkSurfaceHandle, InkSurfaceProps>(function InkSurface(
  { src, aspect = 3 / 4, strokes, onChange, tool, color, width, className, alt, onFirstStroke, backgroundStrokes, readOnly },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const strokesRef = useRef<Stroke[]>(strokes);
  const backgroundStrokesRef = useRef<Stroke[]>(backgroundStrokes ?? []);
  const currentRef = useRef<Stroke | null>(null);
  const pointersRef = useRef<Set<number>>(new Set());
  const lastPenAt = useRef(0);
  const erasingRef = useRef(false);
  const redoRef = useRef<Stroke[]>([]);

  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const { w, h } = sizeRef.current;
    if (!ctx || w === 0) return;
    clearCanvas(ctx, w, h);
    for (const s of backgroundStrokesRef.current) drawStroke(ctx, s, w, h);
    for (const s of strokesRef.current) drawStroke(ctx, s, w, h);
  }, []);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;
    sizeRef.current = { w: rect.width, h: rect.height };
    redraw();
  }, [redraw]);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes, redraw]);

  useEffect(() => {
    backgroundStrokesRef.current = backgroundStrokes ?? [];
    redraw();
  }, [backgroundStrokes, redraw]);

  useEffect(() => {
    resize();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    window.addEventListener('orientationchange', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
  }, [resize]);

  const toNorm = (clientX: number, clientY: number): InkPoint => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      0.5,
    ];
  };

  const pressureOf = (e: PointerEvent): number => {
    if (e.pointerType === 'pen' && e.pressure > 0) return Math.min(1, e.pressure);
    return 0.5;
  };

  const eraseAt = (p: InkPoint) => {
    const hit = hitTest(strokesRef.current, p[0], p[1], ERASER_RADIUS);
    if (hit) {
      strokesRef.current = strokesRef.current.filter((s) => s.id !== hit.id);
      redoRef.current = [];
      onChange(strokesRef.current);
      redraw();
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const native = e.nativeEvent;
    if (native.pointerType === 'touch' && Date.now() - lastPenAt.current < 1000) return;
    if (native.pointerType === 'pen') lastPenAt.current = Date.now();

    if (pointersRef.current.size >= 1) {
      // 第二根手指按下：放弃当前笔画，避免双指手势画出乱线
      currentRef.current = null;
      return;
    }
    pointersRef.current.add(native.pointerId);
    e.currentTarget.setPointerCapture?.(native.pointerId);

    const p = toNorm(native.clientX, native.clientY);
    p[2] = pressureOf(native);

    if (tool === 'eraser') {
      erasingRef.current = true;
      eraseAt(p);
      return;
    }

    onFirstStroke?.();
    currentRef.current = {
      id: newId(),
      tool,
      color,
      width,
      points: [p],
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const native = e.nativeEvent;
    if (!pointersRef.current.has(native.pointerId)) return;

    if (erasingRef.current) {
      eraseAt(toNorm(native.clientX, native.clientY));
      return;
    }

    const stroke = currentRef.current;
    const ctx = ctxRef.current;
    if (!stroke || !ctx) return;

    const events = native.getCoalescedEvents?.() ?? [native];
    const before = stroke.points.length - 1;
    for (const ev of events) {
      const p = toNorm(ev.clientX, ev.clientY);
      p[2] = pressureOf(ev);
      const last = stroke.points[stroke.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.0006) continue;
      stroke.points.push(p);
    }
    const { w, h } = sizeRef.current;
    drawSegment(ctx, stroke, before, stroke.points.length - 1, w, h);
  };

  const finishStroke = (cancel = false) => {
    const stroke = currentRef.current;
    currentRef.current = null;
    erasingRef.current = false;
    if (!stroke || cancel) return;
    stroke.points = simplify(stroke.points);
    strokesRef.current = [...strokesRef.current, stroke];
    redoRef.current = [];
    onChange(strokesRef.current);
    redraw();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.nativeEvent.pointerId);
    if (currentRef.current || erasingRef.current) finishStroke();
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.nativeEvent.pointerId);
    finishStroke(true);
  };

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (strokesRef.current.length === 0) return;
      const last = strokesRef.current[strokesRef.current.length - 1];
      redoRef.current = [...redoRef.current, last];
      strokesRef.current = strokesRef.current.slice(0, -1);
      onChange(strokesRef.current);
      redraw();
    },
    redo: () => {
      if (redoRef.current.length === 0) return;
      const next = redoRef.current[redoRef.current.length - 1];
      redoRef.current = redoRef.current.slice(0, -1);
      strokesRef.current = [...strokesRef.current, next];
      onChange(strokesRef.current);
      redraw();
    },
    clear: () => {
      redoRef.current = [];
      strokesRef.current = [];
      onChange([]);
      redraw();
    },
  }));

  return (
    <div ref={wrapRef} className={`relative w-full select-none ${className ?? ''}`}>
      {src ? (
        <img
          src={src}
          alt={alt ?? ''}
          draggable={false}
          className="block h-auto w-full"
          onLoad={resize}
        />
      ) : (
        <div style={{ aspectRatio: `${aspect}` }} className="w-full bg-white" />
      )}
      <canvas
        ref={canvasRef}
        className="ink-canvas absolute inset-0 h-full w-full"
        style={{ pointerEvents: readOnly ? 'none' : 'auto' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
});
