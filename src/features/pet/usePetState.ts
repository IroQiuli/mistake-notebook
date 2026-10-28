import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, getSettingSync, setSetting } from '../../storage/db';
import {
  getPetGreeting,
  getRandomPokeQuote,
  type PetContext,
  type PetPose,
} from './petQuotes';
import { learningDayStart } from '../../domain/time';
import type { ShimejiAction } from './shimejiAnimations';

const STORAGE_KEY_POS = 'miku_pet_pos';

export type PetStyle = 'animated' | 'chibi';

export interface PetPosition {
  x: number;
  y: number;
}

export function usePetState() {
  const theme = useLiveQuery(() => getSetting<string>('theme', 'miku'), [], getSettingSync('theme', 'miku'));
  const isMiku = theme === 'miku';

  const petEnabled = useLiveQuery(
    () => getSetting<boolean>('petEnabled', true),
    [],
    getSettingSync('petEnabled', true)
  );

  const petSize = useLiveQuery(
    () => getSetting<number>('petSize', 64),
    [],
    getSettingSync('petSize', 64)
  );

  const petStyle = useLiveQuery(
    () => getSetting<PetStyle>('petStyle', 'animated'),
    [],
    getSettingSync('petStyle', 'animated')
  );

  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem('miku_pet_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const [position, setPosition] = useState<PetPosition | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_POS);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return null;
  });

  const [pose, setPose] = useState<PetPose>('leek');
  const [shimejiAction, setShimejiAction] = useState<ShimejiAction>('idle');
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isJelly, setIsJelly] = useState(false);

  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jellyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 监听多窗口/设置页位置复位
  useEffect(() => {
    const handleStorage = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_POS);
        setPosition(raw ? JSON.parse(raw) : null);
        setMinimized(localStorage.getItem('miku_pet_minimized') === 'true');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // 统计今日复习量与待复习题量，用于自适应情境问候
  const todayDueCount = useLiveQuery(async () => {
    const now = Date.now();
    const dayStart = learningDayStart(now);
    return await db.cards.filter((c) => c.due <= dayStart).count();
  }, []);

  const todayReviewedCount = useLiveQuery(async () => {
    const now = Date.now();
    const dayStart = learningDayStart(now);
    return await db.reviewLogs.filter((l) => l.reviewedAt >= dayStart).count();
  }, []);

  // 初始挂载或复习进度变化时，刷新初始动作
  useEffect(() => {
    const ctx: PetContext = {
      dueCount: todayDueCount ?? 0,
      reviewedToday: todayReviewedCount ?? 0,
    };
    const greeting = getPetGreeting(ctx);
    setPose(greeting.pose);
  }, [todayDueCount, todayReviewedCount]);

  // 显示气泡（带防抖和自动消失）
  const showBubble = useCallback((text: string, durationMs = 4500) => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubbleText(text);
    setBubbleVisible(true);
    bubbleTimerRef.current = setTimeout(() => {
      setBubbleVisible(false);
    }, durationMs);
  }, []);

  const hideBubble = useCallback(() => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubbleVisible(false);
  }, []);

  // 戳一戳互动反馈
  const poke = useCallback(() => {
    // 触发果冻弹性动效
    setIsJelly(true);
    if (jellyTimerRef.current) clearTimeout(jellyTimerRef.current);
    jellyTimerRef.current = setTimeout(() => setIsJelly(false), 600);

    // 触发动态小人欢呼比耶跳跃动效
    setShimejiAction('cheer');
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      setShimejiAction('idle');
    }, 840);

    // 随机获取台词与动作
    const quote = getRandomPokeQuote(bubbleText ?? undefined);
    setPose(quote.pose);
    showBubble(quote.text);
  }, [bubbleText, showBubble]);

  // 抓起与拖拽交互状态转换
  const startDragAction = useCallback((direction: 'left' | 'right' | 'hang' = 'hang') => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (direction === 'left') setShimejiAction('drag_left');
    else if (direction === 'right') setShimejiAction('drag_right');
    else setShimejiAction('drag_hang');
  }, []);

  const updateDragDirection = useCallback((direction: 'left' | 'right' | 'hang') => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    if (direction === 'left') setShimejiAction('drag_left');
    else if (direction === 'right') setShimejiAction('drag_right');
    else setShimejiAction('drag_hang');
  }, []);

  const endDragAction = useCallback(() => {
    setShimejiAction('land');
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    actionTimerRef.current = setTimeout(() => {
      setShimejiAction('idle');
    }, 280);
  }, []);

  const handleActionComplete = useCallback(() => {
    setShimejiAction((prev) => {
      if (prev === 'land' || prev === 'cheer') {
        return 'idle';
      }
      return prev;
    });
  }, []);

  // 待机自动随机动画分支（每隔 8~16 秒随机变换小动作，像天选姬一样活泼灵动）
  useEffect(() => {
    if (minimized || !petEnabled || petStyle !== 'animated') return;

    const scheduleNextIdle = () => {
      const delay = Math.random() * 8000 + 8000;
      return setTimeout(() => {
        setShimejiAction((curr) => {
          if (curr === 'idle') {
            const hour = new Date().getHours();
            const rand = Math.random();
            let candidate: ShimejiAction = 'sit';
            let duration = 4800;

            if (hour >= 23 || hour < 6) {
              candidate = rand < 0.7 ? 'sleep' : 'sit';
              duration = 5500;
            } else {
              if (rand < 0.4) {
                candidate = 'sit'; // 乖巧坐下向主人挥手
                duration = 4800;
              } else if (rand < 0.75) {
                candidate = 'walk'; // 快乐漫步踏步
                duration = 3800;
              } else {
                candidate = 'cheer'; // 突发开心比耶跳跃
                duration = 840;
              }
            }

            if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
            actionTimerRef.current = setTimeout(() => {
              setShimejiAction('idle');
            }, duration);

            return candidate;
          }
          return curr;
        });
        idleTimerRef.current = scheduleNextIdle();
      }, delay);
    };

    idleTimerRef.current = scheduleNextIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, [minimized, petEnabled, petStyle]);

  const toggleMinimized = useCallback(() => {
    setMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('miku_pet_minimized', String(next));
      } catch {
        /* ignore */
      }
      if (next) hideBubble();
      return next;
    });
  }, [hideBubble]);

  const updatePosition = useCallback((pos: PetPosition | null) => {
    setPosition(pos);
  }, []);

  const persistPosition = useCallback((pos: PetPosition | null) => {
    setPosition(pos);
    try {
      if (pos) {
        localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos));
      } else {
        localStorage.removeItem(STORAGE_KEY_POS);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const resetPosition = useCallback(() => {
    persistPosition(null);
  }, [persistPosition]);

  return {
    isMiku,
    enabled: petEnabled,
    size: petSize,
    style: petStyle,
    pose,
    shimejiAction,
    minimized,
    position,
    bubbleText,
    bubbleVisible,
    isJelly,
    poke,
    showBubble,
    hideBubble,
    toggleMinimized,
    updatePosition,
    persistPosition,
    resetPosition,
    startDragAction,
    updateDragDirection,
    endDragAction,
    handleActionComplete,
    setPetEnabled: (val: boolean) => setSetting('petEnabled', val),
    setPetSize: (val: number) => setSetting('petSize', val),
    setPetStyle: (val: PetStyle) => setSetting('petStyle', val),
  };
}
