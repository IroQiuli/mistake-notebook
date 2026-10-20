import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** 进入详情页时塞进 history.state 的来源地址（path + search） */
export interface GoState {
  from?: string;
}

function historyIndex(): number {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}

/**
 * 统一的「返回」：
 * 1. 有记录来源 → 直接回来源（replace，不堆历史）
 * 2. 没有来源但历史栈里还有上一页 → back()
 * 3. 都没有（深链 / PWA 冷启动直接打开详情）→ 去兜底页
 */
export function useBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const from = (location.state as GoState | null)?.from;
    const here = location.pathname + location.search;
    if (from && from !== here) {
      navigate(from, { replace: true, state: { scroll: true } });
      return;
    }
    if (historyIndex() > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback, { replace: true });
  }, [navigate, location, fallback]);
}

/** 跳到详情页，同时记下来源，供 useBack 使用 */
export function useGo() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (path: string, opts?: { replace?: boolean }) => {
      navigate(path, {
        replace: opts?.replace,
        state: { from: location.pathname + location.search } satisfies GoState,
      });
    },
    [navigate, location]
  );
}
