import { describe, it, expect } from 'vitest';
import { filterProblems, countActiveFilters } from './filter';
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

const chapters: Chapter[] = [
  { id: 'c1', subjectId: 's1', name: '根轨迹分析法', order: 1 },
  { id: 'c2', subjectId: 's1', name: '频域分析法', order: 2 },
];

const topics: Topic[] = [
  { id: 't1', subjectId: 's1', name: '广义根轨迹', usageCount: 1 },
  { id: 't2', subjectId: 's1', name: '奈奎斯特', usageCount: 1 },
];

describe('filterProblems', () => {
  const all = [
    p({
      id: 'a',
      wrongNote: '忘记考虑阻尼比',
      sourcePaper: '2023真题',
      difficulty: 4,
      topicIds: ['t1'],
    }),
    p({ id: 'b', chapterId: 'c2', wrongNote: '画错图', difficulty: 2, topicIds: ['t2'] }),
    p({ id: 'c', archivedAt: T0, difficulty: 5 }),
  ];

  it('无筛选返回未归档的全部', () => {
    expect(filterProblems(all, {}, chapters, topics)).toHaveLength(2);
  });

  it('关键词命中错误原因', () => {
    expect(filterProblems(all, { keyword: '阻尼' }, chapters, topics).map((x) => x.id)).toEqual([
      'a',
    ]);
  });

  it('关键词命中章节名', () => {
    expect(filterProblems(all, { keyword: '频域' }, chapters, topics).map((x) => x.id)).toEqual([
      'b',
    ]);
  });

  it('标签交集', () => {
    expect(filterProblems(all, { topicIds: ['t1'] }, chapters, topics).map((x) => x.id)).toEqual([
      'a',
    ]);
  });

  it('难度范围', () => {
    expect(
      filterProblems(all, { difficulty: [2, 3] }, chapters, topics).map((x) => x.id)
    ).toEqual(['b']);
  });

  it('状态：已掌握', () => {
    expect(filterProblems(all, { status: 'archived' }, chapters, topics).map((x) => x.id)).toEqual([
      'c',
    ]);
  });

  it('状态：待复习依赖上下文', () => {
    const dueIds = new Set(['b']);
    expect(
      filterProblems(all, { status: 'due' }, chapters, topics, { dueIds }).map((x) => x.id)
    ).toEqual(['b']);
  });

  it('关键词为空字符串不生效', () => {
    expect(filterProblems(all, { keyword: '   ' }, chapters, topics)).toHaveLength(2);
  });

  it('统计生效筛选数', () => {
    expect(countActiveFilters({ keyword: 'x', difficulty: [1], status: 'all' })).toBe(2);
  });
});
