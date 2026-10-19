import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown } from 'lucide-react';
import { db } from '../../storage/db';
import {
  accuracyByChapter,
  accuracyBySubject,
  calcStreak,
  chapterMastery,
  dailyCounts,
  errorTagDistribution,
  forecast,
  overallRetention,
  ratingDistribution,
} from '../../domain/stats';
import { ERROR_TAG_COLORS } from '../../domain/taxonomy';
import { practiceChapter } from '../../storage/problems';
import { useToast } from '../../ui/Toast';
import { learningDayStart } from '../../domain/time';
import { cn } from '../../ui/cn';
import { EmptyState } from '../../ui/EmptyState';

const WEEKS = 16;
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function heatLevel(n: number): string {
  if (n === 0) return 'bg-zinc-100';
  if (n <= 2) return 'bg-orange-200';
  if (n <= 4) return 'bg-orange-300';
  if (n <= 7) return 'bg-orange-400';
  if (n <= 11) return 'bg-orange-500';
  return 'bg-orange-600';
}

function masteryColor(r: number): string {
  if (r < 0.4) return 'bg-red-400';
  if (r < 0.6) return 'bg-amber-400';
  if (r < 0.8) return 'bg-orange-400';
  return 'bg-emerald-500';
}

function Heatmap({ counts }: { counts: { key: string; ts: number; count: number }[] }) {
  const pad = (new Date(counts[0]?.ts ?? Date.now()).getDay() + 6) % 7;
  const cells: ({ key: string; count: number } | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...counts,
  ];
  const total = counts.reduce((s, c) => s + c.count, 0);
  const activeDays = counts.filter((c) => c.count > 0).length;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-800">复习热力图</h2>
        <span className="text-[11px] text-zinc-400">
          近 {WEEKS} 周 · {activeDays} 天有复习
        </span>
      </div>

      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-[3px] pt-0">
          {WEEK_LABELS.map((w, i) => (
            <span
              key={w}
              className={cn(
                'flex h-3 items-center text-[9px] leading-none text-zinc-300',
                i % 2 === 0 ? 'opacity-100' : 'opacity-0'
              )}
            >
              {w}
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 grid-flow-col gap-[3px]"
          style={{
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoColumns: '12px',
            justifyContent: 'space-between',
          }}
        >
          {cells.map((cell, i) =>
            cell ? (
              <div
                key={cell.key}
                title={`${cell.key}：${cell.count} 次`}
                className={cn('h-3 w-3 rounded-[2px]', heatLevel(cell.count))}
              />
            ) : (
              <div key={`pad-${i}`} className="h-3 w-3" />
            )
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400">
        <span>共 {total} 次复习</span>
        <span className="flex items-center gap-1">
          少
          <i className="h-2.5 w-2.5 rounded-[2px] bg-zinc-100" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-orange-200" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-orange-300" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-orange-400" />
          <i className="h-2.5 w-2.5 rounded-[2px] bg-orange-600" />
          多
        </span>
      </div>
    </section>
  );
}

function Forecast({
  days,
  onPick,
}: {
  days: { offset: number; label: string; count: number }[];
  onPick: () => void;
}) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-800">未来 14 天到期</h2>
        <button type="button" onClick={onPick} className="text-[11px] text-orange-600">
          去复习
        </button>
      </div>

      <div className="flex h-28 items-end gap-[3px]">
        {days.map((d) => (
          <div key={d.offset} className="flex flex-1 flex-col items-center justify-end gap-1">
            {d.count > 0 && (
              <span className="text-[9px] leading-none text-zinc-400">{d.count}</span>
            )}
            <div
              className={cn(
                'w-full rounded-t-[3px]',
                d.offset === 0 ? 'bg-orange-500' : 'bg-orange-300'
              )}
              style={{ height: `${Math.max(d.count > 0 ? 6 : 0, (d.count / max) * 76)}px` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        <span>今天</span>
        <span>7 天后</span>
        <span>14 天</span>
      </div>
    </section>
  );
}

export default function StatsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);

  const [subjectFilter, setSubjectFilter] = useState<string | undefined>(undefined);
  const [expandedAccuracy, setExpandedAccuracy] = useState<string | null>(null);
  const now = Date.now();
  const since30 = learningDayStart(now) - 30 * 86400000;

  const counts = useMemo(() => dailyCounts(logs, now, WEEKS * 7), [logs, now]);
  const forecastDays = useMemo(() => forecast(cards, problems, now, 14), [cards, problems, now]);
  const mastery = useMemo(
    () => chapterMastery(problems, cards, chapters, now),
    [problems, cards, chapters, now]
  );
  const retention = useMemo(() => overallRetention(problems, cards, now), [problems, cards, now]);
  const dist = useMemo(
    () => ratingDistribution(logs, learningDayStart(now) - 30 * 86400000),
    [logs, now]
  );
  const streak = useMemo(() => calcStreak(logs, now), [logs, now]);
  const tagDist = useMemo(() => errorTagDistribution(problems), [problems]);

  const accSubjects = useMemo(
    () => accuracyBySubject(logs, problems, subjects, since30),
    [logs, problems, subjects, since30]
  );
  const accChapters = useMemo(
    () => accuracyByChapter(logs, problems, chapters, since30),
    [logs, problems, chapters, since30]
  );
  const accTotals = accSubjects.reduce(
    (acc, s) => ({ total: acc.total + s.total, remembered: acc.remembered + s.remembered }),
    { total: 0, remembered: 0 }
  );
  const overallAccuracy = accTotals.total ? accTotals.remembered / accTotals.total : 0;

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const visibleMastery = mastery.filter((m) => !subjectFilter || m.subjectId === subjectFilter);
  const activeCount = problems.filter((p) => !p.archivedAt).length;
  const dueToday = forecastDays[0]?.count ?? 0;

  if (problems.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="pt-1 text-2xl font-semibold tracking-tight text-zinc-900">统计</h1>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50">
          <EmptyState
            icon={<BarChart3 size={26} />}
            title="还没有数据"
            description="录几道错题、复习几天，这里会出现热力图、到期预测和章节掌握度。"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">统计</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          {streak > 0 ? `连续复习 ${streak} 天` : '今天还没复习'} · 未掌握 {activeCount} 题
        </p>
      </header>

      <section className="grid grid-cols-4 gap-2">
        {[
          { label: '累计复习', value: logs.length },
          { label: '今天到期', value: dueToday },
          { label: '平均保持率', value: `${Math.round(retention * 100)}%` },
          {
            label: '近30天正确率',
            value: accTotals.total ? `${Math.round(overallAccuracy * 100)}%` : '—',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white px-2 py-2.5">
            <div className="text-base font-semibold tabular-nums text-zinc-900">{s.value}</div>
            <div className="mt-0.5 text-[10px] leading-tight text-zinc-500">{s.label}</div>
          </div>
        ))}
      </section>

      <Heatmap counts={counts} />

      <Forecast days={forecastDays} onPick={() => navigate('/review')} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-800">回忆正确率</h2>
          <span className="text-[10px] text-zinc-400">近 30 天 · 点科目展开章节</span>
        </div>

        {accSubjects.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-400">近 30 天还没有评分记录</p>
        ) : (
          <ul className="space-y-2">
            {accSubjects.map((s) => {
              const open = expandedAccuracy === s.id;
              const children = accChapters
                .filter((c) => chapterMap.get(c.id)?.subjectId === s.id)
                .sort((a, b) => a.rate - b.rate);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    data-testid="accuracy-subject"
                    onClick={() => setExpandedAccuracy(open ? null : s.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-zinc-700">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                        <ChevronDown
                          size={12}
                          className={cn(
                            'text-zinc-300 transition-transform',
                            open && 'rotate-180'
                          )}
                        />
                      </span>
                      <span className="text-xs">
                        <span className="font-medium tabular-nums text-zinc-900">
                          {Math.round(s.rate * 100)}%
                        </span>
                        <span className="ml-1 text-[10px] text-zinc-400">{s.total} 次</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn('h-full rounded-full', masteryColor(s.rate))}
                        style={{ width: `${Math.max(3, s.rate * 100)}%` }}
                      />
                    </div>
                  </button>

                  {open && (
                    <ul className="ml-2 mt-1.5 space-y-1.5 border-l border-zinc-100 pl-3">
                      {children.length === 0 && (
                        <li className="text-[10px] text-zinc-400">这个科目还没有复习记录</li>
                      )}
                      {children.map((c) => (
                        <li key={c.id}>
                          <div className="flex items-baseline justify-between">
                            <span className="truncate text-[11px] text-zinc-600">{c.name}</span>
                            <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                              {Math.round(c.rate * 100)}%
                              <span className="ml-1 text-[9px] text-zinc-300">{c.total}</span>
                            </span>
                          </div>
                          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className={cn('h-full rounded-full', masteryColor(c.rate))}
                              style={{ width: `${Math.max(3, c.rate * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-zinc-400">
          <span>忘记 {dist[1]}</span>
          <span>模糊 {dist[2]}</span>
          <span>记得 {dist[3]}</span>
          <span>熟练 {dist[4]}</span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
          正确率 = 自评「记得 / 熟练」的次数占比；评「忘记 / 模糊」都算这次没回忆起来。
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-800">错因分布</h2>
          <span className="text-[10px] text-zinc-400">共 {tagDist.reduce((s, t) => s + t.count, 0)} 个标签</span>
        </div>

        {tagDist.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-400">
            还没有打错因标签。录题或编辑时，在「更多信息 → 错因标签」里勾一下。
          </p>
        ) : (
          <ul className="space-y-2.5">
            {tagDist.map((t) => (
              <li key={t.tag}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-zinc-700">{t.tag}</span>
                  <span className="tabular-nums text-zinc-500">{t.count} 题</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (t.count / Math.max(1, tagDist[0].count)) * 100)}%`,
                      backgroundColor: ERROR_TAG_COLORS[t.tag] ?? '#f97316',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-800">章节掌握度</h2>
          <span className="text-[10px] text-zinc-400">越靠前越薄弱，可一键加练</span>
        </div>

        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          <button
            type="button"
            onClick={() => setSubjectFilter(undefined)}
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[11px]',
              !subjectFilter ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
            )}
          >
            全部
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectFilter(s.id)}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px]',
                subjectFilter === s.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
            </button>
          ))}
        </div>

        {visibleMastery.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-400">这个科目还没有错题</p>
        ) : (
          <ul className="space-y-2.5">
            {visibleMastery.map((m) => (
              <li key={m.chapterId} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/library?subject=${m.subjectId}&chapter=${m.chapterId}`)
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: subjectMap.get(m.subjectId)?.color }}
                      />
                      <span className="truncate text-xs text-zinc-700">{m.chapterName}</span>
                    </span>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-900">
                      {Math.round(m.retention * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={cn('h-full rounded-full', masteryColor(m.retention))}
                      style={{ width: `${Math.max(3, m.retention * 100)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-400">
                    {m.total} 题 · 已掌握 {m.archived} · 待复习 {m.due}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const n = await practiceChapter(m.chapterId, 5);
                    toast.show(
                      n > 0 ? `已把 ${n} 道题加入今日队列` : '这个章节的题今天都已在队列里',
                      n > 0 ? 'success' : 'info'
                    );
                  }}
                  className="mt-0.5 shrink-0 rounded-lg border border-orange-200 px-2 py-1 text-[10px] text-orange-600 active:bg-orange-50"
                >
                  加练
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">
          掌握度 = 该章节题目的平均记忆保持率（FSRS 预测「现在还记得」的概率），
          已标记掌握的题按 100% 计。点章节看错题，点「加练」把最弱的 5 道提前到今天。
        </p>
      </section>

      <div className="h-2" />
    </div>
  );
}
