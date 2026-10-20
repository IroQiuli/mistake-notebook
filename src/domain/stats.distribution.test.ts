
import { describe, it, expect } from 'vitest';
import { masteryDistribution, subjectVolume } from './stats';
import type { Problem, Subject } from './types';

const T0 = 1_700_000_000_000;
const p = (over: Partial<Problem> & { id: string }): Problem =>
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

const subjects: Subject[] = [
  { id: 's1', name: '数学二', color: '#3b82f6', order: 1, archived: 0 },
  { id: 's2', name: '839 自动控制原理及过程控制', color: '#f97316', order: 2, archived: 0 },
];

describe('统计分布', () => {
  it('掌握程度四档 + 未分级都能统计', () => {
    const list = [
      p({ id: 'a', mastery: 1 }),
      p({ id: 'b', mastery: 1 }),
      p({ id: 'c', mastery: 4 }),
      p({ id: 'd' }),
      p({ id: 'e', archivedAt: T0 }),
    ];
    const r = masteryDistribution(list);
    expect(r.map((b) => [b.level, b.count])).toEqual([
      [1, 2],
      [2, 0],
      [3, 0],
      [4, 1],
      ['none', 1],
    ]);
  });

  it('科目题量按未归档降序，名字缩写', () => {
    const list = [
      p({ id: 'a', subjectId: 's1' }),
      p({ id: 'b', subjectId: 's2' }),
      p({ id: 'c', subjectId: 's2' }),
      p({ id: 'd', subjectId: 's1', archivedAt: T0 }),
    ];
    const r = subjectVolume(list, subjects);
    expect(r[0]).toMatchObject({ subjectId: 's2', name: '839 自控', count: 2 });
    expect(r[1]).toMatchObject({ subjectId: 's1', count: 1 });
  });
});
