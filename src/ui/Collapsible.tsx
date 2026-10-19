import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

interface CollapsibleProps {
  title: string;
  /** 标题右侧的一句话摘要，收起时也能看到关键信息 */
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** 可折叠卡片：标题行常驻，内容点开才展开 */
export function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('overflow-hidden rounded-2xl border border-zinc-200 bg-white', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-zinc-50"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-800">{title}</span>
          {summary && <span className="mt-0.5 block truncate text-[11px] text-zinc-400">{summary}</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-zinc-300 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && <div className="border-t border-zinc-100 px-4 py-3">{children}</div>}
    </section>
  );
}
