import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from './cn';

export interface ZoomableImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** 双击/双指的缩放上限，默认 8 倍以便看清微小文字与公式 */
  maxScale?: number;
  /** 是否允许进入全屏无边框放大模式，默认 true */
  allowFullscreen?: boolean;
  /** 是否以全屏沉浸模式初始化，默认 false */
  initialFullscreen?: boolean;
  /** 全屏查看时的标题提示 */
  title?: string;
  /** 关闭或退出回调 */
  onClose?: () => void;
  /** 全屏状态变化回调 */
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

interface Point {
  x: number;
  y: number;
}

/**
 * 支持双指缩放、平移拖拽、滚轮缩放、双击放大以及一键进入“真·全屏沉浸式放大”的图片容器。
 * 在平板（iPad）或电脑端，全屏模式使用 React Portal 占满整个屏幕，打破所有弹窗与容器限制。
 */
export function ZoomableImage({
  src,
  alt = '',
  className,
  maxScale = 8,
  allowFullscreen = true,
  initialFullscreen = false,
  title,
  onClose,
  onFullscreenChange,
}: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ dist: number; scale: number; center: Point } | null>(null);
  const panStart = useRef<{ pointer: Point; offset: Point } | null>(null);

  // 当源图片变化时重置缩放
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  // 同步 initialFullscreen
  useEffect(() => {
    if (initialFullscreen) {
      setIsFullscreen(true);
    }
  }, [initialFullscreen]);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(maxScale, Number((prev * 1.35).toFixed(2))));
  }, [maxScale]);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev / 1.35).toFixed(2)));
      if (next <= 1.01) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  }, []);

  const toggleZoom = useCallback(() => {
    if (scale > 1.05) {
      reset();
    } else {
      setScale(2.5);
    }
  }, [scale, reset]);

  // 全屏模式下锁定 body 滚动与监听 Esc、快捷键
  useEffect(() => {
    if (!isFullscreen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (initialFullscreen && onClose) {
          onClose();
        } else {
          setIsFullscreen(false);
          onFullscreenChange?.(false);
        }
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        reset();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen, initialFullscreen, onClose, onFullscreenChange, handleZoomIn, handleZoomOut, reset]);

  // Pointer 事件处理平移与双指缩放
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
      const next = Math.min(
        maxScale,
        Math.max(1, (gesture.current.scale * dist) / (gesture.current.dist || 1))
      );
      setScale(Number(next.toFixed(2)));
      if (next <= 1.01) setOffset({ x: 0, y: 0 });
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

  // 滚轮缩放支持（电脑或外接鼠标的平板极佳体验）
  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.18 : 0.85;
    setScale((prev) => {
      const next = Math.min(maxScale, Math.max(1, Number((prev * factor).toFixed(2))));
      if (next <= 1.01) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      return next;
    });
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
    onFullscreenChange?.(true);
  };

  const exitFullscreen = () => {
    if (initialFullscreen && onClose) {
      onClose();
    } else {
      setIsFullscreen(false);
      onFullscreenChange?.(false);
    }
  };

  // 尝试触发原生浏览器全屏
  const toggleNativeFullscreen = () => {
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.();
      } else {
        void document.documentElement.requestFullscreen?.();
      }
    } catch {
      // 部分移动浏览器限制 requestFullscreen
    }
  };

  // 1. 全屏沉浸模式视图（通过 React Portal 挂载到 body，完全打破任何容器宽高和弹窗限制）
  if (isFullscreen) {
    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex h-screen w-screen flex-col bg-black/95 text-white select-none touch-none overflow-hidden animate-in fade-in duration-200"
        onWheel={onWheel}
      >
        {/* 顶部半透明毛玻璃控制栏 */}
        <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/75 px-4 backdrop-blur-md safe-top">
          {/* 标题 & 比例徽章 */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="text-sm font-semibold tracking-wide text-zinc-100 truncate max-w-[140px] sm:max-w-xs">
              {title || '全屏沉浸查看'}
            </span>
            <span className="rounded-full bg-teal-500/20 border border-teal-500/30 px-2.5 py-0.5 text-xs font-mono text-teal-300">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* 控制按钮组 */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 1.01}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 active:scale-95 disabled:opacity-30 transition-all"
              title="缩小 (-)"
              aria-label="缩小"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= maxScale}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 active:scale-95 disabled:opacity-30 transition-all"
              title="放大 (+)"
              aria-label="放大"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs text-white/90 hover:bg-white/20 active:scale-95 transition-all"
              title="1:1 复位 (快捷键 0)"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">复位</span>
            </button>

            {/* 原生浏览器全屏扩展 */}
            {typeof document !== 'undefined' && document.fullscreenEnabled && (
              <button
                type="button"
                onClick={toggleNativeFullscreen}
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/90 hover:bg-white/20 active:scale-95 transition-all"
                title="切换系统全屏模式"
              >
                <Maximize2 size={15} />
              </button>
            )}

            <div className="mx-0.5 sm:mx-1 h-5 w-[1px] bg-white/20" />

            <button
              type="button"
              onClick={exitFullscreen}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-teal-600/90 hover:bg-teal-500 px-3 text-xs font-medium text-white shadow-md active:scale-95 transition-all"
              title="退出全屏 (Esc)"
            >
              <Minimize2 size={15} />
              <span>退出全屏</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-red-500/80 active:scale-95 transition-all"
                title="关闭"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </header>

        {/* 主视口区域：占满剩余 100% 视口，手势与拖拽全方位支持 */}
        <div
          className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
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
            className="pointer-events-none max-h-full max-w-full select-none object-contain transition-transform"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: gesture.current ? 'none' : 'transform 120ms ease-out',
            }}
          />
        </div>

        {/* 底部贴心操作手势提示 */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-white/70 backdrop-blur border border-white/10 safe-bottom">
          双指缩放 · 拖拽平移 · 双击 2.5x · 滚轮缩放
        </div>
      </div>,
      document.body
    );
  }

  // 2. 常规内联 / 弹窗容器视图
  return (
    <div
      className={cn('ink-canvas relative overflow-hidden bg-zinc-100', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={toggleZoom}
      onWheel={onWheel}
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

      {/* 右上角“全屏放大”醒目入口：随时可一键突破容器，进入无边界全屏 */}
      {allowFullscreen && (
        <button
          type="button"
          onClick={openFullscreen}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 hover:bg-black/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur transition-all active:scale-95 border border-white/15 hover:border-teal-400 group"
          title="以全屏无边界模式放大查看"
        >
          <Maximize2 size={13} className="text-teal-300 transition-transform group-hover:scale-110" />
          <span>全屏放大</span>
        </button>
      )}

      {/* 左下角快捷缩放按钮 */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full bg-black/65 p-1 backdrop-blur border border-white/10">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={scale <= 1.01}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/20 disabled:opacity-30 active:scale-95 transition-all"
          title="缩小"
          aria-label="缩小"
        >
          <ZoomOut size={13} />
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={scale >= maxScale}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/20 disabled:opacity-30 active:scale-95 transition-all"
          title="放大"
          aria-label="放大"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      {/* 右下角缩放比例与复位按钮 */}
      {scale > 1.01 && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
          <span className="rounded-full bg-black/65 px-2 py-1 text-[11px] font-mono text-teal-300 backdrop-blur border border-white/10">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-full bg-black/75 hover:bg-black/90 px-3 py-1 text-xs text-white backdrop-blur border border-white/15 transition-colors active:scale-95"
          >
            <RotateCcw size={11} />
            复位
          </button>
        </div>
      )}
    </div>
  );
}
