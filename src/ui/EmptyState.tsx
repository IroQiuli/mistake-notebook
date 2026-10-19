import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      {icon && <div className="text-4xl text-zinc-300">{icon}</div>}
      <h3 className="text-base font-medium text-zinc-800">{title}</h3>
      {description && <p className="max-w-xs text-sm leading-relaxed text-zinc-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
