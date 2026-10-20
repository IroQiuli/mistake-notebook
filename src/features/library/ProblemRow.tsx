import { Link } from 'react-router-dom';
import { useAssetUrl } from '../../hooks/useAssetUrl';
import { formatDue } from '../../domain/time';
import { masteryColor, masteryLevel } from '../../domain/taxonomy';
import { isKeyProblem } from '../../domain/filter';
import { displayTitle } from '../../domain/title';
import { weightOf } from '../../domain/weight';
import type { Card, Chapter, Problem, Topic } from '../../domain/types';
import { cn } from '../../ui/cn';

interface ProblemRowProps {
  problem: Problem;
  chapter?: Chapter;
  topics: Topic[];
  card?: Card;
  subjectColor?: string;
  now: number;
}

export function ProblemRow({ problem, chapter, topics, card, subjectColor, now }: ProblemRowProps) {
  const url = useAssetUrl(problem.thumbAssetId ?? problem.stemAssetId);
  const level = masteryLevel(problem.mastery);
  const barColor = problem.archivedAt ? '#10b981' : level ? level.color : masteryColor(undefined);

  return (
    <Link
      to={`/problem/${problem.id}`}
      className="flex gap-3 rounded-xl border border-l-[3px] border-zinc-200 bg-white p-2.5 active:bg-zinc-50"
      style={{ borderLeftColor: barColor }}
      title={`掌握程度：${level?.label ?? '未分级'}`}
    >
      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">无图</div>
        )}
        <span
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ backgroundColor: subjectColor ?? '#d4d4d8' }}
        />
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-sm font-medium text-zinc-800">
            {displayTitle(problem, chapter?.name)}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {level && !problem.archivedAt && (
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]',
                  isKeyProblem(problem) ? 'font-medium' : 'bg-zinc-50 text-zinc-500'
                )}
                style={
                  isKeyProblem(problem)
                    ? { backgroundColor: level.soft, color: level.color }
                    : undefined
                }
                title={level.hint}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: level.color }}
                />
                {isKeyProblem(problem) ? `重点·${level.short}` : level.short}
              </span>
            )}
            {problem.archivedAt ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-600">
                已掌握
              </span>
            ) : (
              <>
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  W{weightOf(problem)}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px]',
                    card && card.due <= now
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-zinc-100 text-zinc-500'
                  )}
                >
                  {card ? formatDue(card.due, now) : '无卡片'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
          {problem.wrongNote || problem.sourcePaper || '—'}
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                i < problem.difficulty ? 'bg-orange-400' : 'bg-zinc-200'
              )}
            />
          ))}
          {topics.slice(0, 2).map((t) => (
            <span
              key={t.id}
              className="ml-1 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500"
            >
              {t.name}
            </span>
          ))}
          {topics.length > 2 && (
            <span className="text-[10px] text-zinc-400">+{topics.length - 2}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
