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

const STORAGE_KEY_POS = 'miku_pet_pos';

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
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [isJelly, setIsJelly] = useState(false);

  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jellyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // 随机获取台词与动作
    const quote = getRandomPokeQuote(bubbleText ?? undefined);
    setPose(quote.pose);
    showBubble(quote.text);
  }, [bubbleText, showBubble]);

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
    updatePosition(null);
  }, [updatePosition]);

  return {
    isMiku,
    enabled: petEnabled,
    size: petSize,
    pose,
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
    resetPosition,
    setPetEnabled: (val: boolean) => setSetting('petEnabled', val),
    setPetSize: (val: number) => setSetting('petSize', val),
  };
}
