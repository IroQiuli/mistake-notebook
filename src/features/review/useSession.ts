import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../../lib/id';
import { db, getSetting } from '../../storage/db';
import {
  buildQueue,
  getTodayReviewedBySubject,
  getTodayReviewedIds,
  type QueueItem,
} from '../../domain/queue';
import { applyRating } from '../../domain/scheduler';
import { adjustWeight, weightOf } from '../../domain/weight';
import type { Mastery, Rating } from '../../domain/types';

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

      const [problems, cards, logs, subjectGoals, dailyGoal] = await Promise.all([
        db.problems.toArray(),
        db.cards.toArray(),
        db.reviewLogs.toArray(),
        getSetting<Record<string, number>>('subjectGoals', {}),
        getSetting<number>('dailyGoal', 20),
      ]);

      const now = Date.now();
      const pMap = new Map(problems.map((p) => [p.id, p]));
      const reviewedTodayIds = getTodayReviewedIds(logs, now);
      const reviewedBySubject = getTodayReviewedBySubject(logs, pMap, now);

      const quotas: Record<string, number> = {};
      for (const [sid, n] of Object.entries(subjectGoals ?? {})) {
        if (Number.isFinite(n)) quotas[sid] = n;
      }
      const quotaSubjects = Object.keys(quotas).filter((sid) => (quotas[sid] ?? 0) > 0);
      const sum = quotaSubjects.reduce((s, sid) => s + (quotas[sid] ?? 0), 0);
      const plan = sum > 0 ? sum : dailyGoal;

      const built = buildQueue(problems, cards, {
        now,
        subjectId,
        quotas: quotaSubjects.length ? quotas : undefined,
        limit: plan,
        reviewedTodayIds,
        reviewedCounts: reviewedBySubject,
      });

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
  const finished =
    queue !== null &&
    ((queue.length === 0 && stats.length > 0) || (queue.length > 0 && index >= queue.length));

  const reveal = useCallback(() => {
    setRevealed(true);
    // 不重置 shownAt，保留从题目呈现开始累计的真实做题耗时
  }, []);

  /** 上一题 / 下一题：只移动指针，不改任何数据 */
  const jump = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = i + delta;
        if (!queue || next < 0) return i;
        return Math.min(Math.max(0, queue.length - 1), next);
      });
      setRevealed(false);
      setShownAt(Date.now());
    },
    [queue]
  );

  const ratingLockRef = useRef(false);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current || ratingLockRef.current) return;
      ratingLockRef.current = true;
      try {
        const targetId = current.problem.id;
        const now = Date.now();
        const weight = weightOf(current.problem);
        const result = applyRating(current.card, rating, now, weight);
        const nextWeight = adjustWeight(weight, rating);
        const durationMs = Math.max(1000, now - shownAt);

        await db.transaction('rw', db.cards, db.reviewLogs, db.problems, async () => {
          await db.cards.put(result.card);
          await db.problems.update(targetId, { weight: nextWeight });
          await db.reviewLogs.add({
            id: newId(),
            problemId: targetId,
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

        // 本轮做题中，点击四档按钮中任意一个即在本次做题界面立即移除该题（按 problem.id 精准剔除）
        setQueue((prev) => {
          if (!prev) return null;
          const next = prev.filter((item) => item.problem.id !== targetId);
          // 若处于队列末尾或队列长度缩水，立即在同一批次更新中修正指针
          setIndex((i) => {
            if (next.length === 0) return 0;
            return Math.min(i, next.length - 1);
          });
          return next;
        });

        setShownAt(Date.now());
      } finally {
        ratingLockRef.current = false;
      }
    },
    [current, shownAt]
  );

  /** 复习中即时修改或清空错因备注 */
  const updateCurrentNote = useCallback(
    async (wrongNote: string) => {
      if (!current) return;
      const now = Date.now();
      await db.problems.update(current.problem.id, { wrongNote, updatedAt: now });
      setQueue((prev) =>
        prev
          ? prev.map((item, idx) =>
              idx === index
                ? { ...item, problem: { ...item.problem, wrongNote, updatedAt: now } }
                : item
            )
          : prev
      );
    },
    [current, index]
  );

  /** 复习中即时调整掌握程度 */
  const updateCurrentMastery = useCallback(
    async (mastery?: Mastery) => {
      if (!current) return;
      const now = Date.now();
      await db.problems.update(current.problem.id, { mastery, updatedAt: now });
      setQueue((prev) =>
        prev
          ? prev.map((item, idx) =>
              idx === index
                ? { ...item, problem: { ...item.problem, mastery, updatedAt: now } }
                : item
            )
          : prev
      );
    },
    [current, index]
  );

  /** 复习中删除某张答案图片 */
  const deleteCurrentAnswerAsset = useCallback(
    async (assetId: string) => {
      if (!current) return;
      const nextIds = current.problem.answerAssetIds.filter((id) => id !== assetId);
      const now = Date.now();
      await db.problems.update(current.problem.id, {
        answerAssetIds: nextIds,
        updatedAt: now,
      });
      setQueue((prev) =>
        prev
          ? prev.map((item, idx) =>
              idx === index
                ? {
                    ...item,
                    problem: { ...item.problem, answerAssetIds: nextIds, updatedAt: now },
                  }
                : item
            )
          : prev
      );
    },
    [current, index]
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

  return {
    queue,
    index,
    current,
    revealed,
    finished,
    stats,
    summary,
    reveal,
    rate,
    jump,
    updateCurrentNote,
    updateCurrentMastery,
    deleteCurrentAnswerAsset,
  };
}
