import { describe, it, expect } from 'vitest';
import { filterToParams, paramsToFilter } from './url';

describe('筛选 ⇄ URL', () => {
  it('完整往返', () => {
    const filter = {
      subjectId: 'sub-1',
      chapterIds: ['c1', 'c2'],
      topicIds: ['t1'],
      mastery: [1, 2, 'none'] as const,
      difficulty: [3, 5],
      years: [2023, 2022],
      status: 'due' as const,
      realOnly: true,
      keyword: '根轨迹',
    };
    const back = paramsToFilter(filterToParams({ ...filter, mastery: [...filter.mastery] }));
    expect(back).toEqual({ ...filter, mastery: [1, 2, 'none'] });
  });

  it('空筛选不产生参数', () => {
    expect(filterToParams({}).toString()).toBe('');
    expect(paramsToFilter(new URLSearchParams())).toEqual({});
  });

  it('status=all 不算筛选条件', () => {
    expect(filterToParams({ status: 'all' }).has('status')).toBe(false);
  });

  it('非法掌握程度被忽略', () => {
    const f = paramsToFilter(new URLSearchParams('mastery=1,9,abc,none'));
    expect(f.mastery).toEqual([1, 'none']);
  });

  it('非法状态被忽略', () => {
    expect(paramsToFilter(new URLSearchParams('status=weird')).status).toBeUndefined();
  });

  it('关键词会去首尾空格', () => {
    const back = paramsToFilter(filterToParams({ keyword: '  矩阵  ' }));
    expect(back.keyword).toBe('矩阵');
  });

  it('章节跳转链接保持兼容', () => {
    const back = paramsToFilter(new URLSearchParams('chapter=chap-4-2'));
    expect(back.chapterIds).toEqual(['chap-4-2']);
  });

  it('难度与年份是数字数组', () => {
    const back = paramsToFilter(new URLSearchParams('difficulty=1,2&years=2020'));
    expect(back.difficulty).toEqual([1, 2]);
    expect(back.years).toEqual([2020]);
  });
});
