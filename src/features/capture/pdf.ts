import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** 动态加载 pdf.js，避免首屏就带上解析器 */
function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = workerUrl;
      return mod;
    });
  }
  return pdfjsPromise;
}

export type PdfDoc = PDFDocumentProxy;

export interface LoadedPdf {
  doc: PdfDoc;
  destroy: () => Promise<void>;
}

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  return { doc, destroy: () => task.destroy() };
}

export interface RenderedPage {
  blob: Blob;
  width: number;
  height: number;
}

/** 以高分辨率渲染某一页（默认宽度 1600px），用于框选截题 */
export async function renderPageBlob(
  doc: PdfDoc,
  pageNumber: number,
  targetWidth = 1600
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, Math.max(0.5, targetWidth / base.width));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PDF 渲染失败'))),
      'image/jpeg',
      0.92
    );
  });
  page.cleanup();
  return { blob, width: canvas.width, height: canvas.height };
}
