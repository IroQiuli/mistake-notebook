import type { Card, Problem, ReviewLog } from './types';
import { dayDiff, dayKey, learningDayEnd, learningDayStart } from './time';
import { weightOf } from './weight';

export interface QueueOptions {
  now: number;
  /** 每日新题上限，默认 30；0 表示不限 */
  newLimit?: number;
  subjectId?: string;
  /** 按科目轮转打散，默认开启 */
  interleave?: boolean;
  /**
   * 每科每日题量：{ subjectId: 数量 }。
   * - 设了数量的科目：只取这么多，不够时按「最快到期」补未到期的题（auto 标记）
   * - 没出现在表里的科目：保持旧行为（所有到期题都进来）
   * - 数量为 0：今天不做这一科
   */
  quotas?: Record<string, number>;
  /**
   * 今日队列总量上限：没配每科题量时用它把「今天要写的」压在目标以内，
   * 超出的到期题顺延到明天（不会丢，只是不进今天的队列）。
   */
  limit?: number;
  /** 今天已经复习过的题目 ID 集合：从今日待写队列中彻底排除 */
  reviewedTodayIds?: Set<string>;
  /** 今天每个科目已复习题数：用于抵扣今日配额，已做满的科目不再补题 */
  reviewedCounts?: Record<string, number>;
}

export interface QueueItem {
  problem: Problem;
  card: Card;
  overdueDays: number;
  /** 为了凑够每日题量而提前拉进来的题 */
  auto?: boolean;
}

/**
 * 判断一张卡片是否属于「昨日或以往没写完顺延到今天」的错题：
 * 1. 到期日早于今天 (diff < 0)；
 * 2. 且在到期日当天及之后未作答过（若上次作答时间 >= 到期日所在学习日开始时间，说明该题当时已经做完，绝非没写完顺延）。
 */
export function isOverdueUnfinished(c: Card, now: number): boolean {
  const diff = dayDiff(c.due, now);
  if (diff >= 0) return false;
  // 新卡片（从未复习过），到期日早于今天，属于没做完顺延
  if (!c.lastReview || c.reps === 0) return true;
  // 复习过的卡片，只有上次复习时间早于该到期日开始时间，才算到期后一直没写
  return c.lastReview < learningDayStart(c.due);
}

export function buildQueue(problems: Problem[], cards: Card[], opts: QueueOptions): QueueItem[] {
  const {
    now,
    newLimit = 30,
    subjectId,
    interleave = true,
    quotas,
    limit,
    reviewedTodayIds,
    reviewedCounts,
  } = opts;
  const end = learningDayEnd(now);
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));

  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];
  const later: QueueItem[] = [];

  for (const p of problems) {
    if (p.archivedAt) continue;
    if (subjectId && p.subjectId !== subjectId) continue;
    // 今天已经做过的题目，无论评分是记得还是忘记，均已完成今日复习，不进今日待写
    if (reviewedTodayIds && reviewedTodayIds.has(p.id)) continue;
    const c = cardMap.get(p.id);
    if (!c) continue;
    const diff = dayDiff(c.due, now);
    const overdueDays = isOverdueUnfinished(c, now) ? -diff : 0;
    const item: QueueItem = { problem: p, card: c, overdueDays };
    if (c.due > end) {
      later.push(item);
    } else if (overdueDays > 0) {
      // 逾期错题（昨日或更早未做完）：顺延到今天优先处理，不作为普通新题排后
      due.push(item);
    } else if (c.state === 0) {
      fresh.push(item);
    } else {
      due.push(item);
    }
  }

  sortDue(due);
  fresh.sort((a, b) => a.problem.createdAt - b.problem.createdAt);
  const limitedFresh = newLimit === 0 ? fresh : fresh.slice(0, newLimit);
  const duePool = [...due, ...limitedFresh];

  const hasQuotas = quotas && Object.keys(quotas).length > 0;
  let all = hasQuotas ? applyQuotas(duePool, later, quotas, reviewedCounts, now) : duePool;

  if (limit && limit > 0) {
    const todayDone = reviewedTodayIds ? reviewedTodayIds.size : 0;
    const remainingLimit = Math.max(0, limit - todayDone);
    if (all.length > remainingLimit) {
      all = all.slice(0, remainingLimit);
    }
  }

  return interleave ? interleaveBySubject(all) : all;
}

/** 到期题排序：逾期越久越靠前，其次更难、更早到期 */
function sortDue(items: QueueItem[]): void {
  items.sort(
    (a, b) =>
      b.overdueDays - a.overdueDays ||
      weightOf(a.problem) - weightOf(b.problem) ||
      b.problem.difficulty - a.problem.difficulty ||
      a.card.due - b.card.due
  );
}

/**
 * 按每科题量裁剪队列；不足的科目从「还没到期」的题里按未来排期从近到远（due 升序）补齐。
 * 补齐是提前把未来几天的题拿来做，不会打乱原有排期。
 * 严禁拉取昨天或今天刚做过的题（必须尊重其间隔），严禁拉取从未学过的新题。
 * 若提供了 reviewedCounts，则按 (quota - done) 扣减剩余待写题量，做满后不再拉题。
 */
