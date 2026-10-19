import type { Card, Problem } from './types';
import { learningDayEnd } from './time';

export interface QueueOptions {
  now: number;
  /** 每日新题上限，默认 30；0 表示不限 */
  newLimit?: number;
  subjectId?: string;
  /** 按科目轮转打散，默认开启 */
  interleave?: boolean;
}

export interface QueueItem {
  problem: Problem;
  card: Card;
  overdueDays: number;
}

export function buildQueue(problems: Problem[], cards: Card[], opts: QueueOptions): QueueItem[] {
  const { now, newLimit = 30, subjectId, interleave = true } = opts;
  const end = learningDayEnd(now);
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));

  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];

  for (const p of problems) {
    if (p.archivedAt) continue;
    if (subjectId && p.subjectId !== subjectId) continue;
    const c = cardMap.get(p.id);
    if (!c || c.due > end) continue;
    const overdueDays = Math.max(0, Math.floor((end - c.due) / 86400000));
    const item: QueueItem = { problem: p, card: c, overdueDays };
    if (c.state === 0) fresh.push(item);
    else due.push(item);
  }

  due.sort(
    (a, b) =>
      b.overdueDays - a.overdueDays ||
      b.problem.difficulty - a.problem.difficulty ||
      a.card.due - b.card.due
  );
  fresh.sort((a, b) => a.problem.createdAt - b.problem.createdAt);

  const limitedFresh = newLimit === 0 ? fresh : fresh.slice(0, newLimit);
  const all = [...due, ...limitedFresh];

  return interleave ? interleaveBySubject(all) : all;
}

function interleaveBySubject(items: QueueItem[]): QueueItem[] {
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
