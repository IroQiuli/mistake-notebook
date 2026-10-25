import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { db } from '../../storage/db';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { useBack, useGo } from '../../hooks/useBack';
import { displayTitle } from '../../domain/title';
import { weightLabel, weightOf } from '../../domain/weight';
import { masteryLevel } from '../../domain/taxonomy';
import { formatDue } from '../../domain/time';
import type { Card, Problem } from '../../domain/types';
import { PageLoading } from '../../ui/Spinner';
import { EmptyState } from '../../ui/EmptyState';
import { ZoomableImage } from '../../ui/ZoomableImage';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

function SlideCard({
  problem,
  chapterName,
  card,
  now,
  onOpen,
}: {
  problem: Problem;
  chapterName: string;
  card?: Card;
  now: number;
  onOpen: () => void;
}) {
  const url = useAssetUrl(problem.thumbAssetId ?? problem.stemAssetId);
  const [zoom, setZoom] = useState(false);
  const level = masteryLevel(problem.mastery);
  const weight = weightOf(problem);

  return (
    <article className="h-full w-full shrink-0 snap-center px-1">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="relative flex-1 overflow-hidden bg-zinc-100">
          {url ? (
            <button
              type="button"
              onClick={onOpen}
              className="flex h-full w-full items-center justify-center"
            >
              <img src={url} alt={displayTitle(problem, chapterName)} className="max-h-full max-w-full object-contain" />
            </button>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
              图片缺失
            </div>
          )}
          {url && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoom(true);
              }}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white"
            >
              <Maximize2 size={11} />
              大图
            </button>
          )}
        </div>

        <div className="space-y-1.5 border-t border-zinc-100 p-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 text-sm font-medium leading-snug text-zinc-900">
              {displayTitle(problem, chapterName)}
            </h2>
            <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-600">
              权重 {weight}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            {level && (
              <span
                className="rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: level.soft, color: level.color }}
              >
                {level.label}
              </span>
            )}
            <span>{weightLabel(weight)}</span>
            <span>·</span>
            <span>{card ? `下次 ${formatDue(card.due, now)}` : '无排期'}</span>
          </div>
          {problem.wrongNote && (
            <p className="line-clamp-2 text-[11px] text-zinc-500">{problem.wrongNote}</p>
          )}
          <Button size="sm" block onClick={onOpen} className="mt-1">
            打开题目
          </Button>
        </div>
      </div>

      {zoom && url && (
        <ZoomableImage
          src={url}
          initialFullscreen={true}
          onClose={() => setZoom(false)}
          title="错题大图查看"
        />
      )}
    </article>
  );
}

/** 章节页：同章节的题左右滑动切换 */
export default function ChapterPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const back = useBack('/library');
  const openProblem = useGo();
  const [params, setParams] = useSearchParams();
  const problems = useLiveQuery(
    () => db.problems.where('chapterId').equals(id).toArray(),
    [id],
    []
  );
  const chapter = useLiveQuery(() => db.chapters.get(id), [id]);
  const cards = useLiveQuery(() => db.cards.toArray(), [], []);
  const scroller = useRef<HTMLDivElement>(null);
  const lastScrollAt = useRef(0);
  const now = Date.now();

  const list = useMemo(
    () => problems.filter((p) => !p.archivedAt).sort((a, b) => a.createdAt - b.createdAt),
    [problems]
  );
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.problemId, c])), [cards]);

  // 当前是第几张，存在 URL 里（?i=2），返回时能回到同一张
  const rawIndex = Number(params.get('i') ?? 0);
  const index = Number.isFinite(rawIndex)
    ? Math.min(Math.max(0, Math.round(rawIndex)), Math.max(0, list.length - 1))
    : 0;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth });
    // 只在切换章节 / 题目数量变化时定位，避免和滚动回调互相打架
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, list.length, chapter?.id]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (next === index) return;
    const at = Date.now();
    if (at - lastScrollAt.current < 120) return;
    lastScrollAt.current = at;
    const p = new URLSearchParams(params);
    if (next > 0) p.set('i', String(next));
    else p.delete('i');
    setParams(p, { replace: true });
  };

  const go = (delta: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.min(list.length - 1, Math.max(0, index + delta));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  if (!chapter) return <PageLoading />;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={back}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-medium text-zinc-800">{chapter.name}</div>
          <div className="text-[11px] text-zinc-400">
            {list.length} 题{list.length > 0 ? ` · 第 ${index + 1} 题` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/search?chapter=${chapter.id}`)}
          className="h-9 rounded-lg px-2 text-[11px] text-zinc-500 active:bg-zinc-100"
        >
          列表
        </button>
      </header>

      {list.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            title="这一章还没有题"
            description="去录入一道，会自动归到这个章节。"
            action={
              <Button variant="primary" onClick={() => navigate('/capture')}>
                去录题
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div
            ref={scroller}
            onScroll={onScroll}
            data-testid="chapter-scroller"
            className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto pb-1"
          >
            {list.map((p) => (
              <SlideCard
                key={p.id}
                problem={p}
                chapterName={chapter.name}
                card={cardMap.get(p.id)}
                now={now}
                onOpen={() => openProblem(`/problem/${p.id}`)}
              />
            ))}
          </div>

          <footer className="flex items-center justify-between px-4 pb-4 pt-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index <= 0}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50',
                index <= 0 && 'text-zinc-300'
              )}
              aria-label="上一题"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex gap-1.5">
              {list.map((p, i) => (
                <span
                  key={p.id}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-4 bg-orange-500' : 'w-1.5 bg-zinc-200'
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              disabled={index >= list.length - 1}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50',
                index >= list.length - 1 && 'text-zinc-300'
              )}
              aria-label="下一题"
            >
              <ChevronRight size={18} />
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
