import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { db } from '../../storage/db';
import { isKeyProblem } from '../../domain/filter';
import { cn } from '../../ui/cn';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';

/**
 * 错题本目录：先按科目、再按章节折叠。
 * 不直接铺题目 —— 题目列表在章节页（可左右滑动）和检索页里看。
 */
export default function LibraryPage() {
  const navigate = useNavigate();
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const active = useMemo(() => problems.filter((p) => !p.archivedAt), [problems]);

  const byChapter = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of active) map.set(p.chapterId, (map.get(p.chapterId) ?? 0) + 1);
    return map;
  }, [active]);

  const tree = useMemo(
    () =>
      subjects.map((s) => {
        const list = chapters
          .filter((c) => c.subjectId === s.id)
          .sort((a, b) => a.order - b.order)
          .map((c) => ({ chapter: c, count: byChapter.get(c.id) ?? 0 }))
          .filter((x) => x.count > 0);
        return {
          subject: s,
          chapters: list,
          total: list.reduce((sum, x) => sum + x.count, 0),
        };
      }),
    [subjects, chapters, byChapter]
  );

  const keyCount = active.filter(isKeyProblem).length;

  if (problems.length === 0) {
    return (
      <div className="space-y-4">
        <header className="pt-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">错题本</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50">
          <EmptyState
            title="还没有错题"
            description="拍一张做错的题，它会按科目和章节自动归档。"
            action={
              <Button variant="primary" onClick={() => navigate('/capture')}>
                录第一道错题
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">错题本</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          共 {active.length} 道未掌握{keyCount > 0 ? ` · ${keyCount} 道重点` : ''}
        </p>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-400 active:bg-zinc-50"
        >
          <Search size={16} />
          搜索或筛选错题
        </button>
        <button
          type="button"
          data-testid="library-search"
          onClick={() => navigate('/search')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50"
          aria-label="打开筛选"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {tree
          .filter((t) => t.total > 0)
          .map((node) => {
            const isOpen = open.has(node.subject.id);
            return (
              <section
                key={node.subject.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(node.subject.id)) next.delete(node.subject.id);
                      else next.add(node.subject.id);
                      return next;
                    })
                  }
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-zinc-50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: node.subject.color }}
                    />
                    {node.subject.name.replace('839 自动控制原理及过程控制', '839 自控')}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-zinc-400">
                    {node.chapters.length} 章 · {node.total} 题
                    <ChevronDown
                      size={15}
                      className={cn('transition-transform', isOpen && 'rotate-180')}
                    />
                  </span>
                </button>

                {isOpen && (
                  <ul className="border-t border-zinc-100">
                    {node.chapters.map(({ chapter, count }) => (
                      <li key={chapter.id} className="border-b border-zinc-50 last:border-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/chapter/${chapter.id}`)}
                          className="flex w-full items-center gap-2 px-4 py-3 pl-6 text-left active:bg-zinc-50"
                        >
                          <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700">
                            {chapter.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500">
                            {count} 题
                          </span>
                          <ChevronRight size={14} className="shrink-0 text-zinc-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
      </div>

      <p className="pt-1 text-center text-[10px] leading-relaxed text-zinc-400">
        点科目展开章节，点章节左右滑动看这一章的题
        <br />
        要按条件找题，用上面的「搜索或筛选」
      </p>
    </div>
  );
}
