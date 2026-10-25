import { describe, it, expect } from 'vitest';
import {
  enrichReviewLogs,
  filterReviewLogs,
  groupReviewLogsByDay,
  calcHistoryOverview,
  formatRelativeDay,
} from './history';
import type { Chapter, Problem, ReviewLog, Subject } from './types';

const at = (s: string) => new Date(s).getTime();
const NOW = at('2026-10-25T14:00:00');

const dummyProblem = (id: string, subjectId: string, chapterId: string, wrongNote = ''): Problem =>
  ({
    id,
    subjectId,
    chapterId,
    topicIds: [],
    stemAssetId: `stem-${id}`,
    answerAssetIds: [],
    wrongNote,
    difficulty: 3,
    createdAt: NOW - 86400000,
    updatedAt: NOW - 86400000,
    errorTags: wrongNote.includes('概念') ? ['概念模糊'] : undefined,
  }) as Problem;

describe('history domain logic', () => {
  const subjects: Subject[] = [
    { id: 's1', name: '高等数学', color: '#39c5bb', order: 0, archived: 0 },
    { id: 's2', name: '839 自控', color: '#f97316', order: 1, archived: 0 },
  ];
  const chapters: Chapter[] = [
    { id: 'c1', subjectId: 's1', name: '极限与连续', order: 0 },
    { id: 'c2', subjectId: 's2', name: '传递函数', order: 0 },
  ];
  const problems = [
    dummyProblem('p1', 's1', 'c1', '极限求法概念模糊'),
    dummyProblem('p2', 's2', 'c2', '梅森公式代错'),
  ];

  const problemMap = new Map(problems.map((p) => [p.id, p]));
  const chapterMap = new Map(chapters.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const logs: ReviewLog[] = [
    {
      id: 'l1',
      problemId: 'p1',
      rating: 3,
      reviewedAt: at('2026-10-25T10:00:00'),
      durationMs: 45000,
      prevDue: NOW - 86400000,
      nextDue: NOW + 3 * 86400000,
      prevState: 1,
      nextState: 2,
    },
    {
      id: 'l2',
      problemId: 'p2',
      rating: 1,
      reviewedAt: at('2026-10-25T11:00:00'),
      durationMs: 65000,
      prevDue: NOW - 86400000,
      nextDue: NOW + 86400000,
      prevState: 2,
      nextState: 3,
    },
    {
      id: 'l3',
      problemId: 'p1',
      rating: 4,
      reviewedAt: at('2026-10-24T15:00:00'),
      durationMs: 30000,
      prevDue: NOW - 2 * 86400000,
      nextDue: NOW + 5 * 86400000,
      prevState: 1,
      nextState: 2,
    },
  ];

  it('enrichReviewLogs 能够正确关联题目、科目和章节', () => {
    const enriched = enrichReviewLogs(logs, problemMap, chapterMap, subjectMap);
    expect(enriched).toHaveLength(3);
    expect(enriched[0].problem?.id).toBe('p1');
    expect(enriched[0].chapter?.name).toBe('极限与连续');
    expect(enriched[0].subject?.name).toBe('高等数学');
    expect(enriched[0].title).toContain('极限与连续');
  });

  it('filterReviewLogs 支持科目筛选', () => {
    const enriched = enrichReviewLogs(logs, problemMap, chapterMap, subjectMap);
    const s1Only = filterReviewLogs(enriched, { subjectId: 's1' });
    expect(s1Only).toHaveLength(2);
    expect(s1Only.every((l) => l.subject?.id === 's1')).toBe(true);
  });

  it('filterReviewLogs 支持评分状态筛选 (weak / good / rescheduled)', () => {
    const enriched = enrichReviewLogs(logs, problemMap, chapterMap, subjectMap);
    const weak = filterReviewLogs(enriched, { ratingFilter: 'weak' });
    expect(weak).toHaveLength(1);
    expect(weak[0].rating).toBe(1);

    const good = filterReviewLogs(enriched, { ratingFilter: 'good' });
    expect(good).toHaveLength(2);
    expect(good.map((g) => g.rating)).toEqual([3, 4]);
  });

  it('filterReviewLogs 支持关键字模糊搜索 (标题/错因/标签)', () => {
    const enriched = enrichReviewLogs(logs, problemMap, chapterMap, subjectMap);
    const res = filterReviewLogs(enriched, { keyword: '梅森' });
    expect(res).toHaveLength(1);
    expect(res[0].problem?.id).toBe('p2');

    const res2 = filterReviewLogs(enriched, { keyword: '概念模糊' });
    expect(res2).toHaveLength(2);
  });

  it('groupReviewLogsByDay 能够按学习日正确分组并计算指标', () => {
    const enriched = enrichReviewLogs(logs, problemMap, chapterMap, subjectMap);
    const groups = groupReviewLogsByDay(enriched, NOW);
    expect(groups).toHaveLength(2);

    const todayGroup = groups[0];
    expect(todayGroup.label).toBe('今天');
    expect(todayGroup.totalCount).toBe(2);
    expect(todayGroup.rememberedCount).toBe(1);
    expect(todayGroup.weakCount).toBe(1);
    expect(todayGroup.accuracyRate).toBe(0.5);
    expect(todayGroup.totalDurationMs).toBe(110000);

    const yesterdayGroup = groups[1];
    expect(yesterdayGroup.label).toBe('昨天');
    expect(yesterdayGroup.totalCount).toBe(1);
    expect(yesterdayGroup.rememberedCount).toBe(1);
    expect(yesterdayGroup.weakCount).toBe(0);
    expect(yesterdayGroup.accuracyRate).toBe(1.0);
  });

  it('calcHistoryOverview 能够准确统计全局做题概览', () => {
    const enriched = enrichReviewLogs(logs, problemMap, chapterMap, subjectMap);
    const overview = calcHistoryOverview(enriched);
    expect(overview.totalReviews).toBe(3);
    expect(overview.uniqueProblems).toBe(2);
    expect(overview.activeDays).toBe(2);
    expect(overview.rememberedCount).toBe(2);
    expect(overview.weakCount).toBe(1);
    expect(overview.overallAccuracy).toBeCloseTo(2 / 3, 4);
    expect(overview.totalDurationMs).toBe(140000);
  });

  it('formatRelativeDay 能正确标记今天、昨天与前天', () => {
    const today = formatRelativeDay(NOW, NOW);
    expect(today.label).toBe('今天');

    const yesterday = formatRelativeDay(NOW - 86400000, NOW);
    expect(yesterday.label).toBe('昨天');

    const beforeYesterday = formatRelativeDay(NOW - 2 * 86400000, NOW);
    expect(beforeYesterday.label).toBe('前天');
  });
});
