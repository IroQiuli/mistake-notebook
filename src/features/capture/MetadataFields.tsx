import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { Chapter, Subject, Topic } from '../../domain/types';
import { createChapter, createTopic } from '../../storage/problems';
import { cn } from '../../ui/cn';
import { Button } from '../../ui/Button';

export interface MetaValue {
  subjectId: string;
  chapterId: string;
  topicIds: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  sourceYear?: number;
  sourcePaper?: string;
  sourceNo?: string;
  wrongNote: string;
}

interface MetadataFieldsProps {
  value: MetaValue;
  onChange: (next: MetaValue) => void;
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  /** 一进来就展开「更多信息」（编辑已有错题时用） */
  defaultAdvanced?: boolean;
  onTaxonomyChange?: () => void;
}

const inputCls =
  'h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-orange-300';

/**
 * 分类字段：默认只露出「科目 + 章节」两个必填项，
 * 知识点、难度、来源、错误原因收进「更多信息」，录一道题只点两下。
 */
export function MetadataFields({
  value,
  onChange,
  subjects,
  chapters,
  topics,
  defaultAdvanced = false,
  onTaxonomyChange,
}: MetadataFieldsProps) {
  const [newChapter, setNewChapter] = useState('');
  const [addingChapter, setAddingChapter] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [advanced, setAdvanced] = useState(defaultAdvanced);
  const [error, setError] = useState('');

  const subjectChapters = useMemo(
    () => chapters.filter((c) => c.subjectId === value.subjectId),
    [chapters, value.subjectId]
  );
  const subjectTopics = useMemo(
    () => topics.filter((t) => t.subjectId === value.subjectId),
    [topics, value.subjectId]
  );

  const set = (patch: Partial<MetaValue>) => onChange({ ...value, ...patch });

  const addChapter = async () => {
    const name = newChapter.trim();
    if (!name) return;
    if (!value.subjectId) {
      setError('先选科目');
      return;
    }
    const chapter = await createChapter(value.subjectId, name);
    set({ chapterId: chapter.id });
    setNewChapter('');
    setAddingChapter(false);
    setError('');
    onTaxonomyChange?.();
  };

  const addTopic = async () => {
    const name = newTopic.trim();
    if (!name || !value.subjectId) return;
    const topic = await createTopic(value.subjectId, name);
    if (!value.topicIds.includes(topic.id)) set({ topicIds: [...value.topicIds, topic.id] });
    setNewTopic('');
    onTaxonomyChange?.();
  };

  const extraCount =
    value.topicIds.length +
    (value.wrongNote ? 1 : 0) +
    (value.sourceYear || value.sourcePaper || value.sourceNo ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">科目</span>
          <select
            value={value.subjectId}
            onChange={(e) => set({ subjectId: e.target.value, chapterId: '', topicIds: [] })}
            className={inputCls}
          >
            <option value="">选择科目</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">章节</span>
          <select
            value={value.chapterId}
            onChange={(e) => set({ chapterId: e.target.value })}
            className={inputCls}
            disabled={!value.subjectId}
          >
            <option value="">选择章节</option>
            {subjectChapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between">
        {addingChapter ? (
          <div className="flex flex-1 gap-2">
            <input
              value={newChapter}
              onChange={(e) => setNewChapter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addChapter();
                }
              }}
              placeholder="新章节名，回车保存"
              className={inputCls}
              autoFocus
            />
            <Button size="md" onClick={() => void addChapter()}>
              添加
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingChapter(true)}
            className="text-xs text-orange-600"
          >
            + 新建章节
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-200 px-3 py-2.5 text-left"
      >
        <span className="text-xs text-zinc-500">
          更多信息（可选）
          {extraCount > 0 && <span className="ml-1 text-orange-500">{extraCount} 项已填</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn('text-zinc-400 transition-transform', advanced && 'rotate-180')}
        />
      </button>

      {advanced && (
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">知识点标签</span>
            <div className="flex flex-wrap gap-1.5">
              {subjectTopics.map((t) => {
                const active = value.topicIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      set({
                        topicIds: active
                          ? value.topicIds.filter((id) => id !== t.id)
                          : [...value.topicIds, t.id],
                      })
                    }
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs',
                      active
                        ? 'border-orange-300 bg-orange-50 text-orange-600'
                        : 'border-zinc-200 text-zinc-600'
                    )}
                  >
                    {active && <Check size={11} className="mr-0.5 inline" />}
                    {t.name}
                  </button>
                );
              })}
              {subjectTopics.length === 0 && (
                <span className="text-xs text-zinc-400">还没有标签，下面新建一个</span>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addTopic();
                  }
                }}
                placeholder="新建知识点，回车添加"
                className={inputCls}
              />
              <Button size="md" onClick={() => void addTopic()} disabled={!value.subjectId}>
                <Plus size={16} />
              </Button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">难度</span>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ difficulty: d })}
                  className={cn(
                    'h-9 flex-1 rounded-lg border text-xs',
                    value.difficulty >= d
                      ? 'border-orange-300 bg-orange-50 text-orange-600'
                      : 'border-zinc-200 text-zinc-500'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">年份</span>
              <input
                inputMode="numeric"
                value={value.sourceYear ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  set({ sourceYear: v ? Number(v) : undefined });
                }}
                placeholder="2023"
                className={inputCls}
              />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">卷子 / 讲义</span>
              <input
                value={value.sourcePaper ?? ''}
                onChange={(e) => set({ sourcePaper: e.target.value })}
                placeholder="真题 / 李林四套 / 第3章"
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">题号</span>
            <input
              value={value.sourceNo ?? ''}
              onChange={(e) => set({ sourceNo: e.target.value })}
              placeholder="第 2 题"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">我的错误原因</span>
            <textarea
              value={value.wrongNote}
              onChange={(e) => set({ wrongNote: e.target.value })}
              rows={3}
              placeholder="当时为什么错？概念不清 / 算错 / 看漏条件……"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400 focus:border-orange-300"
            />
          </label>
        </div>
      )}
    </div>
  );
}
