import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../storage/db';
import type { Chapter, Topic } from '../../domain/types';
import { Button } from '../../ui/Button';
import { MetadataFields, type MetaValue } from './MetadataFields';
import { defaultMeta } from './defaultMeta';

interface ProblemFormProps {
  initial: MetaValue;
  previewUrl?: string | null;
  submitLabel?: string;
  /** 编辑已有错题时直接展开「更多信息」 */
  defaultAdvanced?: boolean;
  onSubmit: (meta: MetaValue) => Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!meta.subjectId) return setError('请先选择科目');
    if (!meta.chapterId) return setError('请选择章节，或新建一个');
    setError('');
    setSaving(true);
    try {
      await onSubmit(meta);
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
