import type { Problem } from './types';

/**
 * 列表/详情用的题目标题。
 * 同一章节里一堆同类题很容易分不清，所以默认拼上「来源题号 + 日期」，
 * 用户自己填了 title 就优先用他的。
 */
export function displayTitle(
  problem: Pick<Problem, 'title' | 'createdAt' | 'sourceNo'>,
  chapterName?: string
): string {
  const custom = problem.title?.trim();
  if (custom) return custom;

  const d = new Date(problem.createdAt);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  const no = problem.sourceNo ? ` · 第 ${problem.sourceNo} 题` : '';
  return `${chapterName ?? '未分类'}${no} · ${md}`;
}
