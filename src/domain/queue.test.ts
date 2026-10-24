import { describe, it, expect } from 'vitest';
import { buildQueue } from './queue';
import { newCard } from './scheduler';
import type { Card, Problem } from './types';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

const problem = (over: Partial<Problem> & { id: string }): Problem =>
  Object.assign(
    {
      subjectId: 's1',
      chapterId: 'c1',
      topicIds: [],
      stemAssetId: 'a1',
      answerAssetIds: [],
      wrongNote: '',
      difficulty: 3,
      createdAt: T0,
      updatedAt: T0,
    },
    over
  ) as Problem;

const card = (id: string, due: number, state = 0): Card => ({
  ...newCard(T0, id),
  due,
  state: state as Card['state'],
});

describe('buildQueue', () => {
  it('只取到期且未归档', () => {
    const ps = [problem({ id: 'p1' }), problem({ id: 'p2', archivedAt: T0 })];
    const cs = [card('p1', T0 - DAY), card('p2', T0 - DAY)];
    expect(buildQueue(ps, cs, { now: T0 }).map((x) => x.problem.id)).toEqual(['p1']);
  });

  it('逾期最久的排最前', () => {
    const ps = [problem({ id: 'a' }), problem({ id: 'b' }), problem({ id: 'c' })];
    const cs = [
      card('a', T0 - DAY, 2),
      card('b', T0 - 5 * DAY, 2),
      card('c', T0 - 3 * DAY, 2),
    ];
    expect(buildQueue(ps, cs, { now: T0, interleave: false }).map((x) => x.problem.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('新题受上限约束，按创建时间先到先得', () => {
    const ps = [
      problem({ id: 'n1', createdAt: T0 - 3 * DAY }),
      problem({ id: 'n2', createdAt: T0 - 2 * DAY }),
      problem({ id: 'n3', createdAt: T0 - DAY }),
    ];
    const cs = [card('n1', T0), card('n2', T0), card('n3', T0)];
    const q = buildQueue(ps, cs, { now: T0, newLimit: 2, interleave: false });
    expect(q.map((x) => x.problem.id).sort()).toEqual(['n1', 'n2']);
  });

  it('newLimit = 0 表示不限', () => {
    const ps = [problem({ id: 'n1' }), problem({ id: 'n2' })];
    const cs = [card('n1', T0), card('n2', T0)];
    expect(buildQueue(ps, cs, { now: T0, newLimit: 0 })).toHaveLength(2);
  });

  it('凌晨 3 点仍能看到前一天到期的题', () => {
    const late = new Date('2026-10-20T03:00:00').getTime();
    const ps = [problem({ id: 'p1' })];
    const cs = [card('p1', T0)];
    expect(buildQueue(ps, cs, { now: late })).toHaveLength(1);
  });

  it('科目筛选生效', () => {
    const ps = [problem({ id: 'p1', subjectId: 's1' }), problem({ id: 'p2', subjectId: 's2' })];
    const cs = [card('p1', T0 - DAY), card('p2', T0 - DAY)];
    const q = buildQueue(ps, cs, { now: T0, subjectId: 's2' });
    expect(q.map((x) => x.problem.id)).toEqual(['p2']);
  });

  it('多科目时按科目轮转打散', () => {
    const ps = [
      problem({ id: 'a1', subjectId: 's1' }),
      problem({ id: 'a2', subjectId: 's1' }),
      problem({ id: 'b1', subjectId: 's2' }),
      problem({ id: 'b2', subjectId: 's2' }),
    ];
    const cs = [
      card('a1', T0 - 4 * DAY),
      card('a2', T0 - 3 * DAY),
      card('b1', T0 - 2 * DAY),
      card('b2', T0 - DAY),
    ];
    const ids = buildQueue(ps, cs, { now: T0 }).map((x) => x.problem.id);
    expect(ids).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('昨日没做完的逾期题目顺延到今日且排在最前', () => {
    const ps = [
      problem({ id: 'today1', subjectId: 's1' }),
      problem({ id: 'yesterday_unfinished', subjectId: 's2' }),
      problem({ id: 'today2', subjectId: 's2' }),
    ];
    const cs = [
      card('today1', T0),
      card('yesterday_unfinished', T0 - DAY, 0),
      card('today2', T0),
    ];
    const queue = buildQueue(ps, cs, { now: T0 });
    expect(queue[0].problem.id).toBe('yesterday_unfinished');
    expect(queue[0].overdueDays).toBe(1);
    expect(queue.slice(1).map((x) => x.problem.id)).toEqual(['today1', 'today2']);
  });

  it('昨日已经做完复习的题目绝不顺延且不标记为逾期', () => {
    const ps = [
      problem({ id: 'today1', subjectId: 's1' }),
      problem({ id: 'yesterday_finished', subjectId: 's2' }),
    ];
    const cs = [
      card('today1', T0),
      // 昨天已经做完的题目（lastReview 在昨天，且 >= card.due）
      {
        ...card('yesterday_finished', T0 - DAY, 2),
        reps: 1,
        lastReview: T0 - DAY + 2 * 3600 * 1000,
      },
    ];
    const queue = buildQueue(ps, cs, { now: T0 });
    const item = queue.find((x) => x.problem.id === 'yesterday_finished');
    if (item) {
      expect(item.overdueDays).toBe(0);
    }
  });
});
