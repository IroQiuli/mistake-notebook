import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../../storage/db';
import { buildQueue, type QueueItem } from '../../domain/queue';
import { applyRating } from '../../domain/scheduler';
import type { Rating } from '../../domain/types';

export interface SessionStats {
  rating: Rating;
  ms: number;
}

export function useSession(subjectId?: string) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState<SessionStats[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [shownAt, setShownAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [problems, cards] = await Promise.all([
        db.problems.toArray(),
        db.cards.toArray(),
      ]);
      const built = buildQueue(problems, cards, { now: Date.now(), subjectId });
      if (!cancelled) {
        setQueue(built);
        setShownAt(Date.now());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const current = queue?.[index];
  const finished = queue !== null && index >= queue.length;

  const reveal = useCallback(() => {
    setRevealed(true);
    setShownAt(Date.now());
  }, []);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current) return;
      const now = Date.now();
      const result = applyRating(current.card, rating, now);
      const durationMs = now - shownAt;

      await db.transaction('rw', db.cards, db.reviewLogs, async () => {
        await db.cards.put(result.card);
        await db.reviewLogs.add({
          id: crypto.randomUUID(),
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

  return { queue, index, current, revealed, finished, stats, summary, reveal, rate };
}
