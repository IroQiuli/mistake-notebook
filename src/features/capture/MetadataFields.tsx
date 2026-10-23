import { useMemo, useState } from 'react';
import { Check, ChevronDown, Minus, Plus } from 'lucide-react';
import type { Chapter, Mastery, SourceKind, Subject, Topic } from '../../domain/types';
import { ERROR_TAGS, MASTERY_LEVELS, masteryTextColor } from '../../domain/taxonomy';
import { createChapter, createTopic } from '../../storage/problems';
import {
  calcInitialDue,
  weightFromMastery,
  weightLabel,
  weightToInitialReviewDays,
} from '../../domain/weight';
import { formatToday } from '../../domain/time';
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
  sourceKind?: SourceKind;
  wrongNote: string;
  errorTags: string[];
  /** 掌握程度：1 完全不会 … 4 已掌握 */
  mastery?: Mastery;
  /** 权重 0~10，越高排期越靠后 */
  weight?: number;
  /** 自定义标题；留空时列表用「章节 · 第 N 题 · 日期」 */
  title?: string;
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
    (value.errorTags?.length ?? 0) +
    (value.mastery ? 1 : 0) +
    (value.sourceYear || value.sourcePaper || value.sourceNo ? 1 : 0);

  const toggleErrorTag = (tag: string) => {
    const list = value.errorTags ?? [];
    set({
      errorTags: list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag],
    });
  };

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
            <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-zinc-500">
              掌握程度
              <span className="text-[10px] font-normal text-zinc-400">颜色越深越该重点看</span>
            </span>
            <div className="flex gap-2">
              {MASTERY_LEVELS.map((m) => {
                const active = value.mastery === m.level;
                return (
                  <button
                    key={m.level}
                    type="button"
                    onClick={() => {
                      const next = active ? undefined : m.level;
                      set({ mastery: next, weight: weightFromMastery(next) });
                    }}
                    className={cn(
                      'h-9 flex-1 rounded-lg border text-xs transition-colors',
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
            <p className="mt-1 text-[10px] text-zinc-400">再点一次可以取消分级</p>
          </div>

          {/* 权重调节与首重复习预测 */}
          {(() => {
            const effectiveWeight = value.weight ?? weightFromMastery(value.mastery);
            const reviewDays = weightToInitialReviewDays(effectiveWeight);
            const dueTs = calcInitialDue(effectiveWeight, Date.now());
            const dueDateStr = formatToday(dueTs);
            return (
              <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-zinc-700">复习权重</span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                      {effectiveWeight} · {weightLabel(effectiveWeight)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => set({ weight: Math.max(0, effectiveWeight - 1) })}
                      disabled={effectiveWeight <= 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50 disabled:opacity-40"
                      aria-label="降低权重"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold tabular-nums text-zinc-800">
                      {effectiveWeight}
                    </span>
                    <button
                      type="button"
                      onClick={() => set({ weight: Math.min(10, effectiveWeight + 1) })}
                      disabled={effectiveWeight >= 10}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 active:bg-zinc-50 disabled:opacity-40"
                      aria-label="提高权重"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>下次复习安排：</span>
                  <span className="font-medium text-orange-600">
                    {reviewDays === 1 ? '明天' : `${reviewDays} 天后`}
                    <span className="text-zinc-400 font-normal ml-1">({dueDateStr})</span>
                  </span>
                </div>
              </div>
            );
          })()}

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
                onChange={(e) => {
                  const paper = e.target.value;
                  // 老用户习惯直接写「2023真题」，这里顺手打上结构化类型
                  const autoKind: Partial<MetaValue> =
                    !value.sourceKind && /真题|统考/.test(paper)
                      ? { sourceKind: '真题' }
                      : {};
                  set({ sourcePaper: paper, ...autoKind });
                }}
                placeholder="真题 / 李林四套 / 第3章"
                className={inputCls}
              />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">来源类型</span>
            <div className="flex flex-wrap gap-1.5">
              {(['真题', '模拟题', '讲义', '其他'] as SourceKind[]).map((kind) => {
                const active = value.sourceKind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => set({ sourceKind: active ? undefined : kind })}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs',
                      active
                        ? 'border-orange-300 bg-orange-50 text-orange-600'
                        : 'border-zinc-200 text-zinc-600'
                    )}
                  >
                    {kind}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-zinc-400">
              选「真题」后，可以在错题本筛选的「真题」分支里按年份找到它。
            </p>
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
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">
              标题（可选）
            </span>
            <input
              value={value.title ?? ''}
              onChange={(e) => set({ title: e.target.value.slice(0, 40) || undefined })}
              placeholder="留空自动用「章节 · 第 N 题 · 日期」"
              className={inputCls}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-500">错因标签</span>
            <div className="flex flex-wrap gap-1.5">
              {ERROR_TAGS.map((tag) => {
                const active = (value.errorTags ?? []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleErrorTag(tag)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs',
                      active
                        ? 'border-orange-300 bg-orange-50 text-orange-600'
                        : 'border-zinc-200 text-zinc-600'
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

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
