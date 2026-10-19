import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, FileStack, Sparkles } from 'lucide-react';
import { db } from '../../storage/db';
import { saveActivePaper } from '../../storage/paper';
import { buildPaper, buildPresetPaper, paperPresetFor, type PaperPlan } from '../../domain/paper';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/cn';

export type PaperModeUI = 'category' | 'forgetting';

export default function PaperPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);

  const [mode, setMode] = useState<PaperModeUI>('category');
  /** null = 全部科目（默认）；点一下某个科目就把它去掉 */
  const [selected, setSelected] = useState<string[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [realOnly, setRealOnly] = useState(false);
  const [total, setTotal] = useState(20);
  const [now] = useState(() => Date.now());

  const allIds = useMemo(() => subjects.map((s) => s.id), [subjects]);
  const active = selected ?? allIds;
  const activeSubjects = subjects.filter((s) => active.includes(s.id));

  const availableBySubject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of problems) {
      if (p.archivedAt) continue;
      if (!active.includes(p.subjectId)) continue;
      if (realOnly && !(p.sourceKind === '真题' || /真题|统考/.test(p.sourcePaper ?? ''))) continue;
      map[p.subjectId] = (map[p.subjectId] ?? 0) + 1;
    }
    return map;
  }, [problems, active, realOnly]);

  const resolvedCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of activeSubjects) {
      const preset = paperPresetFor(s.name);
      const available = availableBySubject[s.id] ?? 0;
      out[s.id] = Math.min(counts[s.id] ?? preset?.total ?? 20, available);
    }
    return out;
  }, [activeSubjects, counts, availableBySubject]);

  const plan: PaperPlan = useMemo(() => {
    if (mode === 'forgetting') {
      return buildPaper(problems, cards, chapters, {
        mode: 'forgetting',
        total,
        subjectIds: active,
        realOnly,
      }, now);
    }
    // 实际有题的科目只剩一个，且它有卷型（如 839 八道大题）：按题号逐槽抽
    const withProblems = activeSubjects.filter((s) => (availableBySubject[s.id] ?? 0) > 0);
    if (withProblems.length === 1) {
      const preset = paperPresetFor(withProblems[0].name);
      if (preset?.slots) {
        return buildPresetPaper(withProblems[0], chapters, problems, cards, now);
      }
    }
    return buildPaper(problems, cards, chapters, {
      mode: 'category',
      perSubject: resolvedCounts,
      subjectIds: active,
      realOnly,
    }, now);
  }, [mode, activeSubjects, problems, cards, chapters, resolvedCounts, total, active, realOnly, now, availableBySubject]);

  const chapterSpread = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of plan.items) {
      map.set(item.chapterName, (map.get(item.chapterName) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [plan]);

  const toggleSubject = (id: string) => {
    const cur = selected ?? allIds;
    setSelected(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const generate = async () => {
    if (plan.items.length === 0) {
      toast.show('这个条件下没有题，换个分类或关掉「只看真题」', 'error');
      return;
    }
    const names = plan.perSubject
      .filter((s) => s.picked > 0)
      .map((s) => subjects.find((x) => x.id === s.subjectId)?.name ?? '')
      .map((n) => n.replace('839 自动控制原理及过程控制', '839 自控'))
      .filter(Boolean)
      .join(' + ');
    const title = `${names || '全部科目'} · ${plan.items.length} 题`;
    const saved = await saveActivePaper({
      title,
      problemIds: plan.items.map((i) => i.problem.id),
    });
    toast.show(`已组好 ${saved.problemIds.length} 题`, 'success');
    navigate('/review?paper=1');
  };

  if (problems.length === 0) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
            aria-label="返回"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">组一套卷</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50">
          <EmptyState
            icon={<FileStack size={26} />}
            title="还没有错题"
            description="先录几道错题，再来组卷。"
            action={
              <Button variant="primary" onClick={() => navigate('/capture')}>
                去录题
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-32">
      <header className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">组一套卷</h1>
          <p className="text-[11px] text-zinc-500">按分类挑，或按遗忘曲线挑</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
        {(
          [
            { key: 'category', label: '按分类组卷', icon: FileStack },
            { key: 'forgetting', label: '按遗忘曲线', icon: Sparkles },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
              mode === m.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
            )}
          >
            <m.icon size={14} />
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'category' && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-zinc-800">科目</h2>
            <span className="text-[10px] text-zinc-400">不选 = 全部</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => {
              const on = active.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSubject(s.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]',
                    on
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : 'border-zinc-200 text-zinc-500'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 space-y-1.5">
            {activeSubjects
              .filter((s) => (availableBySubject[s.id] ?? 0) > 0)
              .map((s) => {
              const preset = paperPresetFor(s.name);
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-600">
                    {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                    {preset && (
                      <span className="ml-1 text-[10px] text-zinc-400">{preset.label}</span>
                    )}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={resolvedCounts[s.id] ?? 0}
                    onChange={(e) =>
                      setCounts((prev) => ({
                        ...prev,
                        [s.id]: Math.min(99, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)),
                      }))
                    }
                    className="h-8 w-14 rounded-lg border border-zinc-200 px-2 text-center text-xs outline-none focus:border-orange-300"
                    aria-label={`${s.name} 题量`}
                  />
                  <span className="w-8 text-[10px] text-zinc-400">
                    存 {availableBySubject[s.id] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>

          <label className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
            <span className="text-xs text-zinc-600">只看真题</span>
            <input
              type="checkbox"
              checked={realOnly}
              onChange={(e) => setRealOnly(e.target.checked)}
              className="h-4 w-4 accent-orange-500"
            />
          </label>
        </section>
      )}

      {mode === 'forgetting' && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-800">抽多少道</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            按 FSRS 的「现在还记得的概率」从低到高抽，先练最可能忘的
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={total}
              onChange={(e) =>
                setTotal(Math.min(60, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))
              }
              className="h-10 w-20 rounded-xl border border-zinc-200 px-3 text-center text-sm outline-none focus:border-orange-300"
            />
            <span className="text-sm text-zinc-500">道</span>
            <div className="ml-auto flex gap-1.5">
              {[10, 20, 22].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTotal(n)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px]',
                    total === n ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {subjects.map((s) => {
              const on = active.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSubject(s.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]',
                    on
                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                      : 'border-zinc-200 text-zinc-500'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-800">卷面预览</h2>
          <span className="text-[11px] text-zinc-400">
            {plan.items.length} 题
            {plan.shortage > 0 && ` · 缺 ${plan.shortage} 题`}
          </span>
        </div>

        {plan.items.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-400">
            这个条件下没有题，换个分类或关掉「只看真题」
          </p>
        ) : (
          <>
            <ol className="space-y-1">
              {plan.items.slice(0, 10).map((item, i) => (
                <li
                  key={item.problem.id}
                  className="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5"
                >
                  <span className="w-12 shrink-0 text-[10px] tabular-nums text-zinc-400">
                    {item.slot ?? `${i + 1}.`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-700">
                    {item.chapterName}
                  </span>
                  <span className="max-w-[42%] shrink-0 truncate text-[10px] text-zinc-400">
                    {item.problem.sourcePaper ||
                      (item.problem.sourceYear ? `${item.problem.sourceYear} 年` : '')}
                  </span>
                </li>
              ))}
            </ol>
            {plan.items.length > 10 && (
              <p className="mt-1.5 text-center text-[10px] text-zinc-400">
                还有 {plan.items.length - 10} 题，开始后按顺序做
              </p>
            )}

            {chapterSpread.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2">
                {chapterSpread.slice(0, 8).map(([name, n]) => (
                  <span
                    key={name}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500"
                  >
                    {name} {n}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-[60px] z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Button
          variant="primary"
          size="xl"
          block
          onClick={() => void generate()}
          disabled={plan.items.length === 0}
        >
          开始做这套卷（{plan.items.length} 题）
        </Button>
      </div>
    </div>
  );
}
