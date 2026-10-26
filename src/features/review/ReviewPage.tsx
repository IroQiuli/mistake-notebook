import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FilePlus,
  FileStack,
  ImagePlus,
  Maximize2,
  Timer,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { db, getSetting } from '../../storage/db';
import { clearActivePaper, loadActivePaper, type ActivePaper } from '../../storage/paper';
import { getUrl, putAsset } from '../../storage/assets';
import { previewIntervals } from '../../domain/scheduler';
import { formatDue, formatDuration, formatDateTime } from '../../domain/time';
import { RATING_LABEL, type Rating } from '../../domain/types';
import { weightOf } from '../../domain/weight';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { PageLoading } from '../../ui/Spinner';
import { ZoomableImage } from '../../ui/ZoomableImage';
import { cn } from '../../ui/cn';
import { useBack } from '../../hooks/useBack';
import { useToast } from '../../ui/Toast';
import { useSession } from './useSession';
import { canvasToBlob, prepareImage } from '../capture/pipeline';
import { updateProblem } from '../../storage/problems';
import {
  MikuChibiDizzy,
  MikuChibiThinking,
  MikuChibiThumbsUp,
  MikuChibiSparkle,
  MikuChibiCelebrate,
} from '../../ui/MikuChibi';

const RATING_STYLE: Record<Rating, string> = {
  1: 'border-red-200 bg-red-50 text-red-600',
  2: 'border-amber-200 bg-amber-50 text-amber-700',
  3: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  4: 'border-sky-200 bg-sky-50 text-sky-700',
};

const CHIBI_RATING_ICONS: Record<Rating, React.ReactNode> = {
  1: <MikuChibiDizzy size={28} className="mb-0.5" />,
  2: <MikuChibiThinking size={28} className="mb-0.5" />,
  3: <MikuChibiThumbsUp size={28} className="mb-0.5" />,
  4: <MikuChibiSparkle size={28} className="mb-0.5" />,
};

