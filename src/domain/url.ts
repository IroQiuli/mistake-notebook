import type { Mastery, ProblemStatus } from './types';
import type { ProblemFilter } from './filter';

/**
 * 检索页的筛选条件 ⇄ URL 参数。
 * 放在 URL 里的好处：从详情页返回时筛选、关键词都还在，刷新也不丢。
 */
export function filterToParams(filter: ProblemFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (filter.subjectId) p.set('subject', filter.subjectId);
  if (filter.chapterIds?.length) p.set('chapter', filter.chapterIds.join(','));
  if (filter.topicIds?.length) p.set('topic', filter.topicIds.join(','));
  if (filter.mastery?.length) p.set('mastery', filter.mastery.join(','));
  if (filter.difficulty?.length) p.set('difficulty', filter.difficulty.join(','));
  if (filter.years?.length) p.set('years', filter.years.join(','));
  if (filter.status && filter.status !== 'all') p.set('status', filter.status);
  if (filter.realOnly) p.set('real', '1');
  const kw = filter.keyword?.trim();
  if (kw) p.set('q', kw);
  return p;
}

function numbers(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
}

export function paramsToFilter(params: URLSearchParams): ProblemFilter {
  const filter: ProblemFilter = {};

  const subject = params.get('subject');
  if (subject) filter.subjectId = subject;

  const chapter = params.get('chapter');
  if (chapter) filter.chapterIds = chapter.split(',').filter(Boolean);

  const topic = params.get('topic');
  if (topic) filter.topicIds = topic.split(',').filter(Boolean);

  const mastery = params.get('mastery');
  if (mastery) {
    filter.mastery = mastery
      .split(',')
      .filter((v) => v === 'none' || /^[1-4]$/.test(v))
      .map((v) => (v === 'none' ? ('none' as const) : (Number(v) as Mastery)));
  }

  const difficulty = numbers(params.get('difficulty'));
  if (difficulty.length) filter.difficulty = difficulty;

  const years = numbers(params.get('years'));
  if (years.length) filter.years = years;

  const status = params.get('status') as ProblemStatus | null;
  if (status === 'due' || status === 'new' || status === 'archived') filter.status = status;

  if (params.get('real') === '1') filter.realOnly = true;

  const q = params.get('q');
  if (q) filter.keyword = q;

  return filter;
}
