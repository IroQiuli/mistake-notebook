import { Eraser, Highlighter, Pen, Redo2, Trash2, Undo2 } from 'lucide-react';
import type { InkTool } from './InkSurface';
import { cn } from '../ui/cn';

const PEN_COLORS = [
  { color: '#18181b', label: '黑' },
  { color: '#dc2626', label: '红' },
  { color: '#2563eb', label: '蓝' },
];

const HIGHLIGHT_COLORS = [
  { color: '#facc15', label: '黄' },
  { color: '#4ade80', label: '绿' },
];

interface InkToolbarProps {
  tool: InkTool;
  color: string;
  width: number;
  onToolChange: (tool: InkTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  className?: string;
}

export function InkToolbar({
  tool,
  color,
  width,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  onClear,
  className,
}: InkToolbarProps) {
  const colors = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-white px-1.5 py-1.5',
        className
      )}
    >
      <button
        type="button"
        onClick={() => {
          onToolChange('pen');
          if (tool === 'highlighter') onColorChange(PEN_COLORS[0].color);
        }}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          tool === 'pen' ? 'bg-orange-50 text-orange-600' : 'text-zinc-500'
        )}
        aria-label="钢笔"
      >
        <Pen size={17} />
      </button>
      <button
        type="button"
        onClick={() => {
          onToolChange('highlighter');
          onColorChange(HIGHLIGHT_COLORS[0].color);
        }}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          tool === 'highlighter' ? 'bg-orange-50 text-orange-600' : 'text-zinc-500'
        )}
        aria-label="荧光笔"
      >
        <Highlighter size={17} />
      </button>
      <button
        type="button"
        onClick={() => onToolChange('eraser')}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          tool === 'eraser' ? 'bg-orange-50 text-orange-600' : 'text-zinc-500'
        )}
        aria-label="橡皮"
      >
        <Eraser size={17} />
      </button>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200" />

      <div className="flex shrink-0 items-center gap-1">
        {colors.map((c) => (
          <button
            key={c.color}
            type="button"
            onClick={() => {
              onToolChange(tool === 'eraser' ? 'pen' : tool);
              onColorChange(c.color);
            }}
            className={cn(
              'h-7 w-7 rounded-full border-2',
              color === c.color ? 'border-zinc-900' : 'border-transparent'
            )}
            style={{ backgroundColor: c.color }}
            aria-label={`${c.label}色`}
          />
        ))}
      </div>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-zinc-200" />

      <button
        type="button"
        onClick={() => onWidthChange(width <= 0.0045 ? 0.0075 : 0.0045)}
        className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] text-zinc-500"
        aria-label="笔画粗细"
      >
        <span
          className="block rounded-full bg-zinc-700"
          style={{ width: width <= 0.0045 ? 4 : 7, height: width <= 0.0045 ? 4 : 7 }}
        />
        {width <= 0.0045 ? '细' : '粗'}
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onUndo}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="撤销"
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="重做"
        >
          <Redo2 size={17} />
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-100"
          aria-label="清空"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
}
