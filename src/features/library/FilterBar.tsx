import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Chapter, Mastery, ProblemStatus, Subject, Topic } from '../../domain/types';
import type { ProblemFilter } from '../../domain/filter';
import { MASTERY_LEVELS } from '../../domain/taxonomy';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { cn } from '../../ui/cn';

interface FilterBarProps {
  open: boolean;
  onClose: () => void;
  value: ProblemFilter;
  onApply: (next: ProblemFilter) => void;
  subjects: Subject[];
  chapters: Chapter[];
  topics: Topic[];
  subjectId?: string;
  years: number[];
  /** 打了「真题」标记的题目数量与年份 */
  realCount: number;
  realYears: number[];
}

const STATUS: { value: ProblemStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'due', label: '待复习' },
  { value: 'new', label: '新题' },
  { value: 'archived', label: '已掌握' },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-orange-300 bg-orange-50 text-orange-600'
          : 'border-zinc-200 bg-white text-zinc-600'
      )}
    >
      {children}
    </button>
  );
}

function shortName(name: string) {
  return name.replace('839 自动控制原理及过程控制', '839 自控');
}

export function FilterBar({
  open,
  onClose,
  value,
  onApply,
  subjects,
  chapters,
  topics,
  subjectId,
  years,
  realCount,
  realYears,
}: FilterBarProps) {
  const [draft, setDraft] = useState<ProblemFilter>(value);
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [realOpen, setRealOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    // 进面板时展开当前科目（若在单个科目 Tab 下）
    setOpenSubjects(new Set(subjectId ? [subjectId] : []));
  }, [open, value, subjectId]);

  const toggle = <K extends 'chapterIds' | 'topicIds' | 'difficulty' | 'years' | 'mastery'>(
    key: K,
    item: NonNullable<ProblemFilter[K]>[number]
  ) => {
    const list = (draft[key] as Array<typeof item> | undefined) ?? [];
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
    setDraft({ ...draft, [key]: next });
  };

  const toggleSubject = (id: string) => {
    setOpenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const grouped = useMemo(
    () =>
      subjects.map((s) => ({
        subject: s,
        chapters: chapters
          .filter((c) => c.subjectId === s.id)
          .sort((a, b) => a.order - b.order),
        topics: topics.filter((t) => t.subjectId === s.id),
      })),
    [subjects, chapters, topics]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="筛选"
      size="lg"
      footer={
        <>
          <Button variant="secondary" block onClick={() => setDraft({ subjectId })}>
            重置
          </Button>
          <Button
            variant="primary"
            block
            onClick={() => {
              onApply({ ...draft, subjectId });
              onClose();
            }}
          >
            应用
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">状态</div>
          <div className="flex flex-wrap gap-2">
            {STATUS.map((s) => (
              <Chip
                key={s.value}
                active={(draft.status ?? 'all') === s.value}
                onClick={() => setDraft({ ...draft, status: s.value })}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium text-zinc-500">掌握程度</span>
            <span className="text-[10px] text-zinc-400">颜色越深越该重点看</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MASTERY_LEVELS.map((m) => (
              <Chip
                key={m.level}
                active={draft.mastery?.includes(m.level) ?? false}
                onClick={() => toggle('mastery', m.level)}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full align-[-1px]"
                  style={{ backgroundColor: m.color }}
                />
                {m.label}
              </Chip>
            ))}
            <Chip
              active={draft.mastery?.includes('none') ?? false}
              onClick={() => toggle('mastery', 'none' as Mastery | 'none')}
            >
              未分级
            </Chip>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">难度</div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((d) => (
              <Chip
                key={d}
                active={draft.difficulty?.includes(d) ?? false}
                onClick={() => toggle('difficulty', d)}
              >
                {d} 星
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">真题</div>
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setRealOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left active:bg-zinc-50"
            >
              <span className="flex items-center gap-2 text-sm text-zinc-800">
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">
                  真题
                </span>
                历年金题
              </span>
              <span className="flex items-center gap-2 text-[11px] text-zinc-400">
                {draft.realOnly ? '已筛选' : `${realCount} 道`}
                <ChevronDown
                  size={14}
                  className={cn('transition-transform', realOpen && 'rotate-180')}
                />
              </span>
            </button>
            {realOpen && (
              <div className="flex flex-wrap gap-1.5 bg-zinc-50/70 px-3 pb-3 pt-1">
                <Chip
                  active={Boolean(draft.realOnly) && !draft.years?.length}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      realOnly: !(draft.realOnly && !draft.years?.length),
                      years: [],
                    })
                  }
                >
                  全部真题
                </Chip>
                {realYears.map((y) => (
                  <Chip
                    key={y}
                    active={Boolean(draft.realOnly) && (draft.years ?? []).includes(y)}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        realOnly: true,
                        years: (draft.years ?? []).includes(y) && draft.years?.length === 1 ? [] : [y],
                      })
                    }
                  >
                    {y}
                  </Chip>
                ))}
                {realYears.length === 0 && (
                  <span className="text-[10px] text-zinc-400">
                    还没有标记为真题的题目（录入时选「来源类型 → 真题」）
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">章节</div>
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            {grouped.map(({ subject, chapters: list }, index) => {
              const isOpen = openSubjects.has(subject.id);
              const selected = list.filter((c) => draft.chapterIds?.includes(c.id)).length;
              return (
                <div
                  key={subject.id}
                  className={cn(index > 0 && 'border-t border-zinc-100')}
                >
                  <button
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left active:bg-zinc-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-zinc-800">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      {shortName(subject.name)}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-zinc-400">
                      {selected > 0 ? `已选 ${selected}` : `${list.length} 章`}
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', isOpen && 'rotate-180')}
                      />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-wrap gap-1.5 bg-zinc-50/70 px-3 pb-3 pt-1">
                      {list.map((c) => (
                        <Chip
                          key={c.id}
                          active={draft.chapterIds?.includes(c.id) ?? false}
                          onClick={() => toggle('chapterIds', c.id)}
                        >
                          {c.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-zinc-500">知识点</div>
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            {grouped.map(({ subject, topics: list }, index) => {
              const isOpen = openSubjects.has(subject.id);
              const selected = list.filter((t) => draft.topicIds?.includes(t.id)).length;
              if (list.length === 0) return null;
              return (
                <div
                  key={subject.id}
                  className={cn(index > 0 && 'border-t border-zinc-100')}
                >
                  <button
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left active:bg-zinc-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-zinc-800">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      {shortName(subject.name)}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-zinc-400">
                      {selected > 0 ? `已选 ${selected}` : `${list.length} 个`}
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', isOpen && 'rotate-180')}
                      />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-wrap gap-1.5 bg-zinc-50/70 px-3 pb-3 pt-1">
                      {list.map((t) => (
                        <Chip
                          key={t.id}
                          active={draft.topicIds?.includes(t.id) ?? false}
                          onClick={() => toggle('topicIds', t.id)}
                        >
                          {t.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {years.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">年份</div>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <Chip
                  key={y}
                  active={draft.years?.includes(y) ?? false}
                  onClick={() => toggle('years', y)}
                >
                  {y}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
