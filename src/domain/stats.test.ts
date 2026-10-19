import { describe, it, expect } from 'vitest';
import {
  calcStreak,
  chapterMastery,
  dailyCounts,
  forecast,
  overallRetention,
  ratingDistribution,
} from './stats';
import type { Card, Chapter, Problem, ReviewLog } from './types';

const at = (s: string) => new Date(s).getTime();
const NOW = at('2026-10-19T20:00:00');

const problem = (id: string, chapterId: string, archived = false): Problem =>
  ({
    id,
    subjectId: 's1',
    chapterId,
    topicIds: [],
    stemAssetId: 'a1',
    answerAssetIds: [],
    wrongNote: '',
    difficulty: 3,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: archived ? NOW : undefined,
  }) as Problem;

const card = (problemId: string, due: number, extra: Partial<Card> = {}): Card =>
  ({
    problemId,
    due,
    stability: 5,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 5,
    reps: 2,
    lapses: 0,
    state: 2,
    lastReview: NOW - 86400000,
    learningSteps: 0,
    ...extra,
  }) as Card;

describe('dailyCounts', () => {
  it('按学习日归档，凌晨 2 点算前一天', () => {
    const logs = [
      { reviewedAt: at('2026-10-17T10:00:00') },
      { reviewedAt: at('2026-10-19T09:00:00') },
      { reviewedAt: at('2026-10-19T23:30:00') },
      { reviewedAt: at('2026-10-20T02:00:00') },
    ];
    const days = dailyCounts(logs, NOW, 3);
    expect(days.map((d) => d.key)).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
    expect(days.map((d) => d.count)).toEqual([1, 0, 3]);
  });

  it('超出窗口的日志不计入', () => {
    const logs = [{ reviewedAt: at('2026-09-01T10:00:00') }];
    const days = dailyCounts(logs, NOW, 7);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(0);
  });
});

describe('forecast', () => {
  it('逾期与今天合并，归档题不计', () => {
    const problems = [
      problem('p1', 'c1'),
      problem('p2', 'c1'),
      problem('p3', 'c1'),
      problem('p4', 'c1'),
      problem('p5', 'c1'),
      problem('pArchived', 'c1', true),
    ];
    const cards = [
      card('p1', at('2026-10-17T10:00:00')),
      card('p2', at('2026-10-19T23:00:00')),
      card('p3', at('2026-10-20T10:00:00')),
      card('p4', at('2026-10-22T10:00:00')),
      card('p5', at('2026-11-20T10:00:00')),
      card('pArchived', at('2026-10-19T10:00:00')),
    ];
    const fc = forecast(cards, problems, NOW, 14);
    expect(fc).toHaveLength(14);
    expect(fc[0].count).toBe(2);
    expect(fc[1].count).toBe(1);
    expect(fc[3].count).toBe(1);
    expect(fc.reduce((s, d) => s + d.count, 0)).toBe(4);
    expect(fc[0].label).toBe('今天');
    expect(fc[13].date).toBe('2026-11-01');
  });
});

describe('chapterMastery', () => {
  const chapters: Chapter[] = [
    { id: 'c1', subjectId: 's1', name: '根轨迹', order: 0 },
    { id: 'c2', subjectId: 's1', name: '频域', order: 1 },
    { id: 'c3', subjectId: 's1', name: '空章节', order: 2 },
  ];

  it('只统计有题的章节，已掌握按 100% 计', () => {
    const problems = [problem('p1', 'c1'), problem('p2', 'c1', true), problem('p3', 'c2')];
    const cards = [
      card('p1', NOW + 86400000, { state: 0, lastReview: undefined }),
      card('p3', NOW - 86400000),
    ];
    const rows = chapterMastery(problems, cards, chapters, NOW);

    expect(rows).toHaveLength(2);
    const c1 = rows.find((r) => r.chapterId === 'c1')!;
    expect(c1.total).toBe(2);
    expect(c1.archived).toBe(1);
    // 新题 0 + 已掌握 1 → 平均 0.5
    expect(c1.retention).toBeCloseTo(0.5, 5);
  });

  it('按掌握度升序，最薄弱的在最前', () => {
    const problems = [problem('p1', 'c1'), problem('p2', 'c2')];
    const cards = [
      card('p1', NOW + 86400000, { lastReview: NOW, stability: 100 }),
      card('p2', NOW - 5 * 86400000, { lastReview: NOW - 30 * 86400000, stability: 1 }),
    ];
    const rows = chapterMastery(problems, cards, chapters, NOW);
    expect(rows[0].chapterId).toBe('c2');
  });

  it('新题保持率为 0，待复习数只算未归档且今天到期', () => {
    const problems = [problem('p1', 'c1')];
    const cards = [card('p1', NOW, { state: 0, lastReview: undefined })];
    const rows = chapterMastery(problems, cards, chapters, NOW);
    expect(rows[0].retention).toBe(0);
    expect(rows[0].due).toBe(1);
  });
});

describe('overallRetention', () => {
  it('只算未掌握题目', () => {
    const problems = [problem('p1', 'c1'), problem('p2', 'c1', true)];
    const cards = [card('p1', NOW, { state: 0, lastReview: undefined })];
    expect(overallRetention(problems, cards, NOW)).toBe(0);
  });
});

describe('ratingDistribution', () => {
  it('按时间窗口统计四档', () => {
    const logs: Pick<ReviewLog, 'rating' | 'reviewedAt'>[] = [
      { rating: 1, reviewedAt: NOW - 86400000 },
      { rating: 3, reviewedAt: NOW - 2 * 86400000 },
      { rating: 3, reviewedAt: NOW - 40 * 86400000 },
      { rating: 0, reviewedAt: NOW - 86400000 },
    ];
    expect(ratingDistribution(logs, NOW - 30 * 86400000)).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0 });
  });
});

describe('calcStreak', () => {
  it('今天没复习时从昨天开始算', () => {
    const logs = [
      { reviewedAt: at('2026-10-18T22:00:00') },
      { reviewedAt: at('2026-10-17T22:00:00') },
      { reviewedAt: at('2026-10-16T22:00:00') },
    ];
    expect(calcStreak(logs, NOW)).toBe(3);
  });

  it('中断一天就断开', () => {
    const logs = [
      { reviewedAt: at('2026-10-19T10:00:00') },
      { reviewedAt: at('2026-10-17T10:00:00') },
    ];
    expect(calcStreak(logs, NOW)).toBe(1);
  });
});
