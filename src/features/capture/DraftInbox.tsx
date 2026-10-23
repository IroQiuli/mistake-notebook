import { useEffect, useState } from 'react';
import { Camera, Layers, Play, X } from 'lucide-react';
import type { CaptureDraft } from '../../domain/types';
import { deleteDraft } from '../../storage/drafts';
import { Button } from '../../ui/Button';

interface DraftInboxProps {
  drafts: CaptureDraft[];
  onSelect: (draft: CaptureDraft) => void;
  onClear: () => void;
  onContinuousCamera?: () => void;
}

export function DraftInbox({ drafts, onSelect, onClear, onContinuousCamera }: DraftInboxProps) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    for (const d of drafts) {
      map.set(d.id, URL.createObjectURL(d.blob));
    }
    setUrls(map);
    return () => {
      for (const url of map.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [drafts]);

  if (drafts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/70 to-orange-50/30 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-white shadow-xs">
            <Layers size={14} />
          </span>
          <span className="text-sm font-semibold text-zinc-900">待处理草稿箱</span>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-orange-700">
            {drafts.length} 张
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onContinuousCamera && (
            <button
              type="button"
              onClick={onContinuousCamera}
              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium active:opacity-75"
            >
              <Camera size={13} />
              继续加拍
            </button>
          )}
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-zinc-400 hover:text-red-500 active:opacity-75"
            title="清空草稿"
          >
            清空
          </button>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-zinc-500">
        已暂存连拍或多选的原图，点击任意一张开始裁剪与打标：
      </p>

      <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {drafts.map((d, index) => {
          const url = urls.get(d.id);
          return (
            <div
              key={d.id}
              className="group relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900/10 shadow-xs transition-transform active:scale-95"
            >
              {url ? (
                <img
                  src={url}
                  alt={`草稿 ${index + 1}`}
                  onClick={() => onSelect(d)}
                  className="h-full w-full cursor-pointer object-cover"
                />
              ) : (
                <div className="h-full w-full animate-pulse bg-zinc-200" />
              )}
              <span className="pointer-events-none absolute left-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded-md bg-black/60 text-[10px] font-bold text-white backdrop-blur-xs">
                #{index + 1}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteDraft(d.id);
                }}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-80 hover:bg-red-500 hover:opacity-100 transition-colors"
                aria-label="删除这张草稿"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-1">
        <Button
          variant="primary"
          block
          size="sm"
          onClick={() => drafts[0] && onSelect(drafts[0])}
        >
          <span className="flex items-center justify-center gap-1.5 font-medium">
            <Play size={14} className="fill-current" />
            处理第 1 张草稿
          </span>
        </Button>
      </div>
    </div>
  );
}
