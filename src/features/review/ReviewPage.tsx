import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Eye, EyeOff, FileStack } from 'lucide-react';
import { db } from '../../storage/db';
import { clearActivePaper, loadActivePaper, type ActivePaper } from '../../storage/paper';
import { getUrl } from '../../storage/assets';
import { latestInk } from '../../storage/inks';
import { previewIntervals } from '../../domain/scheduler';
import { formatDue, formatDuration, formatDateTime } from '../../domain/time';
import { RATING_LABEL, type Rating } from '../../domain/types';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { InkSurface, type InkSurfaceHandle } from '../../ink/InkSurface';
import { InkToolbar } from '../../ink/InkToolbar';
import { useInk } from '../../ink/useInk';
import { useInkTools } from '../../ink/useInkTools';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
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

/** 一次复习中的作答层：每次进入都新建，不显示上一次的解题笔迹 */
function WriteArea({
  problemId,
  stemUrl,
  showOldInk,
  writing,
  onToggleWriting,
}: {
  problemId: string;
  stemUrl: string;
  showOldInk: boolean;
  writing: boolean;
  onToggleWriting: () => void;
}) {
  const ink = useInk('attempt', problemId, 0, { fresh: true });
  const tools = useInkTools();
  const surface = useRef<InkSurfaceHandle>(null);
  const oldInk = useLiveQuery(() => latestInk('problem-stem', problemId), [problemId]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <InkSurface
          ref={surface}
          src={stemUrl}
          strokes={ink.strokes}
          onChange={ink.update}
          tool={tools.tool}
          color={tools.color}
          width={tools.width}
          enabled={writing}
          backgroundStrokes={showOldInk ? (oldInk?.strokes ?? []) : []}
          alt="题干，可直接书写"
        />
      </div>

      {writing ? (
        <div className="mt-2 space-y-1">
          <InkToolbar
            tool={tools.tool}
            color={tools.color}
            width={tools.width}
            onToolChange={tools.setTool}
            onColorChange={tools.setColor}
            onWidthChange={tools.setWidth}
            onUndo={() => surface.current?.undo()}
            onRedo={() => surface.current?.redo()}
            onClear={() => {
              if (window.confirm('清空这次作答的笔迹？')) surface.current?.clear();
            }}
          />
          <button
            type="button"
            onClick={onToggleWriting}
            className="w-full py-1 text-center text-[11px] text-zinc-400"
          >
            结束手写（恢复上下滑动）
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggleWriting}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-sm text-zinc-500 active:bg-white"
        >
          ✍️ 开启手写
        </button>
      )}

      <p className="mt-1.5 text-center text-[11px] text-zinc-400">
        {writing ? '直接写，评完分自动保存这次的解题过程' : '现在可以正常上下滑动，看完整道题'}
      </p>
    </div>
  );
}

function ReviewBody({ subjectId, paper }: { subjectId?: string; paper: ActivePaper | null }) {
  const navigate = useNavigate();
  const paperIds = paper?.problemIds;
  const { queue, index, current, revealed, finished, summary, reveal, rate } = useSession(
    subjectId,
    paperIds
  );

  const [showOldInk, setShowOldInk] = useState(false);
  const [writing, setWriting] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
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
    setShowOldInk(false);
    setWriting(false);
  }, [problemId]);

  // 套卷做完就清掉，避免下次进来又在做同一张
  useEffect(() => {
    if (finished && paper) void clearActivePaper();
  }, [finished, paper]);

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

  if (queue === null) return <PageLoading label={paper ? '准备套卷' : '准备复习队列'} />;

  if (finished) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <div className="text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-3 text-xl font-semibold text-zinc-900">
            {paper ? '这套卷做完了' : '这一轮复习完了'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {paper ? `${paper.title} · ` : ''}共 {summary.total} 题 · 用时{' '}
            {formatDuration(summary.durationMs)}
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
          {paper && (
            <Button variant="primary" size="lg" block onClick={() => navigate('/paper')}>
              <FileStack size={16} />
              再组一套
            </Button>
          )}
          <Button
            variant={paper ? 'secondary' : 'primary'}
            size="lg"
            block
            onClick={() => navigate('/')}
          >
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
          title={paper ? '这张卷子里的题不见了' : '没有到期的错题'}
          description={
            paper
              ? '题可能被删掉了，回今日重新组一套吧。'
              : '今天先休息一下，或者去录几道新错题。'
          }
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
        <div className="min-w-0 text-center">
          <div className="text-xs font-medium text-zinc-700">
            {index + 1} / {queue.length}
            {paper && <span className="ml-1 text-[10px] text-orange-500">套卷</span>}
          </div>
          <div className="truncate text-[11px] text-zinc-400">
            {paper ? (
              paper.title
            ) : (
              <>
                {subject?.name.replace('839 自动控制原理及过程控制', '839 自控')} ·{' '}
                {chapter?.name ?? '未分类'}
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowOldInk((v) => !v)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg active:bg-zinc-100',
            showOldInk ? 'text-orange-500' : 'text-zinc-500'
          )}
          aria-label="显示我的旧批注"
        >
          {showOldInk ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 p-2">
        {stemUrl ? (
          <WriteArea
            key={index}
            problemId={current.problem.id}
            stemUrl={stemUrl}
            showOldInk={showOldInk}
            writing={writing}
            onToggleWriting={() => setWriting((v) => !v)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-400">
            这道题的图片缺失，你可以直接自评或退出后删除它
          </div>
        )}
      </div>

      {revealed && (
        <div className="max-h-[38vh] overflow-y-auto border-t border-zinc-100 bg-white px-4 py-3">
          {answerUrls.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {answerUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setZoomUrl(url)}
                  className="shrink-0 overflow-hidden rounded-lg border border-zinc-200 active:opacity-80"
                  aria-label={`放大答案 ${i + 1}`}
                >
                  <img src={url} alt={`答案 ${i + 1}`} className="h-44 w-auto object-contain" />
                </button>
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

      <Dialog open={zoomUrl !== null} onClose={() => setZoomUrl(null)} title="答案" size="lg">
        {zoomUrl && (
          <ZoomableImage src={zoomUrl} className="h-[62vh] w-full rounded-lg" alt="答案大图" />
        )}
      </Dialog>
    </div>
  );
}

function PaperReview() {
  const navigate = useNavigate();
  const [paper, setPaper] = useState<ActivePaper | null | undefined>(undefined);

  useEffect(() => {
    loadActivePaper()
      .then(setPaper)
      .catch(() => setPaper(null));
  }, []);

  if (paper === undefined) return <PageLoading label="准备套卷" />;

  if (!paper) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <EmptyState
          icon={<FileStack size={30} />}
          title="没有进行中的套卷"
          description="去「组一套卷」挑一份题单，或者先做今天到期的题。"
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => navigate('/paper')}>
                去组卷
              </Button>
              <Button onClick={() => navigate('/')}>回到今日</Button>
            </div>
          }
        />
      </div>
    );
  }

  return <ReviewBody paper={paper} />;
}

export default function ReviewPage() {
  const [params] = useSearchParams();
  const paperMode = params.get('paper') === '1';
  const subjectId = params.get('subject') ?? undefined;

  if (paperMode) return <PaperReview />;
  return <ReviewBody subjectId={subjectId} paper={null} />;
}
