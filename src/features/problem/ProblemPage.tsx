import { useMemo, useRef, useState } from 'react';
import { newId } from '../../lib/id';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ImagePlus,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { db } from '../../storage/db';
import {
  deleteProblem,
  markArchived,
  reschedule,
  setWeight,
  updateProblem,
} from '../../storage/problems';
import { putAsset, getUrl } from '../../storage/assets';
import { applyRating } from '../../domain/scheduler';
import { formatDateTime, formatDue } from '../../domain/time';
import { RATING_LABEL } from '../../domain/types';
import { MASTERY_LEVELS, masteryLevel, masteryTextColor } from '../../domain/taxonomy';
import { weightLabel, weightOf } from '../../domain/weight';
import { displayTitle } from '../../domain/title';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { useBack } from '../../hooks/useBack';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { PageLoading } from '../../ui/Spinner';
import { useToast } from '../../ui/Toast';
import { ZoomableImage } from '../../ui/ZoomableImage';
import { cn } from '../../ui/cn';
import { ProblemForm } from '../capture/ProblemForm';
import type { MetaValue } from '../capture/MetadataFields';
import { canvasToBlob, prepareImage } from '../capture/pipeline';

const RATING_BADGE: Record<number, string> = {
  0: 'bg-zinc-100 text-zinc-500',
  1: 'bg-red-50 text-red-600',
  2: 'bg-amber-50 text-amber-700',
  3: 'bg-emerald-50 text-emerald-700',
  4: 'bg-sky-50 text-sky-700',
};

