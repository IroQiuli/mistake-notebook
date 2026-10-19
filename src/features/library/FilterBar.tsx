import { useEffect, useState } from 'react';
import type { Chapter, ProblemStatus, Topic } from '../../domain/types';
import type { ProblemFilter } from '../../domain/filter';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { cn } from '../../ui/cn';

interface FilterBarProps {
  open: boolean;
  onClose: () => void;
  value: ProblemFilter;
  onApply: (next: ProblemFilter) => void;
  chapters: Chapter[];
  topics: Topic[];
  subjectId?: string;
  years: number[];
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
        'rounded-lg border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-orange-300 bg-orange-50 text-orange-600'
          : 'border-zinc-200 bg-white text-zinc-600'
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  open,
  onClose,
  value,
  onApply,
  chapters,
  topics,
  subjectId,
  years,
}: FilterBarProps) {
  const [draft, setDraft] = useState<ProblemFilter>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const toggle = <K extends 'chapterIds' | 'topicIds' | 'difficulty' | 'years'>(
    key: K,
    item: NonNullable<ProblemFilter[K]>[number]
  ) => {
    const list = (draft[key] as Array<typeof item> | undefined) ?? [];
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
    setDraft({ ...draft, [key]: next });
  };

  const visibleChapters = chapters.filter((c) => !subjectId || c.subjectId === subjectId);
  const visibleTopics = topics.filter((t) => !subjectId || t.subjectId === subjectId);

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
          <div className="mb-2 text-xs font-medium text-zinc-500">章节</div>
          <div className="flex flex-wrap gap-2">
            {visibleChapters.map((c) => (
              <Chip
                key={c.id}
                active={draft.chapterIds?.includes(c.id) ?? false}
                onClick={() => toggle('chapterIds', c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>

        {visibleTopics.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">知识点</div>
            <div className="flex flex-wrap gap-2">
              {visibleTopics.map((t) => (
                <Chip
                  key={t.id}
                  active={draft.topicIds?.includes(t.id) ?? false}
                  onClick={() => toggle('topicIds', t.id)}
                >
                  {t.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

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