function applyQuotas(
  duePool: QueueItem[],
  later: QueueItem[],
  quotas: Record<string, number>,
  reviewedCounts?: Record<string, number>,
  now?: number
): QueueItem[] {
  const yesterdayStart = now ? learningDayStart(now - 24 * 3600 * 1000) : 0;
  const bySubjectDue = new Map<string, QueueItem[]>();
  for (const it of duePool) {
    const arr = bySubjectDue.get(it.problem.subjectId) ?? [];
    arr.push(it);
    bySubjectDue.set(it.problem.subjectId, arr);
  }

  const bySubjectLater = new Map<string, QueueItem[]>();
  for (const it of later) {
    const arr = bySubjectLater.get(it.problem.subjectId) ?? [];
    arr.push(it);
    bySubjectLater.set(it.problem.subjectId, arr);
  }
  for (const arr of bySubjectLater.values()) {
    arr.sort((a, b) => a.card.due - b.card.due || a.card.stability - b.card.stability);
  }

  const subjects = new Set([...bySubjectDue.keys(), ...bySubjectLater.keys()]);
  const out: QueueItem[] = [];

  for (const sid of subjects) {
    const quota = quotas[sid];
    const dueList = bySubjectDue.get(sid) ?? [];

    if (quota === undefined) {
      out.push(...dueList);
      continue;
    }
    if (quota <= 0) continue;

    // 抵扣今天已完成的题量
    const done = reviewedCounts?.[sid] ?? 0;
    const remainingQuota = Math.max(0, quota - done);
    if (remainingQuota <= 0) {
      // 本科今日目标已达成，不再安排待写
      continue;
    }

    const taken = dueList.slice(0, remainingQuota);
    out.push(...taken);

    if (taken.length < remainingQuota) {
      // 严禁将以下卡片作为配额补齐（filler）拉入今日清单：
      // 1. 尚未经过初次复习的新题（state === 0）
      // 2. 昨天或今天刚做过的题（lastReview >= yesterdayStart）——必须尊重其排期间隔，严禁打乱排期乱塞到今天做！
      const eligibleLater = (bySubjectLater.get(sid) ?? []).filter((it) => {
        if (it.card.state !== undefined && it.card.state === 0) return false;
        if (yesterdayStart > 0 && it.card.lastReview && it.card.lastReview >= yesterdayStart) {
          return false;
        }
        return true;
      });
      const fillers = eligibleLater
        .slice(0, remainingQuota - taken.length)
        .map((it) => ({ ...it, auto: true }));
      out.push(...fillers);
    }
  }

  // 到期的整体排在「补齐的」前面；补齐题按未来排期 due 升序排列
  out.sort((a, b) => {
    if (Boolean(a.auto) !== Boolean(b.auto)) {
      return Number(Boolean(a.auto)) - Number(Boolean(b.auto));
    }
    if (a.auto && b.auto) {
      return a.card.due - b.card.due;
    }
    return 0;
  });
  return out;
}

function interleaveBySubject(items: QueueItem[]): QueueItem[] {
  // 分为三层：
  // 第 1 层：逾期错题（昨天及更早顺延下来的）最紧急，集中排在最前列优先处理
  const overdueItems = items.filter((it) => it.overdueDays > 0);
  // 第 2 层：今日正常到期错题，按科目轮转打散平摊认知精力
  const dueTodayItems = items.filter((it) => it.overdueDays === 0 && !it.auto);
  // 第 3 层：配额补齐错题（提前做未来几天的题），严禁打散插入今日到期题之前，严格按未来到期日升序排期依次完成
  const fillerItems = items.filter((it) => Boolean(it.auto));
  fillerItems.sort((a, b) => a.card.due - b.card.due || a.problem.createdAt - b.problem.createdAt);

  return [
    ...roundRobinBySubject(overdueItems),
    ...roundRobinBySubject(dueTodayItems),
    ...fillerItems,
  ];
}

function roundRobinBySubject(items: QueueItem[]): QueueItem[] {
  const buckets = new Map<string, QueueItem[]>();
  for (const it of items) {
    const arr = buckets.get(it.problem.subjectId) ?? [];
    arr.push(it);
    buckets.set(it.problem.subjectId, arr);
  }
  const order = [...buckets.keys()];
  const out: QueueItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const key of order) {
      const next = buckets.get(key)!.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

/** 提取今日已作答过的题目 ID 集合 */
export function getTodayReviewedIds(logs: ReviewLog[], now: number): Set<string> {
  const today = dayKey(now);
  const seen = new Set<string>();
  for (const l of logs) {
    if (l.rating === 0) continue;
    if (dayKey(l.reviewedAt) === today) {
      seen.add(l.problemId);
    }
  }
  return seen;
}

/** 统计今日每个科目已作答题数（按题目去重） */
export function getTodayReviewedBySubject(
  logs: ReviewLog[],
  problemMap: Map<string, Problem>,
  now: number
): Record<string, number> {
  const today = dayKey(now);
  const map: Record<string, number> = {};
  const seen = new Set<string>();
  for (const l of logs) {
    if (l.rating === 0) continue;
    if (dayKey(l.reviewedAt) !== today) continue;
    if (seen.has(l.problemId)) continue;
    seen.add(l.problemId);
    const p = problemMap.get(l.problemId);
    if (p) {
      map[p.subjectId] = (map[p.subjectId] ?? 0) + 1;
    }
  }
  return map;
}
