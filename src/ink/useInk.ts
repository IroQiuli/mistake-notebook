import { useCallback, useEffect, useRef, useState } from 'react';
import type { InkOwner, Stroke } from '../domain/types';
import { latestInk, saveInk } from '../storage/inks';

interface Options {
  /** true = 每次进入都新建一层（复习作答），不复用上一次的笔迹 */
  fresh?: boolean;
}

/**
 * 笔迹读写：加载最近一层已保存笔迹，改动后 600ms 防抖落库；
 * 页面隐藏/关闭时立即 flush。
 */
export function useInk(ownerType: InkOwner, ownerId: string, aspect: number, opts: Options = {}) {
  const fresh = opts.fresh ?? false;
  const [loading, setLoading] = useState(!fresh);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const inkIdRef = useRef<string | null>(null);
  const latestRef = useRef<Stroke[]>([]);
  const timer = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (fresh) {
      inkIdRef.current = null;
      latestRef.current = [];
      setStrokes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const ink = await latestInk(ownerType, ownerId);
      if (cancelled) return;
      inkIdRef.current = ink?.id ?? null;
      latestRef.current = ink?.strokes ?? [];
      setStrokes(ink?.strokes ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId, fresh]);

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirtyRef.current && inkIdRef.current === null) return;
    if (latestRef.current.length === 0 && inkIdRef.current === null) return;
    dirtyRef.current = false;
    const id = await saveInk({
      id: inkIdRef.current ?? undefined,
      ownerType,
      ownerId,
      strokes: latestRef.current,
      aspect,
    });
    inkIdRef.current = id;
  }, [ownerType, ownerId, aspect]);

  const update = useCallback(
    (next: Stroke[]) => {
      setStrokes(next);
      latestRef.current = next;
      dirtyRef.current = true;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flush();
      }, 600);
    },
    [flush]
  );

  useEffect(() => {
    const handler = () => {
      if (dirtyRef.current) void flush();
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('pagehide', handler);
      if (dirtyRef.current) void flush();
    };
  }, [flush]);

  const reload = useCallback(async () => {
    const ink = await latestInk(ownerType, ownerId);
    inkIdRef.current = ink?.id ?? null;
    latestRef.current = ink?.strokes ?? [];
    setStrokes(ink?.strokes ?? []);
  }, [ownerType, ownerId]);

  return { loading, strokes, update, flush, reload, inkId: inkIdRef };
}
