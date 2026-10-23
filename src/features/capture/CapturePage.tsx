import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Clipboard, FileText, Image as ImageIcon, Layers, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useToast } from '../../ui/Toast';
import { db, setSetting } from '../../storage/db';
import { putAsset } from '../../storage/assets';
import { createProblem } from '../../storage/problems';
import { addDraft, addDrafts, clearAllDrafts, deleteDraft } from '../../storage/drafts';
import { Cropper } from './Cropper';
import { ProblemForm } from './ProblemForm';
import { useBack, useGo } from '../../hooks/useBack';
import { defaultMeta, incrementNo } from './defaultMeta';
import { DraftInbox } from './DraftInbox';
import { PdfPicker } from './PdfPicker';
import { loadPdf, type PdfDoc } from './pdf';
import type { MetaValue } from './MetadataFields';
import type { CaptureDraft } from '../../domain/types';
import { weightFromMastery, weightToInitialReviewDays } from '../../domain/weight';
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
  const continuousCameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const drafts = useLiveQuery(() => db.drafts.orderBy('createdAt').toArray(), [], []) as CaptureDraft[];
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [sessionPreset, setSessionPreset] = useState<Partial<MetaValue> | null>(null);

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
    if (file) {
      setActiveDraftId(null);
      await loadBlob(file);
    }
  };

  const onContinuousCamera = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await addDraft(file);
      toast.show('已存入草稿箱，可继续拍摄', 'success');
    } catch (err) {
      console.error(err);
      toast.show('保存草稿失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onGalleryFiles = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      setActiveDraftId(null);
      await loadBlob(files[0]);
      return;
    }
    setBusy(true);
    try {
      const arr = Array.from(files);
      await addDrafts(arr);
      toast.show(`已将 ${arr.length} 张图片存入草稿箱`, 'success');
    } catch (err) {
      console.error(err);
      toast.show('存入草稿箱失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectDraft = async (d: CaptureDraft) => {
    setActiveDraftId(d.id);
    await loadBlob(d.blob);
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

  /** 框完直接进入「选分类」，自动继承试卷与年份等属性，题号自增 */
  const confirmCrop = async (r: Rect) => {
    setRect(r);
    setBusy(true);
    try {
      const next = await renderCrop(DEFAULT_ENHANCE, r);
      if (!next) return;
      if (crop) URL.revokeObjectURL(crop.url);
      setCrop(next);
      setDraft(DEFAULT_ENHANCE);
      setMeta(await defaultMeta(sessionPreset ?? undefined));
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

    if (activeDraftId) {
      await deleteDraft(activeDraftId);
      setActiveDraftId(null);
    }

    setSessionPreset({
      subjectId: value.subjectId,
      chapterId: value.chapterId,
      sourceYear: value.sourceYear,
      sourcePaper: value.sourcePaper,
      sourceKind: value.sourceKind,
      sourceNo: incrementNo(value.sourceNo),
    });

    await setSetting('lastSubjectId', value.subjectId);
    await setSetting('lastChapterId', value.chapterId);
    setSavedId(id);
    setMeta(value);
    setStage('done');
    const effWeight = value.weight ?? weightFromMastery(value.mastery);
    const days = weightToInitialReviewDays(effWeight);
    toast.show(
      `错题录入成功（已安排在 ${days === 1 ? '明天' : `${days} 天后`} 复习）`,
      'success'
    );
  };

  const reset = () => {
    if (crop) URL.revokeObjectURL(crop.url);
    if (source) URL.revokeObjectURL(source.url);
    setSource(null);
    setCrop(null);
    setRect(null);
    setMeta(null);
    setSavedId(null);
    setActiveDraftId(null);
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
          {stage === 'done' && '已保存，已根据权重排入复习日历'}
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
          {/* 待处理草稿箱 */}
          {drafts && drafts.length > 0 && (
            <DraftInbox
              drafts={drafts}
              onSelect={(d) => void selectDraft(d)}
              onClear={() => void clearAllDrafts()}
              onContinuousCamera={() => continuousCameraRef.current?.click()}
            />
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={continuousCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onContinuousCamera(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onGalleryFiles(e.target.files)}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left active:bg-zinc-50 disabled:opacity-60 shadow-xs transition-colors"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <Camera size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-900">拍照录题</span>
                <span className="block truncate text-xs text-zinc-500">拍一张立即裁剪</span>
              </span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => continuousCameraRef.current?.click()}
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-left active:bg-amber-100/50 disabled:opacity-60 shadow-xs transition-colors"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Layers size={22} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-amber-950">极速连拍</span>
                <span className="block truncate text-xs text-amber-700/70">多题连拍存草稿</span>
              </span>
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left active:bg-zinc-50 disabled:opacity-60 shadow-xs transition-colors"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <ImageIcon size={22} />
            </span>
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                从相册选图
                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 font-normal">
                  支持多选入箱
                </span>
              </span>
              <span className="block text-xs text-zinc-500">
                选 1 张直接裁切，选多张自动存入草稿箱稍后批量录
              </span>
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
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left active:bg-zinc-50 disabled:opacity-60 shadow-xs"
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
        <div className="space-y-2">
          {activeDraftId && (
            <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs text-amber-900">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                正在处理草稿箱中的图片
              </span>
              <span className="text-[11px] text-amber-700">保存后自动移除此草稿</span>
            </div>
          )}
          <Cropper
            src={source.url}
            naturalWidth={source.width}
            naturalHeight={source.height}
            onConfirm={(r) => void confirmCrop(r)}
          />
        </div>
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
              已保存，已根据掌握程度自动排期复习
            </p>
          </div>

          {/* 草稿箱优先流 */}
          {drafts && drafts.length > 0 && (
            <Button
              variant="primary"
              block
              size="lg"
              onClick={() => void selectDraft(drafts[0])}
            >
              处理草稿箱下一张（剩余 {drafts.length} 张）
            </Button>
          )}

          {/* 同一页原图连续截题流 */}
          {source && (
            <Button
              variant={drafts && drafts.length > 0 ? 'secondary' : 'primary'}
              block
              size="lg"
              onClick={() => {
                if (crop) URL.revokeObjectURL(crop.url);
                setCrop(null);
                setRect(null);
                setSavedId(null);
                setStage('crop');
              }}
            >
              在当前原图继续截下一题
            </Button>
          )}

          <Button variant="secondary" block size="lg" onClick={reset}>
            拍新图 / 选其他图片
          </Button>
          <Button block size="lg" disabled={!savedId} onClick={() => go(`/problem/${savedId}`)}>
            查看刚录入的题
          </Button>
          <Button variant="ghost" block onClick={back}>
            返回首页
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
