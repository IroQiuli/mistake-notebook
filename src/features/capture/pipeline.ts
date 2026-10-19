export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
} // 归一化 0–1

export function fitWithin(
  w: number,
  h: number,
  maxEdge: number
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function clampRect(r: Rect): Rect {
  const x = Math.min(Math.max(0, r.x), 1);
  const y = Math.min(Math.max(0, r.y), 1);
  return { x, y, w: Math.min(r.w, 1 - x), h: Math.min(r.h, 1 - y) };
}

export function rectToPixels(
  r: Rect,
  imgW: number,
  imgH: number,
  min = 32
): { sx: number; sy: number; sw: number; sh: number } | null {
  const sx = Math.round(r.x * imgW);
  const sy = Math.round(r.y * imgH);
  const sw = Math.round(r.w * imgW);
  const sh = Math.round(r.h * imgH);
  if (sw < min || sh < min) return null;
  return { sx, sy, sw, sh };
}

export interface EnhanceOptions {
  brightness: number; // 0.7 – 1.3
  contrast: number; // 0.7 – 2.0
  grayscale: boolean;
  threshold: number; // 0 = 关闭；80 – 200 开启二值化
}

export const DEFAULT_ENHANCE: EnhanceOptions = {
  brightness: 1,
  contrast: 1,
  grayscale: false,
  threshold: 0,
};

export function buildFilter(o: EnhanceOptions): string {
  const parts = [`brightness(${o.brightness})`, `contrast(${o.contrast})`];
  if (o.grayscale) parts.push('grayscale(1)');
  return parts.join(' ');
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export function drawToCanvas(
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  opts: EnhanceOptions,
  outW?: number,
  outH?: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = outW ?? sw;
  canvas.height = outH ?? sh;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = buildFilter(opts);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  if (opts.threshold > 0) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const t = opts.threshold;
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      const c = v > t ? 255 : 0;
      imageData.data[i] = c;
      imageData.data[i + 1] = c;
      imageData.data[i + 2] = c;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime = 'image/jpeg',
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob 返回空'))),
      mime,
      quality
    );
  });
}

export async function makeThumb(
  blob: Blob,
  maxEdge = 400
): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await decodeImage(blob);
  const { width, height } = fitWithin(bmp.width, bmp.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
  const out = await canvasToBlob(canvas, 'image/jpeg', 0.8);
  bmp.close();
  return { blob: out, width, height };
}

/** 把整张图按长边限制缩小，返回画布（用于框选前的预处理） */
export async function prepareImage(
  file: Blob,
  maxEdge = 2400
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const bmp = await decodeImage(file);
  const { width, height } = fitWithin(bmp.width, bmp.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  return { canvas, width, height };
}
