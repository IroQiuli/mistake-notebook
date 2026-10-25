import type { Chapter, Problem, ReviewLog, Subject } from './types';
import { dayKey, formatDuration, learningDayStart } from './time';
import { displayTitle } from './title';

export type RatingFilter = 'all' | 'weak' | 'good' | 'rescheduled';

export interface EnrichedReviewLog extends ReviewLog {
  problem?: Problem;
  chapter?: Chapter;
  subject?: Subject;
  title: string;
}

export interface HistoryFilterOptions {
  subjectId?: string;
  ratingFilter?: RatingFilter;
  keyword?: string;
  since?: number;
  until?: number;
}

export interface HistoryDayGroup {
  dayKey: string;
  dayStartTs: number;
  label: string;
  fullDateStr: string;
  logs: EnrichedReviewLog[];
  totalCount: number;
  rememberedCount: number;
  weakCount: number;
  rescheduledCount: number;
  totalDurationMs: number;
  accuracyRate: number;
}

export interface HistoryOverview {
  totalReviews: number;
  uniqueProblems: number;
  activeDays: number;
  totalDurationMs: number;
  formattedDuration: string;
  rememberedCount: number;
  weakCount: number;
  rescheduledCount: number;
  overallAccuracy: number;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatRelativeDay(ts: number, now: number): { label: string; fullDateStr: string } {
  const dayStart = learningDayStart(ts);
  const todayStart = learningDayStart(now);
  const diffDays = Math.round((todayStart - dayStart) / (24 * 3600 * 1000));

  const d = new Date(dayStart);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  const fullDateStr = `${d.getFullYear()}年${m}月${day}日 ${weekday}`;

  let label: string;
  if (diffDays === 0) {
    label = '今天';
  } else if (diffDays === 1) {
    label = '昨天';
  } else if (diffDays === 2) {
    label = '前天';
  } else {
    label = `${m}月${day}日 ${weekday}`;
  }

  return { label, fullDateStr };
}

/** 关联题目、章节、科目信息，生成丰富日志 */
export function enrichReviewLogs(
  logs: ReviewLog[],
  problemMap: Map<string, Problem>,
  chapterMap: Map<string, Chapter>,
  subjectMap: Map<string, Subject>
): EnrichedReviewLog[] {
  return logs.map((log) => {
    const problem = problemMap.get(log.problemId);
    const chapter = problem ? chapterMap.get(problem.chapterId) : undefined;
    const subject = problem ? subjectMap.get(problem.subjectId) : undefined;
    const title = problem ? displayTitle(problem, chapter?.name) : '已删除题目';

    return {
      ...log,
      problem,
      chapter,
      subject,
      title,
    };
  });
}

/** 过滤复习日志 */
export function filterReviewLogs(
  logs: EnrichedReviewLog[],
  options: HistoryFilterOptions = {}
): EnrichedReviewLog[] {
  const { subjectId, ratingFilter = 'all', keyword, since, until } = options;
  const kw = keyword?.trim().toLowerCase();

  return logs.filter((log) => {
    if (since && log.reviewedAt < since) return false;
    if (until && log.reviewedAt > until) return false;

    if (subjectId && log.problem?.subjectId !== subjectId) {
      return false;
    }

    if (ratingFilter === 'weak') {
      if (log.rating !== 1 && log.rating !== 2) return false;
    } else if (ratingFilter === 'good') {
      if (log.rating !== 3 && log.rating !== 4) return false;
    } else if (ratingFilter === 'rescheduled') {
      if (log.rating !== 0) return false;
    }

    if (kw) {
      const matchTitle = log.title.toLowerCase().includes(kw);
      const matchNote = log.problem?.wrongNote?.toLowerCase().includes(kw);
      const matchTags = log.problem?.errorTags?.some((t) => t.toLowerCase().includes(kw));
      const matchChapter = log.chapter?.name.toLowerCase().includes(kw);
      const matchSubject = log.subject?.name.toLowerCase().includes(kw);
      if (!matchTitle && !matchNote && !matchTags && !matchChapter && !matchSubject) {
        return false;
      }
    }

    return true;
  });
}

/** 按学习日降序聚合复习日志 */
export function groupReviewLogsByDay(
  logs: EnrichedReviewLog[],
  now = Date.now()
): HistoryDayGroup[] {
  const groupsMap = new Map<string, { dayStartTs: number; logs: EnrichedReviewLog[] }>();

  for (const log of logs) {
    const key = dayKey(log.reviewedAt);
    const existing = groupsMap.get(key);
    if (existing) {
      existing.logs.push(log);
    } else {
      groupsMap.set(key, {
        dayStartTs: learningDayStart(log.reviewedAt),
        logs: [log],
      });
    }
  }

  const groups: HistoryDayGroup[] = [];

  for (const [key, { dayStartTs, logs: dayLogs }] of groupsMap.entries()) {
    // 日志按时间倒序排列
    dayLogs.sort((a, b) => b.reviewedAt - a.reviewedAt);

    let rememberedCount = 0;
    let weakCount = 0;
    let rescheduledCount = 0;
    let totalDurationMs = 0;

    for (const l of dayLogs) {
      if (l.rating === 3 || l.rating === 4) {
        rememberedCount++;
      } else if (l.rating === 1 || l.rating === 2) {
        weakCount++;
      } else if (l.rating === 0) {
        rescheduledCount++;
      }
      totalDurationMs += l.durationMs ?? 0;
    }

    const ratedCount = rememberedCount + weakCount;
    const accuracyRate = ratedCount > 0 ? rememberedCount / ratedCount : 0;
    const { label, fullDateStr } = formatRelativeDay(dayStartTs, now);

    groups.push({
      dayKey: key,
      dayStartTs,
      label,
      fullDateStr,
      logs: dayLogs,
      totalCount: dayLogs.length,
      rememberedCount,
      weakCount,
      rescheduledCount,
      totalDurationMs,
      accuracyRate,
    });
  }

  // 日期从最近到最早排序
  return groups.sort((a, b) => b.dayStartTs - a.dayStartTs);
}

/** 计算做题记录整体概览统计 */
export function calcHistoryOverview(
  logs: EnrichedReviewLog[]
): HistoryOverview {
  const daySet = new Set<string>();
  const problemSet = new Set<string>();
  let rememberedCount = 0;
  let weakCount = 0;
  let rescheduledCount = 0;
  let totalDurationMs = 0;

  for (const l of logs) {
    daySet.add(dayKey(l.reviewedAt));
    problemSet.add(l.problemId);
    if (l.rating === 3 || l.rating === 4) {
      rememberedCount++;
    } else if (l.rating === 1 || l.rating === 2) {
      weakCount++;
    } else if (l.rating === 0) {
      rescheduledCount++;
    }
    totalDurationMs += l.durationMs ?? 0;
  }

  const ratedCount = rememberedCount + weakCount;
  const overallAccuracy = ratedCount > 0 ? rememberedCount / ratedCount : 0;

  return {
    totalReviews: logs.length,
    uniqueProblems: problemSet.size,
    activeDays: daySet.size,
    totalDurationMs,
    formattedDuration: formatDuration(totalDurationMs),
    rememberedCount,
    weakCount,
    rescheduledCount,
    overallAccuracy,
  };
}
