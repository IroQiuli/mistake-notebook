import { useEffect, useRef, useState } from 'react';
import { Camera, Clipboard, FileText, Image as ImageIcon, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { putAsset } from '../../storage/assets';
import { createProblem } from '../../storage/problems';
import { setSetting } from '../../storage/db';
import { Cropper } from './Cropper';
import { ProblemForm } from './ProblemForm';
import { useBack, useGo } from '../../hooks/useBack';
import { defaultMeta } from './defaultMeta';
import { PdfPicker } from './PdfPicker';
import { loadPdf, type PdfDoc } from './pdf';
import type { MetaValue } from './MetadataFields';
import {
  DEFAULT_ENHANCE,
  buildFilter,
  canvasToBlob,
  drawToCanvas,
  makeThumb,
  prepareImage,
  rectToPixels,
  type EnhanceOptions,
  type Rect,
} from './pipeline';

type Stage = 'pick' | 'crop' | 'form' | 'done';

interface Source {
  canvas: HTMLCanvasElement;
  url: string;
  width: number;
  height: number;
}

interface Crop {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

export default function CapturePage() {
  const back = useBack('/');
  const go = useGo();
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('pick');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [meta, setMeta] = useState<MetaValue | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ doc: PdfDoc; destroy: () => Promise<void>; name: string } | null>(
    null
  );

  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [draft, setDraft] = useState<EnhanceOptions>(DEFAULT_ENHANCE);

  const loadBlob = async (file: Blob) => {
    setBusy(true);
    try {
      const { canvas, width, height } = await prepareImage(file, 2400);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      setSource({ canvas, url: URL.createObjectURL(blob), width, height });
      setRect(null);
      setStage('crop');
    } catch (err) {
      console.error(err);
      toast.show('这张图打不开，换一张或重拍', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file?: File) => {
    if (file) await loadBlob(file);
  };

  const onPdfFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const doc = await loadPdf(file);
      setPdf({ ...doc, name: file.name });
    } catch (err) {
      console.error(err);
      toast.show('这个 PDF 打不开，可能已加密或损坏', 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (stage !== 'pick') return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void loadBlob(file);
            toast.show('已载入剪贴板截图', 'success');
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [stage]);

  const pasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        toast.show('当前浏览器限制剪贴板读取，请直接按键盘 Ctrl+V 粘贴', 'info');
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            await loadBlob(blob);
            toast.show('已载入剪贴板截图', 'success');
            return;
          }
        }
      }
      toast.show('剪贴板中未找到图片内容', 'info');
    } catch {
      toast.show('读取剪贴板受阻，请直接在页面按 Ctrl+V 粘贴', 'info');
    }
  };

  const renderCrop = async (opts: EnhanceOptions, r: Rect) => {
    if (!source) return null;
    const px = rectToPixels(r, source.width, source.height);
    if (!px) {
      toast.show('选区太小，重新拖一下', 'error');
      return null;
    }
    const canvas = drawToCanvas(source.canvas, px.sx, px.sy, px.sw, px.sh, opts);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    return { blob, width: canvas.width, height: canvas.height, url: URL.createObjectURL(blob) };
  };

  /** 框完直接进入「选分类」，中间不再让用户做别的操作 */
  const confirmCrop = async (r: Rect) => {
    setRect(r);
    setBusy(true);
    try {
      const next = await renderCrop(DEFAULT_ENHANCE, r);
      if (!next) return;
      if (crop) URL.revokeObjectURL(crop.url);
      setCrop(next);
      setDraft(DEFAULT_ENHANCE);
      setMeta(await defaultMeta());
      setStage('form');
    } finally {
      setBusy(false);
    }
  };

  const applyEnhance = async () => {
    if (!rect) return;
    setBusy(true);
    try {
      const next = await renderCrop(draft, rect);
      if (!next) return;
      if (crop) URL.revokeObjectURL(crop.url);
      setCrop(next);
      setEnhanceOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const save = async (value: MetaValue) => {
    if (!crop) throw new Error('没有题目图片');
    const stemAssetId = await putAsset(crop.blob, 'stem', {
      width: crop.width,
      height: crop.height,
    });
    const thumb = await makeThumb(crop.blob, 400);
    const thumbAssetId = await putAsset(
      thumb.blob,
      'thumb',
      { width: thumb.width, height: thumb.height },
      stemAssetId
    );

    const id = await createProblem({
      ...value,
      stemAssetId,
      thumbAssetId,
      answerAssetIds: [],
    });

    await setSetting('lastSubjectId', value.subjectId);
    await setSetting('lastChapterId', value.chapterId);
    setSavedId(id);
    setMeta(value);
    setStage('done');
    toast.show('已加入今日复习队列', 'success');
  };

  const reset = () => {
    if (crop) URL.revokeObjectURL(crop.url);
    setSource(null);
    setCrop(null);
    setRect(null);
    setMeta(null);
    setSavedId(null);
    setStage('pick');
  };

  const steps = ['选图', '框选', '分类'];

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">录入错题</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          {stage === 'pick' && '选一张图片，框出这道题'}
          {stage === 'crop' && '把这道题框出来'}
          {stage === 'form' && '选一下科目和章节，就可以保存了'}
          {stage === 'done' && '已进入今日复习队列'}
        </p>
      </header>

      <ol className="flex items-center gap-1 text-[11px] text-zinc-400">
        {steps.map((label, i) => {
          const active =
            (stage === 'pick' && i === 0) ||
            (stage === 'crop' && i === 1) ||
            ((stage === 'form' || stage === 'done') && i === 2);
          return (
            <li key={label} className="flex flex-1 items-center gap-1">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  active ? 'bg-orange-500 text-white' : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                {i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {stage === 'pick' && (
        <div className="space-y-3">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left active:bg-zinc-50 disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <Camera size={24} />
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-900">拍照</span>
              <span className="block text-xs text-zinc-500">对着纸质卷子拍一张</span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left active:bg-zinc-50 disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <ImageIcon size={24} />
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-900">从相册选</span>
              <span className="block text-xs text-zinc-500">截图、拍照都行</span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void pasteFromClipboard()}
            className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50/40 p-4 text-left active:bg-orange-100/50 disabled:opacity-60 transition-colors"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Clipboard size={22} />
            </span>
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-orange-950">
                从剪贴板粘贴
                <span className="rounded bg-orange-200/70 px-1.5 py-0.2 text-[10px] font-semibold text-orange-800">
                  Ctrl + V
                </span>
              </span>
              <span className="block text-xs text-orange-700/70">
                做题截图后直接按快捷键或点击载入
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => pdfRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left active:bg-zinc-50 disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <FileText size={24} />
            </span>
            <span>
              <span className="block text-sm font-medium text-zinc-900">从 PDF 截题</span>
              <span className="block text-xs text-zinc-500">真题 PDF、讲义，翻到那一页再框选</span>
            </span>
          </button>

          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void onPdfFile(file);
            }}
          />
        </div>
      )}

      {stage === 'crop' && source && (
        <Cropper
          src={source.url}
          naturalWidth={source.width}
          naturalHeight={source.height}
          onConfirm={(r) => void confirmCrop(r)}
        />
      )}

      {stage === 'form' && crop && meta && (
        <>
          <ProblemForm
            initial={meta}
            previewUrl={crop.url}
            defaultAdvanced={false}
            previewAction={
              <button
                type="button"
                onClick={() => {
                  setDraft(DEFAULT_ENHANCE);
                  setEnhanceOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs text-zinc-500"
              >
                <SlidersHorizontal size={13} />
                图片发暗/发灰？点这里调整
              </button>
            }
            onSubmit={save}
            onCancel={() => setStage('crop')}
          />
        </>
      )}

      {stage === 'done' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="text-3xl">✅</div>
            <p className="mt-2 text-sm font-medium text-emerald-800">
              已保存，明天起会自动排期复习
            </p>
          </div>
          <Button variant="primary" block size="lg" onClick={reset}>
            继续录下一题
          </Button>
          <Button block size="lg" disabled={!savedId} onClick={() => go(`/problem/${savedId}`)}>
            查看这道题
          </Button>
          <Button variant="ghost" block onClick={back}>
            返回上一页
          </Button>
        </div>
      )}

      <Dialog open={enhanceOpen} onClose={() => setEnhanceOpen(false)} title="调整图片" size="md">
        {crop && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-2">
              <img
                src={crop.url}
                alt="增强预览"
                className="max-h-56 w-full object-contain"
                style={{ filter: buildFilter(draft) }}
              />
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 flex justify-between text-xs text-zinc-500">
                  <span>亮度</span>
                  <span className="tabular-nums">{draft.brightness.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={draft.brightness}
                  onChange={(e) => setDraft({ ...draft, brightness: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex justify-between text-xs text-zinc-500">
                  <span>对比度</span>
                  <span className="tabular-nums">{draft.contrast.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0.7}
                  max={2}
                  step={0.1}
                  value={draft.contrast}
                  onChange={(e) => setDraft({ ...draft, contrast: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-zinc-600">
                <span>去彩色（灰度）</span>
                <input
                  type="checkbox"
                  checked={draft.grayscale}
                  onChange={(e) => setDraft({ ...draft, grayscale: e.target.checked })}
                  className="h-5 w-5 accent-orange-500"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex justify-between text-xs text-zinc-500">
                  <span>二值化（0 为关闭）</span>
                  <span className="tabular-nums">{draft.threshold}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={10}
                  value={draft.threshold}
                  onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </label>
            </div>

            <div className="flex gap-3">
              <Button block onClick={() => setEnhanceOpen(false)}>
                取消
              </Button>
              <Button variant="primary" block disabled={busy} onClick={() => void applyEnhance()}>
                应用
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {pdf && (
        <PdfPicker
          doc={pdf.doc}
          fileName={pdf.name}
          onCancel={() => {
            void pdf.destroy();
            setPdf(null);
          }}
          onPick={(blob) => {
            void pdf.destroy();
            setPdf(null);
            void loadBlob(blob);
          }}
        />
      )}
    </div>
  );
}
