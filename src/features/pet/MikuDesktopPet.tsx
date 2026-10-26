import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Minus, RotateCcw, Sparkles, X } from 'lucide-react';
import { usePetState } from './usePetState';
import { ShimejiRenderer } from './ShimejiRenderer';
import {
  MikuChibiCelebrate,
  MikuChibiLeek,
  MikuChibiSparkle,
  MikuChibiSprint,
  MikuChibiThinking,
  MikuChibiThumbsUp,
} from '../../ui/MikuChibi';
import { cn } from '../../ui/cn';

export function MikuDesktopPet() {
  const {
    isMiku,
    enabled,
    size,
    style,
    pose,
    shimejiAction,
    minimized,
    position,
    bubbleText,
    bubbleVisible,
    isJelly,
    poke,
    hideBubble,
    toggleMinimized,
    updatePosition,
    persistPosition,
    resetPosition,
    startDragAction,
    endDragAction,
    handleActionComplete,
  } = usePetState();

  const location = useLocation();
  const isReviewPage = location.pathname.startsWith('/review');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // 若非 Miku 主题或用户在设置中关闭了桌宠，则不渲染
  if (!isMiku || !enabled) {
    return null;
  }

  // 计算当前视口与默认位置
  const isCustomPos = position !== null;
  const currentLeft = isCustomPos ? position.x : undefined;
  const currentTop = isCustomPos ? position.y : undefined;

  // 拖拽处理：Pointer 事件统一支持触屏与鼠标
  const handlePointerDown = (e: React.PointerEvent) => {
    // 忽略点击气泡内部的操作
    if ((e.target as HTMLElement).closest('.pet-bubble')) return;

    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: rect.left,
      initY: rect.top,
      moved: false,
    };

    if (typeof (e.target as any)?.setPointerCapture === 'function') {
      (e.target as any).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const { startX, startY, initX, initY } = dragStartRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragStartRef.current.moved && Math.hypot(dx, dy) > 5) {
      dragStartRef.current.moved = true;
      setDragging(true);
      hideBubble();
      startDragAction();
    }

    if (dragStartRef.current.moved) {
      const maxX = Math.max(10, window.innerWidth - (minimized ? 48 : size) - 10);
      const maxY = Math.max(10, window.innerHeight - (minimized ? 48 : size) - 10);
      const nextX = Math.min(maxX, Math.max(10, initX + dx));
      const nextY = Math.min(maxY, Math.max(10, initY + dy));
      updatePosition({ x: nextX, y: nextY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const moved = dragStartRef.current.moved;
    dragStartRef.current = null;
    setDragging(false);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    // 若未发生明显移动，判定为点击戳一戳；若移动则执行落地动作并保存位置
    if (!moved) {
      if (minimized) {
        toggleMinimized();
      } else {
        poke();
      }
    } else {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        persistPosition({ x: rect.left, y: rect.top });
      }
      endDragAction();
    }
  };

  // 姿态映射
  const renderAvatar = () => {
    if (style === 'animated') {
      return (
        <ShimejiRenderer
          action={shimejiAction}
          size={Math.round(size * 1.15)}
          onActionComplete={handleActionComplete}
        />
      );
    }

    const avatarProps = {
      size: size,
      className: 'transition-transform duration-200 select-none pointer-events-none drop-shadow-xs',
    };
    switch (pose) {
      case 'sprint':
        return <MikuChibiSprint {...avatarProps} />;
      case 'sparkle':
        return <MikuChibiSparkle {...avatarProps} />;
      case 'celebrate':
        return <MikuChibiCelebrate {...avatarProps} />;
      case 'thinking':
        return <MikuChibiThinking {...avatarProps} />;
      case 'thumbsup':
        return <MikuChibiThumbsUp {...avatarProps} />;
      case 'leek':
      default:
        return <MikuChibiLeek {...avatarProps} />;
    }
  };

  // 判断气泡展开方向（若靠近右边界则向左展开，否则向右展开）
  const isRightSide = position ? position.x > window.innerWidth / 2 : false;

  return (
    <aside
      ref={containerRef}
      aria-label="初音未来伴学桌宠"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        WebkitTapHighlightColor: 'transparent',
        ...(isCustomPos
          ? { left: `${currentLeft}px`, top: `${currentTop}px`, right: 'auto', bottom: 'auto' }
          : {}),
      }}
      className={cn(
        'fixed z-45 touch-none select-none transition-opacity duration-300 outline-none border-none bg-transparent',
        !isCustomPos && 'left-3 bottom-[72px] md:left-5 md:bottom-6',
        isReviewPage ? 'opacity-85 hover:opacity-100' : 'opacity-100',
        dragging && 'cursor-grabbing scale-105 opacity-90'
      )}
    >
      {/* 最小化形态：精致小葱/音符呼吸徽章 */}
      {minimized ? (
        <button
          type="button"
          onClick={toggleMinimized}
          title="点击唤醒初音桌宠"
          className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-teal-300/80 bg-white/90 shadow-md backdrop-blur-md transition-all hover:scale-110 active:scale-95"
        >
          <MikuChibiLeek size={26} className="pointer-events-none drop-shadow-xs" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-teal-500 text-[8px] font-bold text-white shadow-xs animate-pulse">
            ♪
          </span>
        </button>
      ) : (
        /* 完整桌宠形态 */
        <div className="relative group cursor-grab">
          {/* 对话气泡 */}
          {bubbleVisible && bubbleText && (
            <div
              className={cn(
                'pet-bubble absolute bottom-full mb-2.5 z-50 flex flex-col rounded-2xl border border-teal-200/80 bg-white/95 p-3 shadow-xl backdrop-blur-md ring-1 ring-teal-500/10 transition-all animate-in fade-in zoom-in-95',
                isRightSide ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
                'w-56 text-xs text-zinc-800'
              )}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-teal-100/60 text-[10px] text-teal-600 font-semibold">
                <span className="flex items-center gap-1">
                  <Sparkles size={11} className="text-teal-500" />
                  Miku 伴学时刻
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMinimized();
                    }}
                    title="收起最小化"
                    className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-400 hover:bg-teal-50 hover:text-teal-600"
                  >
                    <Minus size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hideBubble();
                    }}
                    title="关闭气泡"
                    className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-700 font-medium">
                {bubbleText}
              </p>
              {/* 小箭头三角 */}
              <div
                className={cn(
                  'absolute -bottom-1.5 h-3 w-3 rotate-45 border-r border-b border-teal-200/80 bg-white/95',
                  isRightSide ? 'right-6' : 'left-6'
                )}
              />
            </div>
          )}

          {/* 初音立绘/动态小人本体与动效 */}
          <div
            className={cn(
              'relative flex flex-col items-center justify-center transition-transform duration-200 outline-none border-none bg-transparent',
              style === 'chibi' && !dragging && 'animate-pet-float',
              isJelly && 'animate-pet-jelly'
            )}
            style={{ width: size, height: size }}
          >
            {renderAvatar()}
            {/* 脚底随动立体微阴影（仅微弱地面柔和阴影，无任何矩形线框） */}
            <div
              className={cn(
                'absolute -bottom-1 h-1.5 rounded-full bg-teal-950/20 blur-[1px] transition-all duration-150 pointer-events-none',
                !dragging && (style === 'chibi' ? 'animate-pet-shadow' : 'opacity-70 scale-100'),
                dragging && 'opacity-20 scale-70 -translate-y-1'
              )}
              style={{ width: Math.max(16, size * 0.45) }}
            />
          </div>

          {/* 悬停快捷微操作栏（右下角微小齿轮/重置按钮） */}
          {isCustomPos && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetPosition();
              }}
              title="重置回默认左下角"
              className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-zinc-400 border border-zinc-200 shadow-xs hover:text-teal-600"
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
