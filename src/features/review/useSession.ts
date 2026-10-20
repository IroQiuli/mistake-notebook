import { useCallback, useEffect, useMemo, useState } from 'react';
import { newId } from '../../lib/id';
import { db } from '../../storage/db';
import { buildQueue, type QueueItem } from '../../domain/queue';
import { applyRating } from '../../domain/scheduler';
import { adjustWeight, weightOf } from '../../domain/weight';
import type { Rating } from '../../domain/types';

export interface SessionStats {
  rating: Rating;
  ms: number;
}

/**
 * @param subjectId 只复习某个科目（首页的科目入口 / 复习页顶部切换）
 * @param paperIds  套卷模式的题目顺序；传了就不看到期状态，按给定顺序逐题做
 */
export function useSession(subjectId?: string, paperIds?: string[] | null) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<SessionStats[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [shownAt, setShownAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (paperIds && paperIds.length > 0) {
        const [problems, cards] = await Promise.all([db.problems.toArray(), db.cards.toArray()]);
        const pMap = new Map(problems.map((p) => [p.id, p]));
        const cMap = new Map(cards.map((c) => [c.problemId, c]));
        const items: QueueItem[] = [];
        for (const id of paperIds) {
          const p = pMap.get(id);
          const c = cMap.get(id);
          if (p && c) items.push({ problem: p, card: c, overdueDays: 0 });
        }
        if (!cancelled) {
          setQueue(items);
          setShownAt(Date.now());
        }
        return;
      }

      const [problems, cards] = await Promise.all([db.problems.toArray(), db.cards.toArray()]);
      const built = buildQueue(problems, cards, { now: Date.now(), subjectId });
      if (!cancelled) {
        setQueue(built);
        setShownAt(Date.now());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, paperIds]);

  const current = queue?.[index];
  const finished = queue !== null && index >= queue.length;

  const reveal = useCallback(() => {
    setRevealed(true);
    setShownAt(Date.now());
  }, []);

  /** 上一题 / 下一题：只移动指针，不改任何数据 */
  const jump = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = i + delta;
        if (!queue || next < 0) return i;
        return Math.min(queue.length, next);
      });
      setRevealed(false);
      setShownAt(Date.now());
    },
    [queue]
  );

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current) return;
      const now = Date.now();
      const weight = weightOf(current.problem);
      const result = applyRating(current.card, rating, now, weight);
      const nextWeight = adjustWeight(weight, rating);
      const durationMs = now - shownAt;

      await db.transaction('rw', db.cards, db.reviewLogs, db.problems, async () => {
        await db.cards.put(result.card);
        await db.problems.update(current.problem.id, { weight: nextWeight });
        await db.reviewLogs.add({
          id: newId(),
          problemId: current.problem.id,
          rating,
          reviewedAt: now,
          durationMs,
          prevDue: result.prevDue,
          nextDue: result.nextDue,
          prevState: result.prevState,
          nextState: result.card.state,
        });
      });

      setStats((prev) => [...prev, { rating, ms: durationMs }]);
      setRevealed(false);
      setIndex((i) => i + 1);
      setShownAt(Date.now());
    },
    [current, shownAt]
  );

  const summary = useMemo(() => {
    const counts: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const s of stats) counts[s.rating]++;
    return {
      total: stats.length,
      counts,
      durationMs: (stats.length ? Date.now() : startedAt) - startedAt,
    };
  }, [stats, startedAt]);

  return { queue, index, current, revealed, finished, stats, summary, reveal, rate, jump };
}
