import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { db } from '../../storage/db';
import {
  countActiveFilters,
  filterProblems,
  isRealExam,
  type ProblemFilter,
} from '../../domain/filter';
import { filterToParams, paramsToFilter } from '../../domain/url';
import { learningDayEnd } from '../../domain/time';
import { useBack } from '../../hooks/useBack';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PageLoading } from '../../ui/Spinner';
import { cn } from '../../ui/cn';
import { ProblemRow } from './ProblemRow';
import { FilterBar } from './FilterBar';

/** 筛选结果页：从错题本目录点「筛选」进来，平铺展示所有命中的题 */
export default function SearchPage() {
  const back = useBack('/library');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const topics = useLiveQuery(() => db.topics.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);

  // 筛选条件完全由 URL 决定：从详情页返回、刷新页面都不会丢
  const filter = useMemo(() => paramsToFilter(params), [params]);
  const subjectId = filter.subjectId;
  const keyword = filter.keyword ?? '';
  const applyFilter = (next: ProblemFilter) => setParams(filterToParams(next), { replace: true });
  const [filterOpen, setFilterOpen] = useState(false);
  const now = Date.now();

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.problemId, c])), [cards]);
  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const dueIds = useMemo(() => {
    const end = learningDayEnd(now);
    return new Set(cards.filter((c) => c.due <= end).map((c) => c.problemId));
  }, [cards, now]);
  const newIds = useMemo(
    () => new Set(cards.filter((c) => c.state === 0).map((c) => c.problemId)),
    [cards]
  );

  const years = useMemo(
    () =>
      [...new Set(problems.map((p) => p.sourceYear).filter((y): y is number => Boolean(y)))].sort(
        (a, b) => b - a
      ),
    [problems]
  );
  const realProblems = useMemo(
    () => problems.filter((p) => !p.archivedAt && isRealExam(p)),
    [problems]
  );
  const realYears = useMemo(
    () =>
      [
        ...new Set(realProblems.map((p) => p.sourceYear).filter((y): y is number => Boolean(y))),
      ].sort((a, b) => b - a),
    [realProblems]
  );

  const merged = useMemo<ProblemFilter>(
    () => ({ ...filter, subjectId, keyword }),
    [filter, subjectId, keyword]
  );

  const list = useMemo(
    () =>
      filterProblems(problems, merged, chapters, topics, { dueIds, newIds }).sort(
        (a, b) => b.createdAt - a.createdAt
      ),
    [problems, merged, chapters, topics, dueIds, newIds]
  );

  const activeCount = countActiveFilters(merged);

  if (problems === undefined) return <PageLoading />;

  return (
    <div className="space-y-3">
      <header className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={back}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">检索错题</h1>
          <p className="text-[11px] text-zinc-500">
            {list.length} 道命中
            {activeCount > 0 ? ` · ${activeCount} 个筛选条件` : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setFilterOpen(true)}>
          <SlidersHorizontal size={15} />
          筛选
        </Button>
      </header>

      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => applyFilter({ ...filter, keyword: e.target.value })}
          placeholder="搜标题、错误原因、来源、章节、标签"
          className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-orange-300"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => applyFilter({ ...filter, keyword: undefined })}
            className="rounded-xl border border-zinc-200 px-3 text-xs text-zinc-500"
          >
            清空
          </button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          onClick={() => applyFilter({ ...filter, subjectId: undefined, chapterIds: [] })}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-xs',
            !subjectId ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200'
          )}
        >
          全部科目
        </button>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => applyFilter({ ...filter, subjectId: s.id, chapterIds: [] })}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
              subjectId === s.id
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-600 ring-1 ring-zinc-200'
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
          </button>
        ))}
        <button
          type="button"
          data-testid="quick-key-only"
          onClick={() =>
            applyFilter({ ...filter, mastery: filter.mastery?.length ? [] : [1, 2] })
          }
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
            filter.mastery?.length ? 'text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200'
          )}
          style={filter.mastery?.length ? { backgroundColor: '#9a3412' } : undefined}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: filter.mastery?.length ? '#fed7aa' : '#9a3412' }}
          />
          重点关注
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50">
          <EmptyState
            title={activeCount > 0 ? '没有符合条件的错题' : '还没有错题'}
            description={
              activeCount > 0 ? '换个筛选条件试试' : '把做错的题拍下来，它会自动进入复习队列'
            }
            action={
              activeCount > 0 ? (
                <Button
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                >
                  清空筛选
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate('/capture')}>
                  录第一道错题
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <ProblemRow
              key={p.id}
              problem={p}
              chapter={chapterMap.get(p.chapterId)}
              topics={p.topicIds.map((id) => topicMap.get(id)).filter(Boolean) as never}
              card={cardMap.get(p.id)}
              subjectColor={subjectMap.get(p.subjectId)?.color}
              now={now}
            />
          ))}
        </div>
      )}

      <FilterBar
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filter}
        onApply={applyFilter}
        subjects={subjects}
        chapters={chapters}
        topics={topics}
        subjectId={subjectId}
        years={years}
        realCount={realProblems.length}
        realYears={realYears}
      />
    </div>
  );
}
