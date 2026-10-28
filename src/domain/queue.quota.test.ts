
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

const card = (id: string, due: number, state = 2, stability = 5): Card => ({
  ...newCard(T0, id),
  due,
  state: state as Card['state'],
  stability,
});

describe('每科每日题量', () => {
  it('设了题量的科目只取这么多，其余留到明天', () => {
    const ps = [1, 2, 3, 4, 5].map((i) => problem({ id: `p${i}` }));
    const cs = [1, 2, 3, 4, 5].map((i) => card(`p${i}`, T0 - i * DAY));
    const q = buildQueue(ps, cs, { now: T0, quotas: { s1: 2 }, interleave: false });
    expect(q.map((x) => x.problem.id)).toEqual(['p5', 'p4']);
    expect(q.every((x) => !x.auto)).toBe(true);
  });

  it('到期的题不够时，从未到期的题里按最快到期补齐', () => {
    const ps = [
      problem({ id: 'due1' }),
      problem({ id: 'later1' }),
      problem({ id: 'later2' }),
    ];
    const cs = [
      card('due1', T0 - DAY),
      card('later1', T0 + DAY),
      card('later2', T0 + 3 * DAY),
    ];
    const q = buildQueue(ps, cs, { now: T0, quotas: { s1: 3 }, interleave: false });
    expect(q.map((x) => x.problem.id)).toEqual(['due1', 'later1', 'later2']);
    expect(q.filter((x) => x.auto).map((x) => x.problem.id)).toEqual(['later1', 'later2']);
  });

  it('未复习的新题（state: 0）在未来到期时，绝不作为 filler 拉进今日待写清单', () => {
    const ps = [problem({ id: 'due1' }), problem({ id: 'new_future', createdAt: T0 })];
    const cs = [card('due1', T0 - DAY), card('new_future', T0 + DAY, 0)];
    const q = buildQueue(ps, cs, { now: T0, quotas: { s1: 5 }, interleave: false });
    expect(q.map((x) => x.problem.id)).toEqual(['due1']);
    expect(q.find((x) => x.problem.id === 'new_future')).toBeUndefined();
  });

  it('没设题量的科目照旧全部到期', () => {
    const ps = [
      problem({ id: 'a1', subjectId: 's1' }),
      problem({ id: 'a2', subjectId: 's1' }),
      problem({ id: 'b1', subjectId: 's2' }),
    ];
    const cs = [card('a1', T0 - 2 * DAY), card('a2', T0 - DAY), card('b1', T0 - DAY)];
    const q = buildQueue(ps, cs, { now: T0, quotas: { s1: 1 }, interleave: false });
    expect(q.map((x) => x.problem.id)).toEqual(['a1', 'b1']);
  });

  it('题量为 0 表示今天不做这一科', () => {
    const ps = [problem({ id: 'a1', subjectId: 's1' }), problem({ id: 'b1', subjectId: 's2' })];
    const cs = [card('a1', T0 - DAY), card('b1', T0 - DAY)];
    const q = buildQueue(ps, cs, { now: T0, quotas: { s1: 0 }, interleave: false });
    expect(q.map((x) => x.problem.id)).toEqual(['b1']);
  });

  it('不传 quotas 时行为不变', () => {
    const ps = [1, 2, 3].map((i) => problem({ id: `p${i}` }));
    const cs = [1, 2, 3].map((i) => card(`p${i}`, T0 - i * DAY));
    expect(buildQueue(ps, cs, { now: T0 })).toHaveLength(3);
  });

  it('今日已做过的题目（无论到期时间）彻底移出待写队列', () => {
    const ps = [problem({ id: 'p1' }), problem({ id: 'p2' })];
    // p1 即使因评为“忘记”导致 due 仍在今天内，只要在 reviewedTodayIds 里就不进待写
    const cs = [card('p1', T0 + 5 * 60 * 1000), card('p2', T0 - DAY)];
    const q = buildQueue(ps, cs, {
      now: T0,
      reviewedTodayIds: new Set(['p1']),
    });
    expect(q.map((x) => x.problem.id)).toEqual(['p2']);
  });

  it('已做题量抵扣科目配额，做完一道后待写精确 -1，且不会重复从 later 抓回已做题目', () => {
    const ps = [
      problem({ id: 'p1' }),
      problem({ id: 'p2' }),
      problem({ id: 'p3' }),
      problem({ id: 'later1' }),
    ];
    // 配额 3 道，已做 1 道 (p1)，待写应只剩 2 道 (p2, p3)
    const cs = [
      card('p1', T0 + DAY), // 刚刚做完推到明天
      card('p2', T0 - DAY),
      card('p3', T0 - DAY),
      card('later1', T0 + 2 * DAY),
    ];
    const q = buildQueue(ps, cs, {
      now: T0,
      quotas: { s1: 3 },
      reviewedTodayIds: new Set(['p1']),
      reviewedCounts: { s1: 1 },
      interleave: false,
    });
    // 剩余待写仅 2 道，且绝不包含 p1
    expect(q.map((x) => x.problem.id)).toEqual(['p2', 'p3']);
  });

  it('科目配额已全部做满时，待写数量归零', () => {
    const ps = [problem({ id: 'p1' }), problem({ id: 'later1' })];
    const cs = [card('p1', T0 + DAY), card('later1', T0 + 2 * DAY)];
    const q = buildQueue(ps, cs, {
      now: T0,
      quotas: { s1: 1 },
      reviewedTodayIds: new Set(['p1']),
      reviewedCounts: { s1: 1 },
    });
    expect(q).toHaveLength(0);
  });

  it('配额补齐绝不拉取昨天刚做过的题（lastReview 处于昨日学习日内），而是拉取更早复习过但未来排期最接近的题', () => {
    const ps = [
      problem({ id: 'due1' }),
      problem({ id: 'yesterdayReviewed' }),
      problem({ id: 'futureEligible' }),
    ];
    const cs = [
      card('due1', T0 - DAY), // 今日到期
      {
        ...card('yesterdayReviewed', T0 + DAY), // 昨天刚做完推到明天
        lastReview: T0 - DAY + 2 * 3600 * 1000,
      },
      {
        ...card('futureEligible', T0 + 2 * DAY), // 以前做过的，后天到期
        lastReview: T0 - 7 * DAY,
      },
    ];
    const q = buildQueue(ps, cs, {
      now: T0,
      quotas: { s1: 2 },
      interleave: false,
    });
    // 配额 2 道：1 道 due1 + 1 道 filler。filler 必须是 futureEligible，绝不能是 yesterdayReviewed！
    expect(q.map((x) => x.problem.id)).toEqual(['due1', 'futureEligible']);
    expect(q.find((x) => x.problem.id === 'yesterdayReviewed')).toBeUndefined();
  });

  it('即使开启 interleave，补齐题也严格排在所有今日到期题之后，并按未来排期 due 升序排列', () => {
    const ps = [
      problem({ id: 'd1', subjectId: 's1' }),
      problem({ id: 'd2', subjectId: 's2' }),
      problem({ id: 'later_close', subjectId: 's1' }),
      problem({ id: 'later_far', subjectId: 's2' }),
    ];
    const cs = [
      card('d1', T0 - DAY),
      card('d2', T0 - DAY),
      card('later_close', T0 + DAY), // 明天到期
      card('later_far', T0 + 3 * DAY), // 3天后到期
    ];
    const q = buildQueue(ps, cs, {
      now: T0,
      quotas: { s1: 2, s2: 2 },
      interleave: true,
    });
    // d1 和 d2 是今日到期题，优先轮转
    // later_close (明天) 和 later_far (3天后) 是补齐题，排在今日到期题之后，且严格按 due 升序
    expect(q.map((x) => x.problem.id)).toEqual(['d1', 'd2', 'later_close', 'later_far']);
    expect(q.slice(0, 2).every((x) => !x.auto)).toBe(true);
    expect(q.slice(2).every((x) => x.auto)).toBe(true);
  });
});