function ReviewBody({
  subjectId,
  paper,
  onSwitchSubject,
}: {
  subjectId?: string;
  paper: ActivePaper | null;
  onSwitchSubject?: (id?: string) => void;
}) {
  const navigate = useNavigate();
  const back = useBack('/');
  const toast = useToast();
  const paperIds = paper?.problemIds;
  const {
    queue,
    index,
    current,
    revealed,
    finished,
    stats,
    summary,
    reveal,
    rate,
    jump,
    updateCurrentNote,
    deleteCurrentAnswerAsset,
  } = useSession(subjectId, paperIds);

  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const theme = useLiveQuery(() => getSetting<string>('theme', 'miku'), [], 'miku');
  const isMiku = theme === 'miku';

  const problemId = current?.problem.id;

  // 题目切换时重置计时器
  useEffect(() => {
    setTimerSeconds(0);
    setTimerRunning(true);
  }, [current?.problem.id]);

  // 计时器轮询
  useEffect(() => {
    if (!timerRunning || finished) return;
    const t = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerRunning, finished]);

  const formatStopwatch = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const chapter = useLiveQuery(
    () => (current ? db.chapters.get(current.problem.chapterId) : undefined),
    [current?.problem.chapterId]
  );
  const subject = useLiveQuery(
    () => (current ? db.subjects.get(current.problem.subjectId) : undefined),
    [current?.problem.subjectId]
  );
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const recentLogs = useLiveQuery(
    async () => {
      if (!problemId) return [];
      const list = await db.reviewLogs.where('problemId').equals(problemId).toArray();
      return list
        .filter((l) => l.rating !== 0)
        .sort((a, b) => b.reviewedAt - a.reviewedAt)
        .slice(0, 2);
    },
    [problemId],
    []
  );

  const stemUrl = useAssetUrl(current?.problem.stemAssetId);
  const answerAssets = useLiveQuery(
    async () => {
      if (!current) return [] as { id: string; url: string }[];
      const list: { id: string; url: string }[] = [];
      for (const id of current.problem.answerAssetIds) {
        const url = await getUrl(id);
        if (url) list.push({ id, url });
      }
      return list;
    },
    [current?.problem.id, current?.problem.answerAssetIds?.join(',')],
    []
  );

  const addAnswerImages = async (files: FileList | null) => {
    if (!files || !current) return;
    try {
      const ids: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        const { canvas, width, height } = await prepareImage(file, 2400);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
        ids.push(await putAsset(blob, 'answer', { width, height }));
      }
      const nextIds = [...current.problem.answerAssetIds, ...ids].slice(0, 8);
      await updateProblem(current.problem.id, { answerAssetIds: nextIds });
      toast.show('已添加答案图片', 'success');
    } catch {
      toast.show('图片添加失败', 'error');
    }
  };

  const weight = current ? weightOf(current.problem) : 5;
  const preview = useMemo(
    () => (current ? previewIntervals(current.card, Date.now(), weight) : null),
    [current, weight]
  );

  // 套卷做完就清掉，避免下次进来又在做同一张
  useEffect(() => {
    if (finished && paper) void clearActivePaper();
  }, [finished, paper]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        jump(1);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jump(-1);
        return;
      }
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
  }, [revealed, finished, rate, reveal, jump]);

  if (queue === null) return <PageLoading label={paper ? '准备套卷' : '准备复习队列'} />;

  if (finished) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <div className="text-center">
          {isMiku ? (
            <div className="relative mx-auto mb-3 flex justify-center">
              <div className="absolute inset-0 -m-4 rounded-full bg-teal-400/20 blur-xl pointer-events-none" />
              <MikuChibiCelebrate size={110} className="relative drop-shadow-md animate-bounce" />
            </div>
          ) : (
            <div className="text-4xl">🎉</div>
          )}
          <h1 className="mt-2 text-xl font-bold text-zinc-900">
            {paper ? '这套卷做完了' : (isMiku ? '今日错题复习圆满完成！' : '这一轮复习完了')}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {paper ? `${paper.title} · ` : ''}共 {summary.total} 题 · 用时{' '}
            {formatDuration(summary.durationMs)}
          </p>
          {isMiku && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
              <span>39！初音未来为你点赞，考研必胜！</span>
            </div>
          )}
        </div>
        <div className="mt-6 space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
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
            onClick={back}
          >
            返回上一页
          </Button>
          <Button size="lg" block onClick={() => navigate('/library')}>
            看看错题本
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
        <EmptyState
          icon={<FilePlus size={30} />}
          title={paper ? '这张卷子里的题不见了' : '没有到期的错题'}
          description={
            paper
              ? '题可能被删掉了，回首页重新组一套吧。'
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

  const canPrev = index > 0;
  const canNext = index < queue.length - 1;

  return (
    <div className="flex h-[100dvh] flex-col bg-white">
      <header className="border-b border-zinc-100 safe-top">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={back}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
            aria-label="退出复习"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 text-center">
            <div className="text-xs font-medium text-zinc-700">
              第 {stats.length + 1} 题
              <span className="ml-1 text-[11px] font-normal text-zinc-400">
                (已写 {stats.length} 题 · 剩余 {queue.length} 题)
              </span>
              {paper && <span className="ml-1 text-[10px] font-semibold text-orange-500">套卷</span>}
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="flex h-10 items-center gap-1 rounded-lg bg-zinc-50 px-2 text-[11px] text-zinc-600 active:bg-zinc-100"
              title={timerRunning ? '点击暂停计时' : '点击继续计时'}
            >
              <Timer
                size={13}
                className={timerRunning ? 'text-orange-500 animate-pulse' : 'text-zinc-400'}
              />
              <span className="font-mono font-medium">{formatStopwatch(timerSeconds)}</span>
            </button>
            {current.overdueDays > 0 && (
              <span className="flex h-10 items-center rounded-lg bg-rose-50 px-2 text-[10px] font-medium text-rose-600 border border-rose-200/70">
                {current.overdueDays === 1 ? '昨日顺延' : `逾期${current.overdueDays}天`}
              </span>
            )}
            <div className="flex h-10 items-center gap-1 rounded-lg bg-zinc-50 px-2 text-[10px] text-zinc-500">
              权重 <span className="font-medium tabular-nums text-zinc-700">{weight}</span>
            </div>
          </div>
        </div>

        {!paper && onSwitchSubject && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2">
            {[{ id: undefined, name: '全部' }, ...subjects].map((s) => {
              const active = (subjectId ?? undefined) === s.id;
              return (
                <button
                  key={s.id ?? 'all'}
                  type="button"
                  onClick={() => onSwitchSubject(s.id)}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px]',
                    active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                  )}
                >
                  {s.name.replace('839 自动控制原理及过程控制', '839 自控')}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 p-2">
        {stemUrl ? (
          <div className="mx-auto w-full max-w-3xl">
            <div className="relative block w-full overflow-hidden rounded-xl bg-white shadow-sm">
              <img
                src={stemUrl}
                alt="题干"
                className="block h-auto w-full cursor-zoom-in"
                onClick={() => setZoomUrl(stemUrl)}
              />
              <div className="absolute right-2 top-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenUrl(stemUrl);
                  }}
                  className="flex items-center gap-1 rounded-full bg-teal-600/95 hover:bg-teal-500 text-white px-2.5 py-1 text-[11px] font-medium shadow-md backdrop-blur transition-all active:scale-95 border border-white/20"
                  title="以全屏无边界模式放大查看"
                >
                  <Maximize2 size={12} />
                  全屏放大
                </button>
                <button
                  type="button"
                  onClick={() => setZoomUrl(stemUrl)}
                  className="flex items-center gap-1 rounded-full bg-black/55 hover:bg-black/75 px-2 py-1 text-[10px] text-white backdrop-blur transition-colors"
                  title="弹窗预览"
                >
                  <ZoomIn size={11} />
                  弹窗
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-400">
            这道题的图片缺失，你可以直接自评或退出后删除它
          </div>
        )}
      </div>

      {revealed && (
        <div className="max-h-[38vh] overflow-y-auto border-t border-zinc-100 bg-white px-4 py-3">
          <input
            ref={answerInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void addAnswerImages(e.target.files)}
          />

          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600">
              参考答案（{answerAssets.length} 张）
            </span>
            <button
              type="button"
              onClick={() => answerInputRef.current?.click()}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <ImagePlus size={13} />
              添加答案图
            </button>
          </div>

          {answerAssets.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {answerAssets.map((a, i) => (
                <div key={a.id} className="relative shrink-0 group">
                  <button
                    type="button"
                    onClick={() => setZoomUrl(a.url)}
                    className="block overflow-hidden rounded-lg border border-zinc-200 active:opacity-80"
                    aria-label={`放大答案 ${i + 1}`}
                  >
                    <img src={a.url} alt={`答案 ${i + 1}`} className="h-36 w-auto object-contain" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullscreenUrl(a.url);
                    }}
                    className="absolute left-1 top-1 flex h-5 items-center gap-0.5 rounded-full bg-black/60 hover:bg-teal-600 px-1.5 text-[9px] text-white transition-colors shadow-sm backdrop-blur"
                    title="全屏放大答案图"
                  >
                    <Maximize2 size={9} />
                    全屏
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteAssetId(a.id);
                    }}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors shadow-sm"
                    title="删除这张答案图"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-200 py-3 text-center text-xs text-zinc-400">
              尚未上传答案图
            </p>
          )}

          <div className="mt-2 rounded-xl bg-amber-50/80 border border-amber-200/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800">错因与心得备注</span>
              <button
                type="button"
                onClick={() => {
                  setNoteDraft(current.problem.wrongNote || '');
                  setNoteOpen(true);
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Edit3 size={11} />
                {current.problem.wrongNote ? '修改备注' : '添加备注'}
              </button>
            </div>
            {current.problem.wrongNote ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-amber-950">
                {current.problem.wrongNote}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-600/70 italic">
                暂无错因备注，点击右上角记录做题心得或突破思路
              </p>
            )}
          </div>

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
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            data-testid="prev-problem"
            onClick={() => jump(-1)}
            disabled={!canPrev}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 active:bg-zinc-100 disabled:text-zinc-300"
          >
            <ChevronLeft size={15} />
            上一题
          </button>
          <span className="text-[10px] text-zinc-300">← → 也能翻</span>
          <button
            type="button"
            data-testid="next-problem"
            onClick={() => jump(1)}
            disabled={!canNext}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 active:bg-zinc-100 disabled:text-zinc-300"
          >
            下一题
            <ChevronRight size={15} />
          </button>
        </div>

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
                  'flex flex-col items-center justify-center gap-0.5 rounded-xl border py-2 active:opacity-80 transition-all active:scale-95',
                  isMiku && 'shadow-xs hover:border-teal-400',
                  RATING_STYLE[r]
                )}
              >
                {isMiku && CHIBI_RATING_ICONS[r]}
                <span className="text-sm font-semibold">{RATING_LABEL[r]}</span>
                <span className="text-[10px] opacity-75">
                  {preview ? formatDue(preview[r], Date.now()) : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </footer>

      <Dialog open={zoomUrl !== null} onClose={() => setZoomUrl(null)} title="题目 / 答案" size="xl">
        {zoomUrl && (
          <ZoomableImage
            src={zoomUrl}
            className="h-[76vh] w-full rounded-lg"
            alt="大图"
            title="题目 / 答案"
          />
        )}
      </Dialog>

      {/* 沉浸式真全屏放大模式（突破弹窗限制，100% 视口） */}
      {fullscreenUrl && (
        <ZoomableImage
          src={fullscreenUrl}
          initialFullscreen={true}
          onClose={() => setFullscreenUrl(null)}
          title="错题全屏沉浸查看"
        />
      )}

      {/* 编辑错因与心得备注弹窗 */}
      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="编辑错因与心得备注"
        size="md"
      >
        <div className="space-y-3">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="记录当时为什么做错、解题关键思路或复习心得..."
            rows={4}
            className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <div className="flex items-center justify-between gap-2">
            {current?.problem.wrongNote ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await updateCurrentNote('');
                  setNoteOpen(false);
                  toast.show('已清空错因备注', 'info');
                }}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} />
                清空删除
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  await updateCurrentNote(noteDraft.trim());
                  setNoteOpen(false);
                  toast.show('已保存错因备注', 'success');
                }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* 删除答案图片确认弹窗 */}
      <Dialog
        open={deleteAssetId !== null}
        onClose={() => setDeleteAssetId(null)}
        title="删除答案图片"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">确定要删除这张答案图片吗？此操作无法撤销。</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteAssetId(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (deleteAssetId) {
                  await deleteCurrentAnswerAsset(deleteAssetId);
                  setDeleteAssetId(null);
                  toast.show('已删除该答案图片', 'success');
                }
              }}
            >
              确定删除
            </Button>
          </div>
        </div>
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
              <Button onClick={() => navigate('/')}>回到首页</Button>
            </div>
          }
        />
      </div>
    );
  }

  return <ReviewBody paper={paper} />;
}

export default function ReviewPage() {
  const [params, setParams] = useSearchParams();
  const paperMode = params.get('paper') === '1';
  const subjectId = params.get('subject') ?? undefined;

  const switchSubject = (id?: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('subject', id);
    else next.delete('subject');
    setParams(next, { replace: true });
  };

  if (paperMode) return <PaperReview />;
  return <ReviewBody subjectId={subjectId} paper={null} onSwitchSubject={switchSubject} />;
}
