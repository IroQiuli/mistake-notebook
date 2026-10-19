import type { Card, Chapter, Problem, ReviewLog } from './types';
import { dayKey, learningDayStart } from './time';
import { retrievability } from './scheduler';

const DAY = 24 * 3600 * 1000;

export interface DayCount {
  key: string;
  /** 当天学习日的起点（04:00） */
  ts: number;
  count: number;
}

/** 最近 days 个学习日的复习次数，按时间正序 */
export function dailyCounts(
  logs: Pick<ReviewLog, 'reviewedAt'>[],
  now: number,
  days: number
): DayCount[] {
  const map = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(log.reviewedAt);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const end = learningDayStart(now);
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const ts = d.getTime();
    const key = dayKey(ts);
    out.push({ key, ts, count: map.get(key) ?? 0 });
  }
  return out;
}

export interface ForecastDay {
  offset: number;
  label: string;
  date: string;
  count: number;
}

/** 未来 days 天的到期题量；逾期与今天合并到第 0 天 */
export function forecast(
  cards: Card[],
  problems: Problem[],
  now: number,
  days = 14
): ForecastDay[] {
  const active = new Set(problems.filter((p) => !p.archivedAt).map((p) => p.id));
  const today = learningDayStart(now);
  const buckets = new Array<number>(days).fill(0);

  for (const card of cards) {
    if (!active.has(card.problemId)) continue;
    const offset = Math.round((learningDayStart(card.due) - today) / DAY);
    if (offset <= 0) buckets[0]++;
    else if (offset < days) buckets[offset]++;
  }

  return buckets.map((count, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      offset: i,
      label: i === 0 ? '今天' : i === 1 ? '明天' : `${i}天`,
      date: dayKey(d.getTime()),
      count,
    };
  });
}

export interface ChapterMastery {
  chapterId: string;
  chapterName: string;
  subjectId: string;
  total: number;
  archived: number;
  due: number;
  /** 0–1，已掌握的题按 1 计 */
  retention: number;
}

/**
 * 章节掌握度 = 该章节所有题目的平均记忆保持率（FSRS 预测「现在还记得」的概率）。
 * 已归档的题视为 100%。只返回有题目的章节。
 */
export function chapterMastery(
  problems: Problem[],
  cards: Card[],
  chapters: Chapter[],
  now: number
): ChapterMastery[] {
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));
  const byChapter = new Map<string, Problem[]>();
  for (const p of problems) {
    const list = byChapter.get(p.chapterId) ?? [];
    list.push(p);
    byChapter.set(p.chapterId, list);
  }

  const end = learningDayStart(now) + DAY;
  const out: ChapterMastery[] = [];

  for (const chapter of chapters) {
    const list = byChapter.get(chapter.id);
    if (!list || list.length === 0) continue;

    let sum = 0;
    let archived = 0;
    let due = 0;
    for (const p of list) {
      const card = cardMap.get(p.id);
      if (p.archivedAt) {
        archived++;
        sum += 1;
        continue;
      }
      sum += card ? retrievability(card, now) : 0;
      if (card && card.due <= end) due++;
    }

    out.push({
      chapterId: chapter.id,
      chapterName: chapter.name,
      subjectId: chapter.subjectId,
      total: list.length,
      archived,
      due,
      retention: list.length ? sum / list.length : 0,
    });
  }

  return out.sort((a, b) => a.retention - b.retention || b.total - a.total);
}

/** 所有未掌握题目的平均保持率 */
export function overallRetention(problems: Problem[], cards: Card[], now: number): number {
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));
  let sum = 0;
  let n = 0;
  for (const p of problems) {
    if (p.archivedAt) continue;
    const card = cardMap.get(p.id);
    sum += card ? retrievability(card, now) : 0;
    n++;
  }
  return n ? sum / n : 0;
}

export function ratingDistribution(
  logs: Pick<ReviewLog, 'rating' | 'reviewedAt'>[],
  since: number
): Record<1 | 2 | 3 | 4, number> {
  const out: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const log of logs) {
    if (log.reviewedAt < since) continue;
    if (log.rating >= 1 && log.rating <= 4) out[log.rating as 1 | 2 | 3 | 4]++;
  }
  return out;
}

