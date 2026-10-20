
import { describe, it, expect } from 'vitest';
import { buildQueue } from './queue';
import { newCard } from './scheduler';
import type { Card, Problem } from './types';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

const problem = (id: string): Problem =>
  ({
    id,
    subjectId: 's1',
    chapterId: 'c1',
    topicIds: [],
    stemAssetId: 'a1',
    answerAssetIds: [],
    wrongNote: '',
    difficulty: 3,
    createdAt: T0,
    updatedAt: T0,
  }) as Problem;

const card = (id: string, due: number): Card => ({
  ...newCard(T0, id),
  due,
  state: 2,
});

describe('今日队列上限', () => {
  it('limit 把到期题压在今日计划内，超出部分不进队列', () => {
    const ps = Array.from({ length: 10 }, (_, i) => problem(`p${i}`));
    const cs = ps.map((p, i) => card(p.id, T0 - i * DAY));
    const q = buildQueue(ps, cs, { now: T0, limit: 4, interleave: false });
    expect(q).toHaveLength(4);
    // 逾期最久的排前面
    expect(q.map((x) => x.problem.id)).toEqual(['p9', 'p8', 'p7', 'p6']);
  });

  it('到期数少于 limit 时全给', () => {
    const ps = [problem('a'), problem('b')];
    const cs = [card('a', T0 - DAY), card('b', T0)];
    expect(buildQueue(ps, cs, { now: T0, limit: 10 })).toHaveLength(2);
  });

  it('不传 limit 时保持旧行为', () => {
    const ps = Array.from({ length: 5 }, (_, i) => problem(`p${i}`));
    const cs = ps.map((p) => card(p.id, T0 - DAY));
    expect(buildQueue(ps, cs, { now: T0 })).toHaveLength(5);
  });
});
