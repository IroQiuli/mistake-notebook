
import { describe, it, expect } from 'vitest';
import { allocate, buildPaper, buildPresetPaper, paperPresetFor } from './paper';
import { newCard } from './scheduler';
import type { Card, Chapter, Problem, Subject } from './types';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

const subject = (id: string, name: string): Subject =>
  ({ id, name, color: '#000', order: 1 }) as Subject;

const chapter = (id: string, subjectId: string, name: string, order: number): Chapter =>
  ({ id, subjectId, name, order }) as Chapter;

const problem = (id: string, subjectId: string, chapterId: string): Problem =>
  ({
    id,
    subjectId,
    chapterId,
    topicIds: [],
    stemAssetId: 'a',
    answerAssetIds: [],
    wrongNote: '',
    difficulty: 3,
    createdAt: T0,
    updatedAt: T0,
  }) as Problem;

const card = (id: string, stability: number, lastReview = T0 - DAY): Card => ({
  ...newCard(T0, id),
  state: 2,
  stability,
  lastReview,
  due: T0 + DAY,
});

const ACC = subject('s-839', '839 自动控制原理及过程控制');
const AC_CH = [
  chapter('c1', ACC.id, '自动控制的一般概念', 1),
  chapter('c2', ACC.id, '控制系统的数学模型', 2),
  chapter('c3', ACC.id, '线性系统的时域分析法', 3),
  chapter('c4', ACC.id, '根轨迹分析法', 4),
  chapter('c5', ACC.id, '线性系统的频域分析法', 5),
  chapter('c6', ACC.id, '线性系统的校正方法', 6),
  chapter('c7', ACC.id, '非线性控制系统分析', 7),
  chapter('c8', ACC.id, '线性离散控制系统', 8),
  chapter('c9', ACC.id, '过程检测及控制仪表', 9),
  chapter('c10', ACC.id, '被控过程特性的机理建模', 10),
  chapter('c11', ACC.id, '常规过程控制系统（单回路控制）', 11),
  chapter('c12', ACC.id, '复杂过程控制系统方案设计', 12),
];

describe('套卷', () => {
  it('839 的卷型是 8 道大题，一题一章', () => {
    const preset = paperPresetFor(ACC.name);
    expect(preset?.total).toBe(8);
    expect(preset?.slots).toHaveLength(8);
    expect(preset?.slots?.every((s) => s.count === 1)).toBe(true);
  });

  it('按卷型抽题：每个槽位拿到对应章节的题', () => {
    const ps = ['c2', 'c3', 'c4', 'c5', 'c7', 'c8', 'c9', 'c12'].map((cid) => problem('p-' + cid, ACC.id, cid));
    const cs = ps.map((p) => card(p.id, 5));
    const plan = buildPresetPaper(ACC, AC_CH, ps, cs, T0);

    expect(plan.items).toHaveLength(8);
    expect(plan.items.map((i) => i.problem.chapterId)).toEqual([
      'c2', 'c3', 'c4', 'c5', 'c7', 'c8', 'c9', 'c12',
    ]);
    expect(plan.items[0].slot).toBe('第 1 题');
    expect(plan.shortage).toBe(0);
  });

  it('缺章节时记为缺口，不拿别的章顶替', () => {
    const ps = [problem('p-c2', ACC.id, 'c2'), problem('p-c3', ACC.id, 'c3')];
    const cs = ps.map((p) => card(p.id, 5));
    const plan = buildPresetPaper(ACC, AC_CH, ps, cs, T0);
    expect(plan.items).toHaveLength(2);
    expect(plan.shortage).toBe(6);
  });

  it('遗忘曲线模式：记得最不牢的排前面', () => {
    const ps = [1, 2, 3].map((i) => problem(`p${i}`, 's1', 'c1'));
    const cs = [card('p1', 60), card('p2', 2), card('p3', 10)];
    const plan = buildPaper(ps, cs, [chapter('c1', 's1', '第一章', 1)], { mode: 'forgetting', perSubject: { s1: 2 } }, T0);
    expect(plan.items.map((i) => i.problem.id)).toEqual(['p2', 'p3']);
  });

  it('类别模式按章节轮转，覆盖更多章节', () => {
    const chs = [chapter('c1', 's1', 'A', 1), chapter('c2', 's1', 'B', 2), chapter('c3', 's1', 'C', 3)];
    const ps = [
      problem('a1', 's1', 'c1'), problem('a2', 's1', 'c1'), problem('a3', 's1', 'c1'),
      problem('b1', 's1', 'c2'), problem('c1p', 's1', 'c3'),
    ];
    const cs = ps.map((p) => card(p.id, 5));
    const plan = buildPaper(ps, cs, chs, { mode: 'category', perSubject: { s1: 4 } }, T0);
    expect(plan.items.map((i) => i.problem.chapterId)).toEqual(['c1', 'c2', 'c3', 'c1']);
  });

  it('allocate 按题量比例分配并至少给 1 道', () => {
    expect(allocate({ a: 10, b: 30 }, 20)).toEqual({ a: 5, b: 15 });
    const r = allocate({ a: 3, b: 40, c: 1 }, 10);
    expect(Object.values(r).reduce((s, n) => s + n, 0)).toBe(10);
    expect(Object.values(r).every((n) => n >= 1)).toBe(true);
  });

  it('题量超过存量时按存量给，并记缺口', () => {
    const ps = [problem('p1', 's1', 'c1')];
    const plan = buildPaper(ps, [card('p1', 5)], [chapter('c1', 's1', 'A', 1)], { mode: 'category', perSubject: { s1: 10 } }, T0);
    expect(plan.items).toHaveLength(1);
    expect(plan.shortage).toBe(9);
  });
});
