
import { describe, it, expect } from 'vitest';
import { filterProblems, countActiveFilters, isKeyProblem } from './filter';
import type { Chapter, Problem, Topic } from './types';

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

const chapters: Chapter[] = [{ id: 'c1', subjectId: 's1', name: '根轨迹', order: 1 }];
const topics: Topic[] = [];

const all = [
  p({ id: 'a', mastery: 1 }),
  p({ id: 'b', mastery: 2 }),
  p({ id: 'c', mastery: 3 }),
  p({ id: 'd', mastery: 4 }),
  p({ id: 'e' }),
];

describe('掌握程度筛选', () => {
  it('按单个等级筛', () => {
    const r = filterProblems(all, { mastery: [1] }, chapters, topics);
    expect(r.map((x) => x.id)).toEqual(['a']);
  });

  it('多个等级是「或」的关系', () => {
    const r = filterProblems(all, { mastery: [1, 2] }, chapters, topics);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('none 命中还没分级的题', () => {
    const r = filterProblems(all, { mastery: ['none'] }, chapters, topics);
    expect(r.map((x) => x.id)).toEqual(['e']);
  });

  it('分级 + 未分级可以同时选', () => {
    const r = filterProblems(all, { mastery: [4, 'none'] }, chapters, topics);
    expect(r.map((x) => x.id)).toEqual(['d', 'e']);
  });

  it('不传 mastery 时不过滤', () => {
    expect(filterProblems(all, {}, chapters, topics)).toHaveLength(5);
  });

  it('计入已选筛选项数量', () => {
    expect(countActiveFilters({ mastery: [1, 2] })).toBe(1);
    expect(countActiveFilters({})).toBe(0);
  });

  it('1~2 级算重点题', () => {
    expect(all.filter(isKeyProblem).map((x) => x.id)).toEqual(['a', 'b']);
  });
});
