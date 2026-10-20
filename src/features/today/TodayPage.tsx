import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, FileStack, Flame, Plus } from 'lucide-react';
import { db, getSetting } from '../../storage/db';
import { buildQueue } from '../../domain/queue';
import { dayKey, formatToday, learningDayEnd, learningDayStart } from '../../domain/time';
import { calcStreak, problemsDueOn } from '../../domain/stats';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { cn } from '../../ui/cn';
import { DetailDialog, type DetailMode } from './DetailDialog';

function ProgressRing({ done, goal, size = 62 }: { done: number; goal: number; size?: number }) {
  const pct = Math.min(1, done / Math.max(1, goal));
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f4f4f5" strokeWidth="7" />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f97316"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${pct * circumference} ${circumference}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[13px] font-semibold tabular-nums text-zinc-900">{done}</span>
        <span className="text-[9px] text-zinc-400">/{goal}</span>
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
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => Date.now());

  // 弹窗状态放进 URL：从详情页返回时还能自动重开
  const rawDetail = params.get('detail');
  const detail: DetailMode | null =
    rawDetail === 'today' || rawDetail === 'week' || rawDetail === 'active' ? rawDetail : null;
  const setDetail = (mode: DetailMode | null) => {
    const next = new URLSearchParams(params);
    if (mode) next.set('detail', mode);
    else next.delete('detail');
    setParams(next, { replace: true });
  };

  const quotas = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [sid, n] of Object.entries(subjectGoals ?? {})) {
      if (Number.isFinite(n)) out[sid] = n;
    }
    return out;
  }, [subjectGoals]);

  const quotaSubjects = useMemo(
    () => subjects.filter((s) => (quotas[s.id] ?? 0) > 0),
    [subjects, quotas]
  );

  /** 今天计划做几道：配了每科题量就按合计，否则用每日目标 */
  const plan = useMemo(() => {
    const sum = quotaSubjects.reduce((s, sub) => s + (quotas[sub.id] ?? 0), 0);
    return sum > 0 ? sum : dailyGoal;
  }, [quotaSubjects, quotas, dailyGoal]);

  const queue = useMemo(
    () =>
      buildQueue(problems, cards, {
        now,
        quotas: quotaSubjects.length ? quotas : undefined,
        limit: plan,
      }),
    [problems, cards, now, quotas, quotaSubjects.length, plan]
  );

  const streak = calcStreak(logs, now);
  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);

  /** 今天每个科目写了几道（同一题多次只算一次） */
  const reviewedBySubject = useMemo(() => {
    const map = new Map<string, number>();
    const seen = new Set<string>();
    const today = dayKey(now);
    for (const l of logs) {
      if (l.rating === 0) continue;
      if (dayKey(l.reviewedAt) !== today) continue;
      if (seen.has(l.problemId)) continue;
      seen.add(l.problemId);
      const p = problemMap.get(l.problemId);
      if (!p) continue;
      map.set(p.subjectId, (map.get(p.subjectId) ?? 0) + 1);
    }
    return map;
  }, [logs, problemMap, now]);

  /** 今日已写：按题目去重，一天内重复做同一题不重复计数 */
  const todayReviewed = useMemo(() => {
    const today = dayKey(now);
    const seen = new Set<string>();
    for (const l of logs) {
      if (l.rating === 0 || dayKey(l.reviewedAt) !== today) continue;
      seen.add(l.problemId);
    }
    return seen.size;
  }, [logs, now]);

  const weekReviewed = useMemo(() => {
    const seen = new Set<string>();
    for (const l of logs) {
      if (l.rating === 0 || l.reviewedAt < now - 7 * 24 * 3600 * 1000) continue;
      seen.add(l.problemId);
    }
    return seen.size;
  }, [logs, now]);

  const activeCount = problems.filter((p) => !p.archivedAt).length;

  /** 今天到期（含逾期）的总数，用来提示「还有多少顺延到明天」 */
  const dueCount = useMemo(() => {
    const end = learningDayEnd(now);
    const active = new Set(problems.filter((p) => !p.archivedAt).map((p) => p.id));
    return cards.filter((c) => active.has(c.problemId) && c.due <= end).length;
  }, [problems, cards, now]);

  const deferred = Math.max(0, dueCount - queue.length);

  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const upcoming = useMemo(
    () =>
      [
        { offset: 1, label: '明天' },
        { offset: 2, label: '后天' },
        { offset: 3, label: '3 天后' },
      ].map((u) => ({ ...u, list: problemsDueOn(problems, cards, u.offset, now) })),
    [problems, cards, now]
  );

  const backupDays = lastBackupAt
    ? Math.floor((learningDayStart(now) - learningDayStart(lastBackupAt)) / 86400000)
    : null;
  const needBackup = lastBackupAt === 0 || (backupDays ?? 0) >= 7;
  const donePct = Math.min(1, todayReviewed / Math.max(1, plan));

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pt-1">
        <div>
          <div className="text-xs text-zinc-500">{formatToday(now)}</div>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight text-zinc-900">
            今天要写的
          </h1>
        </div>
        {streak > 0 && (
          <div className="mb-1 flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600">
            <Flame size={13} />
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

      {/* 今日计划卡 */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, #ffedd5 0%, rgba(255,255,255,0) 70%)' }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span
                data-testid="queue-count"
                className="text-[44px] font-semibold leading-none tracking-tight tabular-nums text-zinc-900"
              >
                {queue.length}
              </span>
              <span className="text-sm text-zinc-500">道</span>
            </div>
            <div className="mt-1.5 text-sm text-zinc-600">今天要写</div>
            <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              {deferred > 0 ? (
                <>
                  另有 {deferred} 道到期，顺延到明天
                  {quotaSubjects.length > 0 && '（超出每科题量的部分）'}
                </>
              ) : dueCount === 0 ? (
                '今天没有到期的题'
              ) : (
                `今天到期 ${dueCount} 道`
              )}
            </div>
          </div>
          <ProgressRing done={todayReviewed} goal={plan} size={66} />
        </div>

        {queue.length > 0 ? (
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              size="xl"
              className="flex-1"
              onClick={() => navigate('/review')}
            >
              开始写
            </Button>
            <Button size="xl" onClick={() => navigate('/paper')} aria-label="组一套卷">
              <FileStack size={18} />
              组卷
            </Button>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => navigate('/capture')}
            >
              录一道错题
            </Button>
            <Button size="lg" onClick={() => navigate('/paper')}>
              <FileStack size={16} />
              组卷
            </Button>
          </div>
        )}

        {quotaSubjects.length > 0 && (
          <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3">
            {quotaSubjects.map((s) => {
              const done = reviewedBySubject.get(s.id) ?? 0;
              const goal = quotas[s.id] ?? 0;
              const pct = Math.min(1, done / Math.max(1, goal));
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`subject-entry-${s.id}`}
                  onClick={() => navigate(`/review?subject=${s.id}`)}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left active:bg-zinc-100"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="w-[76px] shrink-0 truncate text-[11px] text-zinc-600">
                    {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
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
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 今日完成度 */}
      <section className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-zinc-800">今日进度</span>
            <span className="text-[11px] text-zinc-400">
              {todayReviewed >= plan
                ? `已完成，多写了 ${todayReviewed - plan} 道`
                : `还差 ${plan - todayReviewed} 道`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-orange-500 transition-[width] duration-500"
              style={{ width: `${donePct * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-[10px] text-zinc-400">
            今日计划 {plan} 道 · 已写 {todayReviewed} 道
          </div>
        </div>
        <Link to="/settings" className="shrink-0 text-[11px] text-zinc-400">
          调整
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        {(
          [
            { key: 'today', label: '今日已写', value: todayReviewed },
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
          <h2 className="text-sm font-medium text-zinc-700">接下来 3 天</h2>
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
        title={openOffset !== null ? `${upcoming.find((u) => u.offset === openOffset)?.label ?? ''}要写的错题` : ''}
        size="md"
      >
        {openOffset !== null && (
          <div className="space-y-2">
            {(upcoming.find((u) => u.offset === openOffset)?.list ?? []).map((p) => {
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
            {(upcoming.find((u) => u.offset === openOffset)?.list ?? []).length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-400">这一天没有到期的错题</p>
            )}
          </div>
        )}
      </Dialog>

      <footer className="pt-2 text-center text-[11px] leading-relaxed text-zinc-400">
        数据只保存在这台设备的浏览器里
        <br />在「我的」里可以导出备份
      </footer>
    </div>
  );
}