export default function ProblemPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const back = useBack('/search');
  const problem = useLiveQuery(() => db.problems.get(id), [id]);
  const card = useLiveQuery(() => db.cards.get(id), [id]);
  const chapter = useLiveQuery(
    () => (problem ? db.chapters.get(problem.chapterId) : undefined),
    [problem?.chapterId]
  );
  const subject = useLiveQuery(
    () => (problem ? db.subjects.get(problem.subjectId) : undefined),
    [problem?.subjectId]
  );
  const siblings = useLiveQuery(
    async () => {
      if (!problem) return [] as { id: string }[];
      const list = await db.problems.where('chapterId').equals(problem.chapterId).toArray();
      return list
        .filter((p) => !p.archivedAt)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((p) => ({ id: p.id }));
    },
    [problem?.chapterId]
  );
  const logs = useLiveQuery(
    async () => {
      const list = await db.reviewLogs.where('problemId').equals(id).toArray();
      return list.sort((a, b) => b.reviewedAt - a.reviewedAt);
    },
    [id],
    []
  );
  const topics = useLiveQuery(() => db.topics.toArray(), [], []);

  const stemUrl = useAssetUrl(problem?.stemAssetId);
  const answerUrls = useLiveQuery(
    async () => {
      if (!problem) return [] as { id: string; url: string }[];
      const list: { id: string; url: string }[] = [];
      for (const aid of problem.answerAssetIds) {
        const url = await getUrl(aid);
        if (url) list.push({ id: aid, url });
      }
      return list;
    },
    [problem?.answerAssetIds.join(',')],
    []
  );

  const [editOpen, setEditOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [zoomAnswer, setZoomAnswer] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const answerInput = useRef<HTMLInputElement>(null);
  const now = Date.now();

  const problemTopics = useMemo(
    () => (problem ? topics.filter((t) => problem.topicIds.includes(t.id)) : []),
    [problem, topics]
  );

  if (!problem) return <PageLoading />;

  const cardPreview = card ? applyRating(card, 3, now) : null;
  const weight = weightOf(problem);
  const list = siblings ?? [];
  const index = list.findIndex((s) => s.id === problem.id);
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const title = displayTitle(problem, chapter?.name);

  const addAnswerImages = async (files: FileList | null) => {
    if (!files || !problem) return;
    const ids: string[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      const { canvas, width, height } = await prepareImage(file, 2400);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      ids.push(await putAsset(blob, 'answer', { width, height }));
    }
    await updateProblem(problem.id, {
      answerAssetIds: [...problem.answerAssetIds, ...ids].slice(0, 8),
    });
    toast.show('已添加答案图', 'success');
  };

  const deleteAnswerImage = async (assetId: string) => {
    if (!problem) return;
    const nextIds = problem.answerAssetIds.filter((id) => id !== assetId);
    await updateProblem(problem.id, { answerAssetIds: nextIds });
    toast.show('已删除该答案图片', 'success');
    setDeleteAssetId(null);
  };

  const saveNote = async (text: string) => {
    if (!problem) return;
    await updateProblem(problem.id, { wrongNote: text.trim() });
    toast.show(text.trim() ? '已更新错因备注' : '已清空错因备注', 'success');
    setNoteOpen(false);
  };

  const applyReschedule = async (days: number) => {
    if (!Number.isFinite(days) || days < 0) return;
    const base = new Date();
    base.setHours(9, 0, 0, 0);
    base.setDate(base.getDate() + days);
    await reschedule(problem.id, base.getTime());
    await db.reviewLogs.add({
      id: newId(),
      problemId: problem.id,
      rating: 0,
      reviewedAt: Date.now(),
      durationMs: 0,
      prevDue: card?.due ?? 0,
      nextDue: base.getTime(),
      prevState: card?.state ?? 0,
      nextState: card?.state ?? 0,
    });
    setRescheduleOpen(false);
    setCustomDays('');
    toast.show(days === 0 ? '已安排到今天' : `已安排到 ${days} 天后`, 'success');
  };

  const editInitial: MetaValue = {
    subjectId: problem.subjectId,
    chapterId: problem.chapterId,
    topicIds: problem.topicIds,
    difficulty: problem.difficulty,
    sourceYear: problem.sourceYear,
    sourcePaper: problem.sourcePaper,
    sourceNo: problem.sourceNo,
    sourceKind: problem.sourceKind,
    wrongNote: problem.wrongNote,
    errorTags: problem.errorTags ?? [],
    mastery: problem.mastery,
    title: problem.title,
  };

  const shownLogs = showAllLogs ? logs : logs.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={back}
          className="-ml-2 flex h-10 items-center gap-1 rounded-lg px-2 text-zinc-600 active:bg-zinc-100"
          aria-label="返回上一页"
        >
          <ArrowLeft size={20} />
          <span className="text-xs">返回</span>
        </button>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            编辑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markArchived(problem.id, !problem.archivedAt)}
          >
            {problem.archivedAt ? '取消归档' : '标记掌握'}
          </Button>
        </div>
      </div>

      <div className="px-0.5">
        <h1 className="text-lg font-semibold leading-snug text-zinc-900">{title}</h1>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          {subject?.name.replace('839 自动控制原理及过程控制', '839 自控')} ·{' '}
          {chapter?.name ?? '未分类'}
          {problem.sourcePaper ? ` · ${problem.sourcePaper}` : ''}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {stemUrl ? (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="block max-h-[58vh] w-full overflow-y-auto bg-zinc-100"
          >
            <img src={stemUrl} alt="题干" className="block h-auto w-full" />
          </button>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-400">
            图片缺失（导入时未包含）
          </div>
        )}
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: subject?.color }}
            />
            <span className="truncate">权重 {weight} · {weightLabel(weight)}</span>
          </div>
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] text-zinc-400 active:bg-zinc-100"
          >
            放大看
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">
            {problem.archivedAt
              ? '已掌握，不再排期'
              : `下次复习：${card ? formatDue(card.due, now) : '—'}`}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-zinc-400">
            {card ? `已复习 ${card.reps} 次 · 忘记 ${card.lapses} 次` : '尚无复习记录'}
            {cardPreview && !problem.archivedAt
              ? ` · 若现在评「记得」→ ${formatDue(cardPreview.nextDue, now)}`
              : ''}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => setRescheduleOpen(true)}
        >
          <CalendarClock size={14} />
          改期
        </Button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-medium text-zinc-500">掌握程度</span>
          <span className="text-[10px] text-zinc-400">
            {masteryLevel(problem.mastery)?.hint ?? '颜色越深越该重点看'}
          </span>
        </div>
        <div className="flex gap-2">
          {MASTERY_LEVELS.map((m) => {
            const active = problem.mastery === m.level;
            return (
              <button
                key={m.level}
                type="button"
                data-testid={`mastery-${m.level}`}
                onClick={() =>
                  void updateProblem(problem.id, { mastery: active ? undefined : m.level })
                }
                className={cn(
                  'h-8 flex-1 rounded-lg border text-[11px] transition-colors',
                  active ? 'border-transparent font-medium' : 'border-zinc-200 text-zinc-500'
                )}
                style={
                  active
                    ? { backgroundColor: m.color, color: masteryTextColor(m.level) }
                    : undefined
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
          <span className="text-xs font-medium text-zinc-500">权重</span>
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-600">
            {weightLabel(weight)}
          </span>
          <span className="text-[10px] text-zinc-400">越高排期越靠后</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              data-testid="weight-minus"
              onClick={() => void setWeight(problem.id, weight - 1)}
              disabled={weight <= 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 active:bg-zinc-50 disabled:text-zinc-300"
              aria-label="降低权重"
            >
              <Minus size={14} />
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums text-zinc-900">
              {weight}
            </span>
            <button
              type="button"
              data-testid="weight-plus"
              onClick={() => void setWeight(problem.id, weight + 1)}
              disabled={weight >= 10}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 active:bg-zinc-50 disabled:text-zinc-300"
              aria-label="提高权重"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </section>

      {answerUrls.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              正确答案（{answerUrls.length} 张）
            </span>
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              className="rounded-lg px-2 py-1 text-xs text-orange-600 active:bg-orange-50"
            >
              {showAnswer ? '收起答案' : '显示答案'}
            </button>
          </div>

          {showAnswer ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {answerUrls.map((a, i) => (
                <div key={a.id} className="relative shrink-0 group">
                  <button
                    type="button"
                    onClick={() => setZoomAnswer(i)}
                    className="block overflow-hidden rounded-lg border border-zinc-200 active:opacity-80"
                  >
                    <img
                      src={a.url}
                      alt={`答案 ${i + 1}`}
                      className="h-28 w-auto object-cover"
                      loading="lazy"
                    />
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
            <button
              type="button"
              onClick={() => setShowAnswer(true)}
              className="mt-1 w-full rounded-xl border border-dashed border-zinc-300 py-6 text-xs text-zinc-400 active:bg-zinc-50"
            >
              答案已隐藏 · 点一下再显示
            </button>
          )}
        </div>
      )}

      <input
        ref={answerInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void addAnswerImages(e.target.files)}
      />
      <Button variant="secondary" block onClick={() => answerInput.current?.click()}>
        <ImagePlus size={16} />
        添加答案图片
      </Button>

      {problemTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problemTopics.map((t) => (
            <span
              key={t.id}
              className="rounded-lg bg-white px-2.5 py-1 text-xs text-zinc-600 ring-1 ring-zinc-200"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-amber-800">当时为什么错 · 错因备注</h2>
          <button
            type="button"
            onClick={() => {
              setNoteDraft(problem.wrongNote || '');
              setNoteOpen(true);
            }}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <Edit3 size={11} />
            {problem.wrongNote ? '编辑备注' : '添加备注'}
          </button>
        </div>
        {(problem.errorTags?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {problem.errorTags!.map((tag) => (
              <span
                key={tag}
                className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {problem.wrongNote ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
            {problem.wrongNote}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-amber-600/70 italic">
            暂无备注，点击右上角记录这道题为什么做错、关键知识点或解题突破口
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          来源
          {problem.sourceKind && (
            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-600">
              {problem.sourceKind}
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-zinc-800">
          {[problem.sourceYear, problem.sourcePaper, problem.sourceNo]
            .filter(Boolean)
            .join(' · ') || '未填写'}
        </p>
        <div className="mt-3 flex items-center gap-1">
          <span className="text-xs text-zinc-500">难度</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${i < problem.difficulty ? 'bg-orange-400' : 'bg-zinc-200'}`}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">复习记录</h2>
          <span className="text-[10px] text-zinc-400">共 {logs.length} 条</span>
        </div>
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white/60">
            <EmptyState title="还没有复习过" description="第一次复习会记录在这里" />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {shownLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="text-zinc-500">{formatDateTime(log.reviewedAt)}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px]',
                      RATING_BADGE[log.rating] ?? RATING_BADGE[0]
                    )}
                  >
                    {log.rating === 0 ? '手动改期' : RATING_LABEL[log.rating]}
                  </span>
                </li>
              ))}
            </ul>
            {logs.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllLogs((v) => !v)}
                className="mt-2 w-full rounded-lg bg-zinc-50 py-2 text-[11px] text-zinc-500 active:bg-zinc-100"
              >
                {showAllLogs ? '收起' : `展开全部 ${logs.length} 条`}
              </button>
            )}
          </>
        )}
      </section>

      <div className="flex items-stretch gap-2">
        <Button
          variant="secondary"
          block
          disabled={!prev}
          onClick={() => prev && navigate(`/problem/${prev.id}`)}
        >
          <ChevronLeft size={15} />
          上一题
        </Button>
        <Button
          variant="secondary"
          block
          disabled={!next}
          onClick={() => next && navigate(`/problem/${next.id}`)}
        >
          下一题
          <ChevronRight size={15} />
        </Button>
      </div>

      <div className="flex gap-2 pb-4">
        <Button variant="ghost" block onClick={() => navigate('/library')}>
          返回错题本
        </Button>
        <Button variant="danger" block onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} />
          删除
        </Button>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="编辑错题信息" size="lg">
        <ProblemForm
          initial={editInitial}
          submitLabel="保存修改"
          defaultAdvanced
          onCancel={() => setEditOpen(false)}
          onSubmit={async (value) => {
            await updateProblem(problem.id, value);
            setEditOpen(false);
            toast.show('已保存', 'success');
          }}
        />
      </Dialog>

      <Dialog
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        title="重新安排复习时间"
        size="sm"
      >
        <div className="space-y-2">
          {[
            { label: '今天再复习', days: 0 },
            { label: '3 天后', days: 3 },
            { label: '7 天后', days: 7 },
            { label: '14 天后', days: 14 },
            { label: '30 天后', days: 30 },
          ].map((opt) => (
            <Button key={opt.days} block onClick={() => void applyReschedule(opt.days)}>
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 border-t border-zinc-100 pt-3">
          <div className="mb-1.5 text-[11px] text-zinc-500">自定义天数</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="例如 5"
              className="h-10 w-24 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-orange-300"
            />
            <span className="text-xs text-zinc-500">天后复习</span>
            <Button
              variant="primary"
              className="ml-auto"
              disabled={!customDays || Number(customDays) < 1}
              onClick={() => void applyReschedule(Number(customDays))}
            >
              确定
            </Button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
            手动改期只调整下次时间，不影响 FSRS 的记忆强度。
          </p>
        </div>
      </Dialog>

      <Dialog open={zoomAnswer !== null} onClose={() => setZoomAnswer(null)} title="答案" size="lg">
        {zoomAnswer !== null && answerUrls[zoomAnswer] && (
          <ZoomableImage
            src={answerUrls[zoomAnswer].url}
            className="h-[62vh] w-full rounded-lg"
            alt="答案大图"
          />
        )}
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="删除这道错题？" size="sm">
        <p className="text-sm text-zinc-600">图片、复习记录都会一起删除，无法恢复。</p>
        <div className="mt-5 flex gap-3">
          <Button block onClick={() => setDeleteOpen(false)}>
            取消
          </Button>
          <Button
            variant="danger"
            block
            onClick={async () => {
              await deleteProblem(problem.id);
              toast.show('已删除', 'info');
              back();
            }}
          >
            删除
          </Button>
        </div>
      </Dialog>

      <Dialog open={zoomOpen} onClose={() => setZoomOpen(false)} title="题干" size="lg">
        {stemUrl && (
          <ZoomableImage src={stemUrl} className="h-[68vh] w-full rounded-lg" alt="题干大图" />
        )}
      </Dialog>

      {/* 快捷编辑错因与心得备注 */}
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
            placeholder="记录这道题为什么做错、关键知识点、易错陷阱或解题心得..."
            rows={4}
            className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
          <div className="flex items-center justify-between gap-2">
            {problem.wrongNote ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void saveNote('')}
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
              <Button variant="primary" size="sm" onClick={() => void saveNote(noteDraft)}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* 删除答案图片确认 */}
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
              onClick={() => deleteAssetId && void deleteAnswerImage(deleteAssetId)}
            >
              确定删除
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
