import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Flame, Plus } from 'lucide-react';
import { db, getSetting } from '../../storage/db';
import { buildQueue } from '../../domain/queue';
import { dayKey, formatToday, learningDayStart } from '../../domain/time';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { cn } from '../../ui/cn';

function useStreak(logs: { reviewedAt: number }[]): number {
  return useMemo(() => {
    const keys = new Set(logs.map((l) => dayKey(l.reviewedAt)));
    let streak = 0;
    let cursor = Date.now();
    if (!keys.has(dayKey(cursor))) cursor -= 24 * 3600 * 1000;
    while (keys.has(dayKey(cursor))) {
      streak++;
      cursor -= 24 * 3600 * 1000;
    }
    return streak;
  }, [logs]);
}

function RecentItem({ id }: { id: string }) {
  const problem = useLiveQuery(() => db.problems.get(id), [id]);
  const url = useAssetUrl(problem?.thumbAssetId ?? problem?.stemAssetId);
  const chapter = useLiveQuery(
    () => (problem ? db.chapters.get(problem.chapterId) : undefined),
    [problem?.chapterId]
  );

  if (!problem) return null;
  return (
    <Link
      to={`/problem/${problem.id}`}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-2.5 active:bg-zinc-50"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
            无图
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-800">{chapter?.name ?? '未分类'}</div>
        <div className="truncate text-xs text-zinc-500">
          {problem.wrongNote || problem.sourcePaper || '没有填写错误原因'}
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-zinc-300" />
    </Link>
  );
}

export default function TodayPage() {
  const navigate = useNavigate();
  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);
  const lastBackupAt = useLiveQuery(() => getSetting<number>('lastBackupAt', 0), [], 0);

  const now = Date.now();
  const queue = useMemo(() => buildQueue(problems, cards, { now }), [problems, cards, now]);
  const streak = useStreak(logs);

  const perSubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of queue) {
      map.set(item.problem.subjectId, (map.get(item.problem.subjectId) ?? 0) + 1);
    }
    return map;
  }, [queue]);

  const todayReviewed = logs.filter((l) => dayKey(l.reviewedAt) === dayKey(now)).length;
  const weekReviewed = logs.filter((l) => l.reviewedAt >= now - 7 * 24 * 3600 * 1000).length;
  const activeCount = problems.filter((p) => !p.archivedAt).length;
  const recent = useMemo(
    () => [...problems].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [problems]
  );

  const backupDays = lastBackupAt
    ? Math.floor((learningDayStart(now) - learningDayStart(lastBackupAt)) / 86400000)
    : null;
  const needBackup = lastBackupAt === 0 || (backupDays ?? 0) >= 7;

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
          <span className="text-4xl font-semibold tabular-nums text-zinc-900">{queue.length}</span>
          <span className="text-sm text-zinc-500">道待复习</span>
        </div>
        {queue.length > 0 ? (
          <Button
            variant="primary"
            size="xl"
            block
            className="mt-4"
            onClick={() => navigate('/review')}
          >
            开始复习
          </Button>
        ) : (
          <div className="mt-4 rounded-xl bg-zinc-50 py-6 text-center">
            <p className="text-sm text-zinc-500">今天没有到期的错题</p>
            <Button
              variant="primary"
              size="md"
              className="mt-3"
              onClick={() => navigate('/capture')}
            >
              去录一道错题
            </Button>
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

      <section className="grid grid-cols-3 gap-2.5">
        {[
          { label: '今日已复习', value: todayReviewed },
          { label: '近 7 天', value: weekReviewed },
          { label: '未掌握', value: activeCount },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <div className="text-xl font-semibold tabular-nums text-zinc-900">{s.value}</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{s.label}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">最近录入</h2>
          <Link to="/library" className="text-xs text-zinc-400">
            全部错题
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300">
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
        ) : (
          <div className="space-y-2">
            {recent.map((p) => (
              <RecentItem key={p.id} id={p.id} />
            ))}
          </div>
        )}
      </section>

      <footer className={cn('pt-2 text-center text-[11px] leading-relaxed text-zinc-400')}>
        数据只保存在这台设备的浏览器里
        <br />
        在「我的」里可以导出备份
      </footer>
    </div>
  );
}
