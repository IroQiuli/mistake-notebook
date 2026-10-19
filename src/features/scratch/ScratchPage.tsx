import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Download, PenLine, Plus, Trash2 } from 'lucide-react';
import { db } from '../../storage/db';
import { deleteInk } from '../../storage/inks';
import type { Scratch } from '../../domain/types';
import { InkSurface, type InkSurfaceHandle } from '../../ink/InkSurface';
import { InkToolbar } from '../../ink/InkToolbar';
import { composeStrokes } from '../../ink/renderer';
import { useInk } from '../../ink/useInk';
import { useInkTools } from '../../ink/useInkTools';
import { canvasToBlob } from '../../features/capture/pipeline';
import { downloadBlob } from '../../storage/backup';
import { formatDateTime } from '../../domain/time';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { useToast } from '../../ui/Toast';

function ScratchEditor({ page, onBack }: { page: Scratch; onBack: () => void }) {
  const toast = useToast();
  const ink = useInk('scratch', page.id, 0.72);
  const tools = useInkTools();
  const surface = useRef<InkSurfaceHandle>(null);
  const [title, setTitle] = useState(page.title);

  const saveTitle = async () => {
    if (title.trim() && title !== page.title) {
      await db.scratch.update(page.id, { title: title.trim(), updatedAt: Date.now() });
    }
  };

  const exportPng = async () => {
    await ink.flush();
    const canvas = composeStrokes(ink.strokes, 1200, 1600);
    const blob = await canvasToBlob(canvas, 'image/png');
    downloadBlob(blob, `${title || '草稿'}.png`);
    toast.show('已导出图片', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100">
      <header className="flex items-center gap-2 border-b border-zinc-200 bg-white px-2 py-2 safe-top">
        <button
          type="button"
          onClick={() => {
            void saveTitle();
            onBack();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 active:bg-zinc-100"
          aria-label="返回草稿列表"
        >
          <ArrowLeft size={20} />
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-800 outline-none focus:bg-zinc-50"
        />
        <button
          type="button"
          onClick={() => void exportPng()}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 active:bg-zinc-100"
          aria-label="导出 PNG"
        >
          <Download size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-sm">
          <InkSurface
            ref={surface}
            strokes={ink.strokes}
            onChange={ink.update}
            tool={tools.tool}
            color={tools.color}
            width={tools.width}
            aspect={0.72}
          />
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white p-2 safe-bottom">
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
              if (window.confirm('清空这页草稿？')) surface.current?.clear();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ScratchPage() {
  const pages = useLiveQuery(() => db.scratch.orderBy('updatedAt').reverse().toArray(), [], []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = pages.find((p) => p.id === activeId) ?? null;

  const create = async () => {
    const now = Date.now();
    const page: Scratch = {
      id: crypto.randomUUID(),
      title: `草稿 ${new Date(now).toLocaleDateString('zh-CN')} ${new Date(now).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: now,
      updatedAt: now,
    };
    await db.scratch.add(page);
    setActiveId(page.id);
  };

  if (active) {
    return <ScratchEditor key={active.id} page={active} onBack={() => setActiveId(null)} />;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">草稿板</h1>
          <p className="mt-0.5 text-xs text-zinc-500">随手写、算草稿，可导出图片</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => void create()}>
          <Plus size={16} />
          新建
        </Button>
      </header>

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50">
          <EmptyState
            icon={<PenLine size={26} />}
            title="还没有草稿页"
            description="算积分、列劳斯表、画根轨迹，随手写一页。"
            action={
              <Button variant="primary" onClick={() => void create()}>
                新建草稿
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {pages.map((p) => (
            <li key={p.id} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveId(p.id)}
                className="min-w-0 flex-1 px-4 py-3 text-left active:bg-zinc-50"
              >
                <div className="truncate text-sm font-medium text-zinc-800">{p.title}</div>
                <div className="mt-0.5 text-[11px] text-zinc-400">
                  更新于 {formatDateTime(p.updatedAt)}
                </div>
              </button>
              <button
                type="button"
                aria-label="删除草稿"
                onClick={async () => {
                  if (!window.confirm(`删除「${p.title}」？`)) return;
                  const inks = await db.inks.where('ownerId').equals(p.id).toArray();
                  for (const ink of inks) await deleteInk(ink.id);
                  await db.scratch.delete(p.id);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center text-zinc-300 active:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
