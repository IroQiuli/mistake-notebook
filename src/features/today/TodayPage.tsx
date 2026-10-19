import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, FileStack, Flame, Plus } from 'lucide-react';
import { db, getSetting } from '../../storage/db';
import { buildQueue } from '../../domain/queue';
import { dayKey, formatToday, learningDayStart } from '../../domain/time';
import { calcStreak, problemsDueOn } from '../../domain/stats';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { cn } from '../../ui/cn';
import { DetailDialog, type DetailMode } from './DetailDialog';

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const pct = Math.min(1, done / Math.max(1, goal));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#e4e4e7" strokeWidth="6" />
        {pct > 0 && (
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${pct * circumference} ${circumference}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-zinc-900">{done}</span>
        <span className="text-[9px] text-zinc-400">/ {goal}</span>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);
  const lastBackupAt = useLiveQuery(() => getSetting<number>('lastBackupAt', 0), [], 0);
  const dailyGoal = useLiveQuery(() => getSetting<number>('dailyGoal', 20), [], 20);
  const subjectGoals = useLiveQuery(
    () => getSetting<Record<string, number>>('subjectGoals', {}),
    [],
    {}
  );

  const [openOffset, setOpenOffset] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailMode | null>(null);
  const [now] = useState(() => Date.now());

  const quotas = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [sid, n] of Object.entries(subjectGoals ?? {})) {
      if (Number.isFinite(n)) out[sid] = n;
    }
    return out;
  }, [subjectGoals]);

  const hasQuotas = Object.keys(quotas).length > 0;
  const queue = useMemo(
    () => buildQueue(problems, cards, { now, quotas: hasQuotas ? quotas : undefined }),
    [problems, cards, now, quotas, hasQuotas]
  );
  const streak = calcStreak(logs, now);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);

  const perSubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of queue) {
      map.set(item.problem.subjectId, (map.get(item.problem.subjectId) ?? 0) + 1);
    }
    return map;
  }, [queue]);

  /** 今天每个科目已经复习了几道（按科目统计评分次数） */
  const reviewedBySubject = useMemo(() => {
    const map = new Map<string, number>();
    const today = dayKey(now);
    for (const l of logs) {
      if (l.rating === 0) continue;
      if (dayKey(l.reviewedAt) !== today) continue;
      const p = problemMap.get(l.problemId);
      if (!p) continue;
      map.set(p.subjectId, (map.get(p.subjectId) ?? 0) + 1);
    }
    return map;
  }, [logs, problemMap, now]);

  const todayReviewed = logs.filter(
    (l) => l.rating !== 0 && dayKey(l.reviewedAt) === dayKey(now)
  ).length;
  const weekReviewed = logs.filter(
    (l) => l.rating !== 0 && l.reviewedAt >= now - 7 * 24 * 3600 * 1000
  ).length;
  const activeCount = problems.filter((p) => !p.archivedAt).length;

  const goalTotal = hasQuotas
    ? Object.values(quotas).reduce((s, n) => s + Math.max(0, n), 0)
    : dailyGoal;

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const upcoming = useMemo(
    () =>
      [
        { offset: 1, label: '明天' },
        { offset: 3, label: '3 天后' },
        { offset: 7, label: '7 天后' },
      ].map((u) => ({ ...u, list: problemsDueOn(problems, cards, u.offset, now) })),
    [problems, cards, now]
  );

  const backupDays = lastBackupAt
    ? Math.floor((learningDayStart(now) - learningDayStart(lastBackupAt)) / 86400000)
    : null;
  const needBackup = lastBackupAt === 0 || (backupDays ?? 0) >= 7;

  const quotaSubjects = hasQuotas
    ? subjects.filter((s) => (quotas[s.id] ?? 0) > 0)
    : [];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pt-1">
        <div>
          <div className="text-xs text-zinc-500">{formatToday(now)}</div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900">今天要复习的</h1>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600">
            <Flame size={14} />
            连续 {streak} 天
          </div>
        )}
      </header>

      {needBackup && (
        <Link
          to="/settings"
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800"
        >
          <span>
            {lastBackupAt === 0 ? '还没备份过数据' : `距离上次备份已 ${backupDays} 天`}
            ，建议现在导出一份
          </span>
          <ChevronRight size={14} />
        </Link>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-baseline gap-2">
          <span data-testid="queue-count" className="text-4xl font-semibold tabular-nums text-zinc-900">
            {queue.length}
          </span>
          <span className="text-sm text-zinc-500">道待复习</span>
        </div>

        {quotaSubjects.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-zinc-50 px-3 py-2.5">
            {quotaSubjects.map((s) => {
              const done = reviewedBySubject.get(s.id) ?? 0;
              const goal = quotas[s.id] ?? 0;
              const pct = Math.min(1, done / Math.max(1, goal));
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="w-20 shrink-0 truncate text-[11px] text-zinc-600">
                    {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                    <span
                      className="block h-full rounded-full transition-[width]"
                      style={{
                        width: `${pct * 100}%`,
                        backgroundColor: done >= goal ? '#10b981' : s.color,
                      }}
                    />
                  </span>
                  <span
                    className={cn(
                      'w-9 shrink-0 text-right text-[11px] tabular-nums',
                      done >= goal ? 'text-emerald-600' : 'text-zinc-500'
                    )}
                  >
                    {done}/{goal}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {queue.length > 0 ? (
          <div className="mt-4 flex gap-2">
            <Button variant="primary" size="xl" className="flex-1" onClick={() => navigate('/review')}>
              开始复习
            </Button>
            <Button size="xl" onClick={() => navigate('/paper')} aria-label="组一套卷">
              <FileStack size={18} />
              组卷
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-zinc-50 py-6 text-center">
            <p className="text-sm text-zinc-500">今天没有到期的错题</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="primary" size="md" onClick={() => navigate('/capture')}>
                去录一道错题
              </Button>
              <Button size="md" onClick={() => navigate('/paper')}>
                <FileStack size={16} />
                组一套卷
              </Button>
            </div>
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {subjects
              .filter((s) => (perSubject.get(s.id) ?? 0) > 0)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(`/review?subject=${s.id}`)}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 active:bg-zinc-50"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                  <span className="tabular-nums text-zinc-400">{perSubject.get(s.id)}</span>
                </button>
              ))}
          </div>
        )}
      </section>

      <section className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <GoalRing done={todayReviewed} goal={goalTotal} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-800">今日目标</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            {todayReviewed >= goalTotal
              ? `已完成，多做了 ${todayReviewed - goalTotal} 题`
              : `还差 ${goalTotal - todayReviewed} 题`}
            {hasQuotas && <span className="text-zinc-400"> · 各科合计</span>}
          </div>
        </div>
        <Link to="/settings" className="shrink-0 text-[11px] text-zinc-400">
          调整
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        {(
          [
            { key: 'today', label: '今日已复习', value: todayReviewed },
            { key: 'week', label: '近 7 天', value: weekReviewed },
            { key: 'active', label: '未掌握', value: activeCount },
          ] as const
        ).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setDetail(s.key)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left transition-colors active:bg-zinc-50"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-semibold tabular-nums text-zinc-900">{s.value}</span>
              <ChevronRight size={13} className="text-zinc-300" />
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{s.label}</div>
          </button>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">接下来</h2>
          <Link to="/library" className="text-xs text-zinc-400">
            全部错题
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {upcoming.map((u) => (
            <button
              key={u.offset}
              type="button"
              onClick={() => setOpenOffset(u.offset)}
              disabled={u.list.length === 0}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left active:bg-zinc-50 disabled:opacity-60"
            >
              <div className="text-xl font-semibold tabular-nums text-zinc-900">
                {u.list.length}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">{u.label}</div>
            </button>
          ))}
        </div>

        {problems.length === 0 && (
          <div className="mt-3 rounded-2xl border border-dashed border-zinc-300">
            <EmptyState
              icon={<Plus size={28} />}
              title="还没有错题"
              description="拍一张做错的题，或从相册选图，30 秒建立你的第一张错题卡。"
              action={
                <Button variant="primary" onClick={() => navigate('/capture')}>
                  录第一道错题
                </Button>
              }
            />
          </div>
        )}
      </section>

      <DetailDialog mode={detail} onClose={() => setDetail(null)} />

      <Dialog
        open={openOffset !== null}
        onClose={() => setOpenOffset(null)}
        title={openOffset !== null ? `${openOffset} 天后要复习的错题` : ''}
        size="md"
      >
        {openOffset !== null && (
          <div className="space-y-2">
            {problemsDueOn(problems, cards, openOffset, now).map((p) => {
              const chapter = chapterMap.get(p.chapterId);
              return (
                <Link
                  key={p.id}
                  to={`/problem/${p.id}`}
                  onClick={() => setOpenOffset(null)}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5 active:bg-zinc-50"
                >
                  <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: subjectMap.get(p.subjectId)?.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-800">
                      {chapter?.name ?? '未分类'}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-400">
                      {p.wrongNote || p.sourcePaper || '没有备注'}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-zinc-300" />
                </Link>
              );
            })}
            {problemsDueOn(problems, cards, openOffset, now).length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-400">这一天没有到期的错题</p>
            )}
          </div>
        )}
      </Dialog>

      <footer className={cn('pt-2 text-center text-[11px] leading-relaxed text-zinc-400')}>
        数据只保存在这台设备的浏览器里
        <br />在「我的」里可以导出备份
      </footer>
    </div>
  );
}
