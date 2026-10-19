import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarClock, ImagePlus, Trash2 } from 'lucide-react';
import { db } from '../../storage/db';
import {
  deleteProblem,
  markArchived,
  reschedule,
  updateProblem,
} from '../../storage/problems';
import { putAsset, getUrl } from '../../storage/assets';
import { applyRating } from '../../domain/scheduler';
import { formatDateTime, formatDue } from '../../domain/time';
import { RATING_LABEL } from '../../domain/types';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { PageLoading } from '../../ui/Spinner';
import { useToast } from '../../ui/Toast';
import { ZoomableImage } from '../../ui/ZoomableImage';
import { ProblemForm } from '../capture/ProblemForm';
import type { MetaValue } from '../capture/MetadataFields';
import { canvasToBlob, prepareImage } from '../capture/pipeline';

export default function ProblemPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [answerIndex, setAnswerIndex] = useState(0);
  const answerInput = useRef<HTMLInputElement>(null);
  const now = Date.now();

  const problemTopics = useMemo(
    () => (problem ? topics.filter((t) => problem.topicIds.includes(t.id)) : []),
    [problem, topics]
  );

  if (!problem) return <PageLoading />;

  const cardPreview = card ? applyRating(card, 3, now) : null;

  const addAnswerImages = async (files: FileList | null) => {
    if (!files || !problem) return;
    const ids: string[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      const { canvas, width, height } = await prepareImage(file, 2400);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      ids.push(await putAsset(blob, 'answer', { width, height }));
    }
    await updateProblem(problem.id, {
      answerAssetIds: [...problem.answerAssetIds, ...ids].slice(0, 6),
    });
    toast.show('已添加答案图', 'success');
  };

  const editInitial: MetaValue = {
    subjectId: problem.subjectId,
    chapterId: problem.chapterId,
    topicIds: problem.topicIds,
    difficulty: problem.difficulty,
    sourceYear: problem.sourceYear,
    sourcePaper: problem.sourcePaper,
    sourceNo: problem.sourceNo,
    wrongNote: problem.wrongNote,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 active:bg-zinc-100"
          aria-label="返回"
        >
          <ArrowLeft size={20} />
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

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {stemUrl ? (
          <ZoomableImage src={stemUrl} className="h-[46vh] max-h-[520px] w-full" alt="题干" />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-400">
            图片缺失（导入时未包含）
          </div>
        )}
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject?.color }} />
            {subject?.name.replace('839 自动控制原理及过程控制', '839 自控')} ·{' '}
            {chapter?.name ?? '未分类'}
          </div>
          <span className="text-[11px] text-zinc-400">双指缩放 · 双击放大</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <div>
          <div className="text-xs text-zinc-500">
            {problem.archivedAt ? '已掌握，不再排期' : `下次复习：${card ? formatDue(card.due, now) : '—'}`}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            {card
              ? `已复习 ${card.reps} 次 · 忘记 ${card.lapses} 次`
              : '尚无复习记录'}
            {cardPreview && !problem.archivedAt
              ? ` · 若现在评「记得」→ ${formatDue(cardPreview.nextDue, now)}`
              : ''}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setRescheduleOpen(true)}>
          <CalendarClock size={14} />
          改期
        </Button>
      </div>

      {answerUrls.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              正确答案（{answerIndex + 1}/{answerUrls.length}）
            </span>
            {answerUrls.length > 1 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-zinc-500 active:bg-zinc-100"
                  onClick={() => setAnswerIndex((i) => (i - 1 + answerUrls.length) % answerUrls.length)}
                >
                  上一张
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-zinc-500 active:bg-zinc-100"
                  onClick={() => setAnswerIndex((i) => (i + 1) % answerUrls.length)}
                >
                  下一张
                </button>
              </div>
            )}
          </div>
          <ZoomableImage
            src={answerUrls[answerIndex].url}
            className="h-56 w-full rounded-lg"
            alt="答案"
          />
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
            <span key={t.id} className="rounded-lg bg-white px-2.5 py-1 text-xs text-zinc-600 ring-1 ring-zinc-200">
              {t.name}
            </span>
          ))}
        </div>
      )}

      {problem.wrongNote && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-xs font-medium text-amber-800">当时为什么错</h2>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
            {problem.wrongNote}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-xs font-medium text-zinc-500">来源</h2>
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
        <h2 className="mb-2 text-sm font-medium text-zinc-700">复习记录</h2>
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white/60">
            <EmptyState title="还没有复习过" description="第一次复习会记录在这里" />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {logs.slice(0, 10).map((log) => (
              <li key={log.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="text-zinc-500">{formatDateTime(log.reviewedAt)}</span>
                <span className="font-medium text-zinc-700">
                  {log.rating === 0 ? '手动改期' : RATING_LABEL[log.rating]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-3 pb-4">
        <Button variant="danger" block onClick={() => setDeleteOpen(true)}>
          <Trash2 size={16} />
          删除这道题
        </Button>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="编辑错题信息" size="lg">
        <ProblemForm
          initial={editInitial}
          submitLabel="保存修改"
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
            { label: '30 天后', days: 30 },
          ].map((opt) => (
            <Button
              key={opt.days}
              block
              onClick={async () => {
                const base = new Date();
                base.setHours(9, 0, 0, 0);
                base.setDate(base.getDate() + opt.days);
                await reschedule(problem.id, base.getTime());
                await db.reviewLogs.add({
                  id: crypto.randomUUID(),
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
                toast.show('已改期', 'success');
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
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
              navigate('/library', { replace: true });
            }}
          >
            删除
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
