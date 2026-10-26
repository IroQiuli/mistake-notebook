import { useEffect, useRef, useState } from 'react';
import {
  SHIMEJI_CLIPS,
  getFrameUrl,
  type ShimejiAction,
} from './shimejiAnimations';
import { cn } from '../../ui/cn';

interface ShimejiRendererProps {
  action: ShimejiAction;
  size: number;
  className?: string;
  onActionComplete?: () => void;
}

// 缓存已预加载的图片，防止重复预加载
const preloadedUrls = new Set<string>();

/** 预热所有动作的关键帧图片到浏览器内存 */
export function preloadShimejiFrames() {
  if (typeof window === 'undefined') return;
  Object.values(SHIMEJI_CLIPS).forEach((clip) => {
    clip.frames.forEach((frame) => {
      const url = getFrameUrl(frame);
      if (!preloadedUrls.has(url)) {
        preloadedUrls.add(url);
        const img = new Image();
        img.src = url;
      }
    });
  });
}

export function ShimejiRenderer({
  action,
  size,
  className,
  onActionComplete,
}: ShimejiRendererProps) {
  const clip = SHIMEJI_CLIPS[action] || SHIMEJI_CLIPS.idle_sit;
  const [frameIndex, setFrameIndex] = useState(0);
  const actionRef = useRef(action);
  const onCompleteRef = useRef(onActionComplete);

  onCompleteRef.current = onActionComplete;

  // 预加载所有帧
  useEffect(() => {
    preloadShimejiFrames();
  }, []);

  // 动作改变时重置帧索引
  useEffect(() => {
    actionRef.current = action;
    setFrameIndex(0);
  }, [action]);

  // 驱动序列帧播放
  useEffect(() => {
    const totalFrames = clip.frames.length;
    if (totalFrames <= 1) return;

    const interval = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= totalFrames) {
          if (!clip.loop) {
            clearInterval(interval);
            onCompleteRef.current?.();
            return prev; // 停在最后一帧
          }
          return 0; // 循环播放
        }
        return next;
      });
    }, clip.intervalMs);

    return () => clearInterval(interval);
  }, [action, clip]);

  const currentFrameRel = clip.frames[Math.min(frameIndex, clip.frames.length - 1)];
  const src = getFrameUrl(currentFrameRel);

  return (
    <img
      src={src}
      alt="初音未来动态桌宠"
      width={size}
      height={size}
      draggable={false}
      className={cn(
        'select-none pointer-events-none object-contain drop-shadow-md',
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
}
