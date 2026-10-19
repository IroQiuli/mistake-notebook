import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { db } from '../../storage/db';
import { countActiveFilters, filterProblems, type ProblemFilter } from '../../domain/filter';
import { learningDayEnd } from '../../domain/time';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PageLoading } from '../../ui/Spinner';
import { cn } from '../../ui/cn';
import { ProblemRow } from './ProblemRow';
import { FilterBar } from './FilterBar';

export default function LibraryPage() {
  const navigate = useNavigate();
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const topics = useLiveQuery(() => db.topics.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);

  const [filter, setFilter] = useState<ProblemFilter>({});
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
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

  const merged = useMemo<ProblemFilter>(
    () => ({ ...filter, subjectId, keyword }),
    [filter, subjectId, keyword]
  );

  const list = useMemo(() => {
    const filtered = filterProblems(problems, merged, chapters, topics, { dueIds, newIds });
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [problems, merged, chapters, topics, dueIds, newIds]);

  const activeCount = countActiveFilters(merged);

  if (problems === undefined) return <PageLoading />;

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">错题本</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            共 {problems.filter((p) => !p.archivedAt).length} 道未掌握
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/capture')}>
          <Plus size={16} />
          录入
        </Button>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜错误原因、来源、章节、标签"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-orange-300"
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className={cn(
            'relative flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm',
            activeCount > 0
              ? 'border-orange-300 bg-orange-50 text-orange-600'
              : 'border-zinc-200 bg-white text-zinc-600'
          )}
        >
          <SlidersHorizontal size={16} />
          筛选
          {activeCount > 0 && (
            <span className="rounded-full bg-orange-500 px-1.5 text-[10px] text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          type="button"
          onClick={() => setSubjectId(undefined)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-xs',
            !subjectId ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 ring-1 ring-zinc-200'
          )}
        >
          全部
        </button>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubjectId(s.id)}
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
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50">
          <EmptyState
            icon={<Plus size={26} />}
            title={activeCount > 0 ? '没有符合条件的错题' : '还没有错题'}
            description={
              activeCount > 0 ? '换个筛选条件试试' : '把做错的题拍下来，它会自动进入复习队列'
            }
            action={
              activeCount > 0 ? (
                <Button
                  onClick={() => {
                    setFilter({});
                    setKeyword('');
                    setSubjectId(undefined);
                  }}
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
        onApply={setFilter}
        subjects={subjects}
        chapters={chapters}
        topics={topics}
        subjectId={subjectId}
        years={years}
      />
    </div>
  );
}
