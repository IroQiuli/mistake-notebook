import type { Chapter, Problem, ProblemStatus, Topic } from './types';

export interface ProblemFilter {
  keyword?: string;
  subjectId?: string;
  chapterIds?: string[];
  topicIds?: string[];
  difficulty?: number[];
  status?: ProblemStatus;
  years?: number[];
  /** 只看真题 */
  realOnly?: boolean;
}

/**
 * 是否真题：优先看结构化字段；老数据没有字段时，
 * 退化为「卷子/讲义里写了真题」。
 */
export function isRealExam(p: Problem): boolean {
  if (p.sourceKind) return p.sourceKind === '真题';
  return /真题|统考/.test(p.sourcePaper ?? '');
}

export interface FilterContext {
  dueIds?: Set<string>;
  newIds?: Set<string>;
}

export function filterProblems(
  problems: Problem[],
  f: ProblemFilter,
  chapters: Chapter[],
  topics: Topic[],
  ctx: FilterContext = {}
): Problem[] {
  const kw = f.keyword?.trim().toLowerCase() ?? '';
  const chapterName = new Map(chapters.map((c) => [c.id, c.name]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  return problems.filter((p) => {
    if (f.subjectId && p.subjectId !== f.subjectId) return false;
    if (f.chapterIds?.length && !f.chapterIds.includes(p.chapterId)) return false;
    if (f.topicIds?.length && !f.topicIds.every((t) => p.topicIds.includes(t))) return false;
    if (f.difficulty?.length && !f.difficulty.includes(p.difficulty)) return false;
    if (f.years?.length && (!p.sourceYear || !f.years.includes(p.sourceYear))) return false;
    if (f.realOnly && !isRealExam(p)) return false;

    const status = f.status ?? 'all';
    if (status === 'archived' && !p.archivedAt) return false;
    if (status !== 'archived' && p.archivedAt) return false;
    if (status === 'due' && !ctx.dueIds?.has(p.id)) return false;
    if (status === 'new' && !ctx.newIds?.has(p.id)) return false;

    if (kw) {
      const hay = [
        p.wrongNote,
        p.sourcePaper ?? '',
        p.sourceNo ?? '',
        String(p.sourceYear ?? ''),
        chapterName.get(p.chapterId) ?? '',
        ...p.topicIds.map((t) => topicName.get(t) ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

export function countActiveFilters(f: ProblemFilter): number {
  let n = 0;
  if (f.keyword?.trim()) n++;
  if (f.subjectId) n++;
  if (f.chapterIds?.length) n++;
  if (f.topicIds?.length) n++;
  if (f.difficulty?.length) n++;
  if (f.status && f.status !== 'all') n++;
  if (f.years?.length) n++;
  if (f.realOnly) n++;
  return n;
}
