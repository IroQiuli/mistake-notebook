import { useRef, useState } from 'react';
import { InkSurface, type InkSurfaceHandle } from '../../ink/InkSurface';
import { InkToolbar } from '../../ink/InkToolbar';
import { useInk } from '../../ink/useInk';
import { useInkTools } from '../../ink/useInkTools';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';

interface AnnotationOverlayProps {
  problemId: string;
  src: string;
  onClose: () => void;
}

/** 全屏批注：在题干原图上圈画、写解题步骤，笔迹常驻保存 */
export function AnnotationOverlay({ problemId, src, onClose }: AnnotationOverlayProps) {
  const ink = useInk('problem-stem', problemId, 0);
  const tools = useInkTools();
  const surface = useRef<InkSurfaceHandle>(null);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState(true);

  const close = async () => {
    setSaving(true);
    try {
      await ink.flush();
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2 safe-top">
        <button
          type="button"
          onClick={() => void close()}
          className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 active:bg-zinc-100"
        >
          取消
        </button>
        <span className="text-sm font-medium text-zinc-800">批注题干</span>
        <Button size="sm" variant="primary" onClick={() => void close()} disabled={saving}>
          {saving ? '保存中…' : '完成'}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-sm">
          <InkSurface
            ref={surface}
            src={src}
            strokes={ink.strokes}
            onChange={ink.update}
            tool={tools.tool}
            color={tools.color}
            width={tools.width}
            onFirstStroke={() => setHint(false)}
          />
        </div>
        {hint && (
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-400">
            用触屏笔或手指直接写；双指缩放请用「看整页」
          </p>
        )}
      </div>

      <div className={cn('border-t border-zinc-200 bg-white p-2 safe-bottom')}>
        <div className="mx-auto max-w-3xl">
          <InkToolbar
            tool={tools.tool}
            color={tools.color}
            width={tools.width}
            onToolChange={tools.setTool}
            onColorChange={tools.setColor}
            onWidthChange={tools.setWidth}
            onUndo={() => surface.current?.undo()}
            onRedo={() => surface.current?.redo()}
            onClear={() => {
              if (window.confirm('清空这一页的笔迹？')) surface.current?.clear();
            }}
          />
        </div>
      </div>
    </div>
  );
}
