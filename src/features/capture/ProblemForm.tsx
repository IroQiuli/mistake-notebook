import { useEffect, useRef, useState } from 'react';
import { Camera, Clipboard, Image as ImageIcon, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../storage/db';
import type { Chapter, Topic } from '../../domain/types';
import { Button } from '../../ui/Button';
import { MetadataFields, type MetaValue } from './MetadataFields';
import { defaultMeta } from './defaultMeta';

interface AnswerDraft {
  id: string;
  blob: Blob;
  url: string;
}

interface ProblemFormProps {
  initial: MetaValue;
  previewUrl?: string | null;
  submitLabel?: string;
  /** 编辑已有错题时直接展开「更多信息」 */
  defaultAdvanced?: boolean;
  onSubmit: (meta: MetaValue, answerBlobs?: Blob[]) => Promise<void>;
  onCancel?: () => void;
  /** 题目预览下方的附加操作，例如「调整图片」 */
  previewAction?: React.ReactNode;
}

export function ProblemForm({
  initial,
  previewUrl,
  submitLabel = '保存并加入复习',
  defaultAdvanced = false,
  onSubmit,
  onCancel,
  previewAction,
}: ProblemFormProps) {
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [], []);
  const chapters = useLiveQuery(() => db.chapters.toArray(), [], []) as Chapter[];
  const topics = useLiveQuery(() => db.topics.toArray(), [], []) as Topic[];
  const [meta, setMeta] = useState<MetaValue>(initial);
  const [answerDrafts, setAnswerDrafts] = useState<AnswerDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const answerCameraRef = useRef<HTMLInputElement>(null);
  const answerGalleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      for (const item of answerDrafts) {
        URL.revokeObjectURL(item.url);
      }
    };
  }, [answerDrafts]);

  const addAnswerFiles = (files?: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const newItems: AnswerDraft[] = [];
    for (const f of Array.from(files)) {
      newItems.push({
        id: crypto.randomUUID(),
        blob: f,
        url: URL.createObjectURL(f),
      });
    }
    setAnswerDrafts((prev) => [...prev, ...newItems].slice(0, 8));
  };

  const removeAnswer = (id: string) => {
    setAnswerDrafts((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
  };

  const pasteAnswerFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) return;
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            setAnswerDrafts((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                blob,
                url: URL.createObjectURL(blob),
              },
            ]);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Clipboard read failed', e);
    }
  };

  const submit = async () => {
    if (!meta.subjectId) return setError('请先选择科目');
    if (!meta.chapterId) return setError('请选择章节，或新建一个');
    setError('');
    setSaving(true);
    try {
      await onSubmit(
        meta,
        answerDrafts.map((d) => d.blob)
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {previewUrl && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          <img src={previewUrl} alt="题目预览" className="max-h-56 w-full object-contain" />
        </div>
      )}
      {previewAction}

      {/* 答案与解析图片（选填） */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-800">答案与解析图片</span>
            <span className="text-[10px] text-zinc-400 font-normal">（选填，做题对答案时看）</span>
          </div>
          {answerDrafts.length > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.2 text-[10px] font-medium text-orange-700">
              已添 {answerDrafts.length} 张
            </span>
          )}
        </div>

        {answerDrafts.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
            {answerDrafts.map((ans, idx) => (
              <div
                key={ans.id}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-xs"
              >
                <img
                  src={ans.url}
                  alt={`答案图 ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white backdrop-blur-xs">
                  #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAnswer(ans.id)}
                  className="absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-rose-500 transition-colors"
                  aria-label="删除该张答案图"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={answerCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void addAnswerFiles(e.target.files)}
        />
        <input
          ref={answerGalleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void addAnswerFiles(e.target.files)}
        />

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => answerCameraRef.current?.click()}
            className="flex items-center justify-center gap-1.5 h-8.5 rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            <Camera size={13} className="text-orange-500" />
            拍照加答案
          </button>
          <button
            type="button"
            onClick={() => answerGalleryRef.current?.click()}
            className="flex items-center justify-center gap-1.5 h-8.5 rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            <ImageIcon size={13} className="text-zinc-500" />
            相册选答案
          </button>
          <button
            type="button"
            onClick={() => void pasteAnswerFromClipboard()}
            className="flex items-center justify-center gap-1.5 h-8.5 rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 transition-colors"
          >
            <Clipboard size={13} className="text-zinc-500" />
            剪贴板粘贴
          </button>
        </div>
      </div>

      <MetadataFields
        value={meta}
        onChange={setMeta}
        subjects={subjects ?? []}
        chapters={chapters ?? []}
        topics={topics ?? []}
        defaultAdvanced={defaultAdvanced}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button variant="secondary" block onClick={onCancel} disabled={saving}>
            取消
          </Button>
        )}
        <Button variant="primary" block onClick={() => void submit()} disabled={saving}>
          {saving ? '保存中…' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export { defaultMeta };
