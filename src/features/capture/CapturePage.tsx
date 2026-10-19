import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { putAsset } from '../../storage/assets';
import { createProblem } from '../../storage/problems';
import { setSetting } from '../../storage/db';
import { Cropper } from './Cropper';
import { ProblemForm } from './ProblemForm';
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

type Stage = 'pick' | 'crop' | 'enhance' | 'form' | 'done';

interface Source {
  canvas: HTMLCanvasElement;
  url: string;
  width: number;
  height: number;
}

export default function CapturePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('pick');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [enhance, setEnhance] = useState<EnhanceOptions>(DEFAULT_ENHANCE);
  const [crop, setCrop] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(
    null
  );
  const [meta, setMeta] = useState<MetaValue | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ doc: PdfDoc; destroy: () => Promise<void>; name: string } | null>(
    null
  );

  const loadBlob = async (file: Blob) => {
    setBusy(true);
    try {
      const { canvas, width, height } = await prepareImage(file, 2400);
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
      const url = URL.createObjectURL(blob);
      setSource({ canvas, url, width, height });
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

  const renderCrop = async (opts: EnhanceOptions, r: Rect | null = rect) => {
    if (!source || !r) return null;
    const px = rectToPixels(r, source.width, source.height);
    if (!px) {
      toast.show('框选区域太小，重新拖一下', 'error');
      return null;
    }
    const canvas = drawToCanvas(source.canvas, px.sx, px.sy, px.sw, px.sh, opts);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    return { blob, width: canvas.width, height: canvas.height, url: URL.createObjectURL(blob) };
  };

  const confirmCrop = async (r: Rect) => {
    setRect(r);
    setBusy(true);
    const next = await renderCrop(DEFAULT_ENHANCE, r);
    setBusy(false);
    if (!next) return;
    setCrop(next);
    setEnhance(DEFAULT_ENHANCE);
    setStage('enhance');
  };

  const confirmEnhance = async () => {
    setBusy(true);
    try {
      const next = await renderCrop(enhance);
      if (!next) return;
      setCrop(next);
      const initial = meta ?? (await defaultMeta());
      setMeta(initial);
      setStage('form');
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
    const thumbAssetId = await putAsset(thumb.blob, 'thumb', {
      width: thumb.width,
      height: thumb.height,
    }, stemAssetId);

    const id = await createProblem({
      ...value,
      stemAssetId,
      thumbAssetId,
      answerAssetIds: [],
      topicIds: value.topicIds,
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

  return (
    <div className="space-y-4">
      <header className="pt-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">录入错题</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          {stage === 'pick' && '选一张图片，框出这道题'}
          {stage === 'crop' && '把这道题框出来'}
          {stage === 'enhance' && '调一下亮度和对比度，文字更清楚'}
          {stage === 'form' && '补全分类信息'}
          {stage === 'done' && '已进入今日复习队列'}
        </p>
      </header>

      <ol className="flex items-center gap-1 text-[11px] text-zinc-400">
        {['选图', '框选', '增强', '信息'].map((label, i) => {
          const active =
            (stage === 'pick' && i === 0) ||
            (stage === 'crop' && i === 1) ||
            (stage === 'enhance' && i === 2) ||
            (stage === 'form' && i === 3) ||
            (stage === 'done' && i === 3);
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

          <div className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <FileText size={24} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-900">从 PDF 截题</div>
              <div className="text-xs text-zinc-500">真题 PDF、讲义，翻到那一页再框选</div>
            </div>
            <Button size="sm" disabled={busy} onClick={() => pdfRef.current?.click()}>
              选 PDF
            </Button>
          </div>
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

          <p className="px-1 text-[11px] leading-relaxed text-zinc-400">
            提示：拍的时候尽量正对卷子、光线均匀，后续框选会更准。
          </p>
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

      {stage === 'enhance' && crop && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-2">
            <img
              src={crop.url}
              alt="增强预览"
              className="max-h-72 w-full object-contain"
              style={{ filter: buildFilter(enhance) }}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-zinc-500">
                <span>亮度</span>
                <span className="tabular-nums">{enhance.brightness.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.05}
                value={enhance.brightness}
                onChange={(e) => setEnhance({ ...enhance, brightness: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-zinc-500">
                <span>对比度</span>
                <span className="tabular-nums">{enhance.contrast.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0.7}
                max={2}
                step={0.1}
                value={enhance.contrast}
                onChange={(e) => setEnhance({ ...enhance, contrast: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </label>
            <label className="flex items-center justify-between text-xs text-zinc-600">
              <span>去彩色（灰度）</span>
              <input
                type="checkbox"
                checked={enhance.grayscale}
                onChange={(e) => setEnhance({ ...enhance, grayscale: e.target.checked })}
                className="h-5 w-5 accent-orange-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-zinc-500">
                <span>二值化（0 为关闭）</span>
                <span className="tabular-nums">{enhance.threshold}</span>
              </span>
              <input
                type="range"
                min={0}
                max={200}
                step={10}
                value={enhance.threshold}
                onChange={(e) => setEnhance({ ...enhance, threshold: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" block onClick={() => setStage('crop')}>
              重新框选
            </Button>
            <Button variant="primary" block disabled={busy} onClick={() => void confirmEnhance()}>
              下一步
            </Button>
          </div>
        </div>
      )}

      {stage === 'form' && crop && meta && (
        <ProblemForm
          initial={meta}
          previewUrl={crop.url}
          onSubmit={save}
          onCancel={() => setStage('enhance')}
        />
      )}

      {stage === 'done' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <div className="text-3xl">✅</div>
            <p className="mt-2 text-sm font-medium text-emerald-800">已保存，明天起会自动排期复习</p>
          </div>
          <Button
            variant="primary"
            block
            size="lg"
            onClick={reset}
          >
            继续录下一题
          </Button>
          <Button block size="lg" disabled={!savedId} onClick={() => navigate(`/problem/${savedId}`)}>
            查看这道题
          </Button>
          <Button variant="ghost" block onClick={() => navigate('/')}>
            回到今日
          </Button>
        </div>
      )}
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
