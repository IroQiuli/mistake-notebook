import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useGo } from '../../hooks/useBack';
import { ChevronRight } from 'lucide-react';
import { db } from '../../storage/db';
import { dayKey, formatDateTime, learningDayStart } from '../../domain/time';
import { displayTitle } from '../../domain/title';
import { RATING_LABEL, type Rating, type ReviewLog } from '../../domain/types';
import { Dialog } from '../../ui/Dialog';
import { cn } from '../../ui/cn';

export type DetailMode = 'today' | 'week' | 'active';

const RATING_BADGE: Record<Rating, string> = {
  1: 'bg-red-50 text-red-600',
  2: 'bg-amber-50 text-amber-700',
  3: 'bg-emerald-50 text-emerald-700',
  4: 'bg-sky-50 text-sky-700',
};

const WEEK_LABEL = ['日', '一', '二', '三', '四', '五', '六'];

function dayLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} 周${WEEK_LABEL[d.getDay()]}`;
}

/** 同一道题一天可能复习多次，这里只留最新一条 */
function latestPerProblem(list: ReviewLog[]): ReviewLog[] {
  const seen = new Set<string>();
  const out: ReviewLog[] = [];
  for (const log of list) {
    if (seen.has(log.problemId)) continue;
    seen.add(log.problemId);
    out.push(log);
  }
  return out;
}

export function DetailDialog({
  mode,
  onClose,
}: {
  mode: DetailMode | null;
  onClose: () => void;
}) {
  const go = useGo();
  const [now] = useState(() => Date.now());

  const problems = useLiveQuery(() => db.problems.toArray(), [], []);
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []);
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [], []);

  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const problemMap = useMemo(() => new Map(problems.map((p) => [p.id, p])), [problems]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  const days = useMemo(() => {
    const start = learningDayStart(now);
    return Array.from({ length: 7 }, (_, i) => {
      const ts = start - (6 - i) * 86400000;
      const key = dayKey(ts);
      const all = logs
        .filter((l) => l.rating !== 0 && dayKey(l.reviewedAt) === key)
        .sort((a, b) => b.reviewedAt - a.reviewedAt);
      return { ts, key, list: latestPerProblem(all), rawCount: all.length };
    });
  }, [logs, now]);

  const todayList = days[6].list;
  const selected = pickedDay ?? days[6].key;
  const selectedDay = days.find((d) => d.key === selected) ?? days[6];
  const maxCount = Math.max(1, ...days.map((d) => d.list.length));

  const activeGroups = useMemo(() => {
    const bySubject = new Map<string, { chapterId: string; count: number }[]>();
    for (const p of problems) {
      if (p.archivedAt) continue;
      const arr = bySubject.get(p.subjectId) ?? [];
      const found = arr.find((x) => x.chapterId === p.chapterId);
      if (found) found.count++;
      else arr.push({ chapterId: p.chapterId, count: 1 });
      bySubject.set(p.subjectId, arr);
    }
    return [...bySubject.entries()]
      .map(([subjectId, list]) => ({
        subjectId,
        total: list.reduce((s, x) => s + x.count, 0),
        chapters: list.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);
  }, [problems]);

  /** 按科目 → 章节分组展示记录 */
  const renderGroups = (list: ReviewLog[]) => {
    const groups = new Map<string, ReviewLog[]>();
    for (const log of list) {
      const p = problemMap.get(log.problemId);
      const key = p ? `${p.subjectId}|${p.chapterId}` : 'unknown';
      const arr = groups.get(key) ?? [];
      arr.push(log);
      groups.set(key, arr);
    }

    return (
      <div className="space-y-3">
        {[...groups.entries()].map(([key, items]) => {
          const [subjectId, chapterId] = key.split('|');
          const subject = subjectMap.get(subjectId);
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: subject?.color ?? '#d4d4d8' }}
                />
                {subject?.name.replace('839 自动控制原理及过程控制', '839 自控') ?? '未知'}
                <span className="font-normal text-zinc-400">
                  · {chapterMap.get(chapterId)?.name ?? '未分类'}
                </span>
                <span className="ml-auto text-[10px] font-normal text-zinc-400">
                  {items.length} 题
                </span>
              </div>
              <ul className="mt-1 divide-y divide-zinc-100 rounded-xl border border-zinc-100">
                {items.map((l) => {
                  const p = problemMap.get(l.problemId);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => go(`/problem/${l.problemId}`)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left active:bg-zinc-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-zinc-800">
                            {p ? displayTitle(p, chapterMap.get(p.chapterId)?.name) : '已删除'}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-400">
                            {formatDateTime(l.reviewedAt).slice(5)}
                            {p?.wrongNote ? ` · ${p.wrongNote}` : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px]',
                            RATING_BADGE[l.rating as Rating] ?? 'bg-zinc-100 text-zinc-500'
                          )}
                        >
                          {l.rating === 0 ? '改期' : RATING_LABEL[l.rating as Rating]}
                        </span>
                        <ChevronRight size={13} className="shrink-0 text-zinc-300" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    );
  };

  if (mode === null) return null;

  if (mode === 'today') {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Rating, number>;
    for (const l of todayList) if (l.rating) counts[l.rating as Rating]++;
    return (
      <Dialog open onClose={onClose} title="今天写过的题" size="md">
        <div className="-mt-1 mb-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
          <span>共 {todayList.length} 道（同一题多次只算一次）</span>
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <span key={r} className={cn('rounded-full px-2 py-0.5', RATING_BADGE[r])}>
              {RATING_LABEL[r]} {counts[r]}
            </span>
          ))}
        </div>
        {todayList.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-400">今天还没有写过</p>
        ) : (
          renderGroups(todayList)
        )}
      </Dialog>
    );
  }

  if (mode === 'week') {
    return (
      <Dialog open onClose={onClose} title="最近 7 天" size="md">
        <div className="flex items-end gap-1.5">
          {days.map((d) => {
            const isSel = d.key === selected;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setPickedDay(d.key)}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] tabular-nums text-zinc-400">
                  {d.list.length || ''}
                </span>
                <span
                  className={cn(
                    'w-full rounded-t-md transition-colors',
                    isSel ? 'bg-orange-500' : 'bg-orange-200'
                  )}
                  style={{ height: `${12 + (d.list.length / maxCount) * 54}px` }}
                />
                <span
                  className={cn(
                    'text-[10px]',
                    isSel ? 'font-medium text-zinc-700' : 'text-zinc-400'
                  )}
                >
                  {new Date(d.ts).getDate()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-zinc-100 pt-2">
          <span className="text-xs font-medium text-zinc-700">{dayLabel(selectedDay.ts)}</span>
          <span className="text-[11px] text-zinc-400">{selectedDay.list.length} 道</span>
        </div>

        {selectedDay.list.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-400">这天没有写</p>
        ) : (
          renderGroups(selectedDay.list)
        )}
      </Dialog>
    );
  }

  const total = activeGroups.reduce((s, g) => s + g.total, 0);
  return (
    <Dialog open onClose={onClose} title="未掌握的错题" size="md">
      <p className="-mt-1 mb-2 text-[11px] text-zinc-500">
        共 {total} 道，按科目和章节分组，点进去看这一类
      </p>
      <div className="space-y-3">
        {activeGroups.map((g) => {
          const s = subjectMap.get(g.subjectId);
          return (
            <div key={g.subjectId}>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s?.color ?? '#d4d4d8' }}
                />
                {s?.name.replace('839 自动控制原理及过程控制', '839 自控') ?? '未分类'}
                <span className="text-[11px] font-normal text-zinc-400">{g.total} 题</span>
              </div>
              <ul className="mt-1 space-y-0.5 pl-4">
                {g.chapters.map((c) => (
                  <li key={c.chapterId}>
                    <button
                      type="button"
                      onClick={() => go(`/chapter/${c.chapterId}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] text-zinc-600 active:bg-zinc-50"
                    >
                      <span className="truncate">
                        {chapterMap.get(c.chapterId)?.name ?? '未分类'}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-400">{c.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