/** 连续复习天数：今天没复习则从昨天起算 */
export function calcStreak(logs: Pick<ReviewLog, 'reviewedAt'>[], now: number): number {
  const keys = new Set(logs.map((l) => dayKey(l.reviewedAt)));
  let streak = 0;
  let cursor = learningDayStart(now);
  if (!keys.has(dayKey(cursor))) {
    cursor -= DAY;
  }
  while (keys.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY;
  }
  return streak;
}

export interface AccuracyBucket {
  id: string;
  name: string;
  /** 参与统计的评分次数 */
  total: number;
  /** 评为「记得 / 熟练」的次数 */
  remembered: number;
  /** 0–1 */
  rate: number;
  color?: string;
}

function finishBucket(bucket: AccuracyBucket): AccuracyBucket {
  bucket.rate = bucket.total ? bucket.remembered / bucket.total : 0;
  return bucket;
}

function accumulate(
  logs: Pick<ReviewLog, 'problemId' | 'rating' | 'reviewedAt'>[],
  problems: Problem[],
  since: number,
  buckets: Map<string, AccuracyBucket>,
  keyOf: (p: Problem) => string | undefined
): AccuracyBucket[] {
  const problemMap = new Map(problems.map((p) => [p.id, p]));

  for (const log of logs) {
    if (log.reviewedAt < since) continue;
    if (log.rating < 1 || log.rating > 4) continue;
    const problem = problemMap.get(log.problemId);
    if (!problem) continue;
    const key = keyOf(problem);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.total++;
    if (log.rating >= 3) bucket.remembered++;
  }

  return [...buckets.values()].filter((b) => b.total > 0).map(finishBucket);
}

/**
 * 按科目统计「回忆正确率」：自评「记得 / 熟练」算答对。
 * 只统计 since 之后的评分，并且题目必须仍然存在。
 */
export function accuracyBySubject(
  logs: Pick<ReviewLog, 'problemId' | 'rating' | 'reviewedAt'>[],
  problems: Problem[],
  subjects: { id: string; name: string; color: string }[],
  since: number
): AccuracyBucket[] {
  const buckets = new Map<string, AccuracyBucket>(
    subjects.map((s) => [s.id, { id: s.id, name: s.name, total: 0, remembered: 0, rate: 0, color: s.color }])
  );
  return accumulate(logs, problems, since, buckets, (p) => p.subjectId).sort(
    (a, b) => a.rate - b.rate || b.total - a.total
  );
}

/** 按章节统计正确率，用于科目下钻 */
export function accuracyByChapter(
  logs: Pick<ReviewLog, 'problemId' | 'rating' | 'reviewedAt'>[],
  problems: Problem[],
  chapters: Chapter[],
  since: number
): AccuracyBucket[] {
  const buckets = new Map<string, AccuracyBucket>(
    chapters.map((c) => [c.id, { id: c.id, name: c.name, total: 0, remembered: 0, rate: 0 }])
  );
  return accumulate(logs, problems, since, buckets, (p) => p.chapterId);
}

/** 错因分布：统计未掌握题目上的标签数量，按数量降序 */
export function errorTagDistribution(problems: Problem[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of problems) {
    if (p.archivedAt) continue;
    for (const tag of p.errorTags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** 指定科目下、某学习日到期的题目（首页「N 天后」用） */export function problemsDueOn(
  problems: Problem[],
  cards: Card[],
  offsetDays: number,
  now: number
): Problem[] {
  const dayStart = learningDayStart(now) + offsetDays * DAY;
  const dayEnd = dayStart + DAY;
  const cardMap = new Map(cards.map((c) => [c.problemId, c]));
  return problems.filter((p) => {
    if (p.archivedAt) return false;
    const card = cardMap.get(p.id);
    return Boolean(card && card.due >= dayStart && card.due < dayEnd);
  });
}
