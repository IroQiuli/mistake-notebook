import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Eye } from 'lucide-react';
import { db } from '../../storage/db';
import { previewIntervals } from '../../domain/scheduler';
import { formatDue, formatDuration, formatDateTime } from '../../domain/time';
import { RATING_LABEL, type Rating } from '../../domain/types';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { getUrl } from '../../storage/assets';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PageLoading } from '../../ui/Spinner';
import { ZoomableImage } from '../../ui/ZoomableImage';
import { cn } from '../../ui/cn';
import { useSession } from './useSession';

const RATING_STYLE: Record<Rating, string> = {
  1: 'border-red-200 bg-red-50 text-red-600',
  2: 'border-amber-200 bg-amber-50 text-amber-700',
  3: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  4: 'border-sky-200 bg-sky-50 text-sky-700',
};

export default function ReviewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const subjectId = params.get('subject') ?? undefined;
  const { queue, index, current, revealed, finished, summary, reveal, rate } = useSession(subjectId);

  const problemId = current?.problem.id;

  const chapter = useLiveQuery(
    () => (current ? db.chapters.get(current.problem.chapterId) : undefined),
    [current?.problem.chapterId]
  );
  const subject = useLiveQuery(
    () => (current ? db.subjects.get(current.problem.subjectId) : undefined),
    [current?.problem.subjectId]
  );
  const recentLogs = useLiveQuery(
    async () => {
      if (!problemId) return [];
      const list = await db.reviewLogs.where('problemId').equals(problemId).toArray();
      return list
        .filter((l) => l.rating !== 0)
        .sort((a, b) => b.reviewedAt - a.reviewedAt)
        .slice(0, 3);
    },
    [problemId],
    []
  );

  const stemUrl = useAssetUrl(current?.problem.stemAssetId);
  const answerUrls = useLiveQuery(
    async () => {
      if (!current) return [] as string[];
      const urls: string[] = [];
      for (const id of current.problem.answerAssetIds) {
        const url = await getUrl(id);
        if (url) urls.push(url);
      }
      return urls;
    },
    [current?.problem.id],
    []
  );

  const preview = useMemo(
    () => (current ? previewIntervals(current.card, Date.now()) : null),
    [current]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (!revealed) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          reveal();
        }
        return;
      }
      const map: Record<string, Rating> = { '1': 1, '2': 2, '3': 3, '4': 4 };
      const rating = map[e.key];
      if (rating) {
        e.preventDefault();
        void rate(rating);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, finished, rate, reveal]);

  if (queue === null) return <PageLoading label="准备复习队列" />;

  if (finished) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <div className="text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-3 text-xl font-semibold text-zinc-900">这一轮复习完了</h1>
          <p className="mt-1 text-sm text-zinc-500">
            共 {summary.total} 题 · 用时 {formatDuration(summary.durationMs)}
          </p>
        </div>
        <div className="mt-6 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4">
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <div key={r} className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">{RATING_LABEL[r]}</span>
              <span className="font-medium tabular-nums text-zinc-900">{summary.counts[r]}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2">
          <Button variant="primary" size="lg" block onClick={() => navigate('/')}>
            回到今日
          </Button>
          <Button size="lg" block onClick={() => navigate('/library')}>
            看看错题本
          </Button>
        </div>
        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400">
          下一批到期时间已按你的评分自动排好
          <br />
          评「忘记」的题今天还可再复习一次
        </p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <EmptyState
          icon={<Eye size={30} />}
          title="没有到期的错题"
          description="今天先休息一下，或者去录几道新错题。"
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => navigate('/capture')}>
                录错题
              </Button>
              <Button onClick={() => navigate('/library')}>错题本</Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 safe-top">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="退出复习"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-xs font-medium text-zinc-700">
            {index + 1} / {queue.length}
          </div>
          <div className="text-[11px] text-zinc-400">
            {subject?.name.replace('839 自动控制原理及过程控制', '839 自控')} ·{' '}
            {chapter?.name ?? '未分类'}
          </div>
        </div>
        <div className="h-10 w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100">
        {stemUrl ? (
          <ZoomableImage
            src={stemUrl}
            className="h-full min-h-[45vh] w-full"
            alt={`题目 ${index + 1}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-400">
            这道题的图片缺失，你可以直接自评或退出后删除它
          </div>
        )}
      </div>

      {revealed && (
        <div className="max-h-[45vh] overflow-y-auto border-t border-zinc-100 bg-white px-4 py-3">
          {answerUrls.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {answerUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`答案 ${i + 1}`}
                  className="h-52 w-auto rounded-lg border border-zinc-200 object-contain"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">没有上传答案图</p>
          )}

          {current.problem.wrongNote && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
              <span className="text-[11px] font-medium text-amber-700">当时为什么错</span>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                {current.problem.wrongNote}
              </p>
            </div>
          )}

          {recentLogs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-zinc-400">
              {recentLogs.map((l) => (
                <span key={l.id}>
                  {formatDateTime(l.reviewedAt).slice(5)} ·{' '}
                  {l.rating === 0 ? '改期' : RATING_LABEL[l.rating]}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-zinc-100 px-3 pb-3 pt-2 safe-bottom">
        {!revealed ? (
          <Button variant="primary" size="xl" block onClick={reveal}>
            看答案
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => void rate(r)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-xl border py-2.5 active:opacity-80',
                  RATING_STYLE[r]
                )}
              >
                <span className="text-sm font-medium">{RATING_LABEL[r]}</span>
                <span className="text-[10px] opacity-70">
                  {preview ? formatDue(preview[r], Date.now()) : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}
