import type { Stroke } from '../domain/types';
import { toPxWidth } from './strokes';

function applyStyle(ctx: CanvasRenderingContext2D, stroke: Stroke, canvasWidth: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.32;
    ctx.globalCompositeOperation = 'multiply';
  } else {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  return toPxWidth(stroke, canvasWidth);
}

/** 画一条完整笔画（坐标归一化，width/height 为 canvas 的 CSS 像素尺寸） */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number
): void {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.save();
  const base = applyStyle(ctx, stroke, width);

  if (pts.length === 1) {
    const r = (base * (0.55 + pts[0][2] * 0.9)) / 2;
    ctx.beginPath();
    ctx.arc(pts[0][0] * width, pts[0][1] * height, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const pressure = (a[2] + b[2]) / 2;
    ctx.lineWidth = Math.max(0.6, base * (0.55 + pressure * 0.9));
    ctx.beginPath();
    ctx.moveTo(a[0] * width, a[1] * height);
    ctx.lineTo(b[0] * width, b[1] * height);
    ctx.stroke();
  }
  ctx.restore();
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.restore();
}

export function drawAll(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number
): void {
  clearCanvas(ctx, width, height);
  for (const s of strokes) drawStroke(ctx, s, width, height);
}

/** 只画最新一段，用于书写时的增量绘制 */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  from: number,
  to: number,
  width: number,
  height: number
): void {
  const pts = stroke.points;
  if (to <= from) return;
  ctx.save();
  const base = applyStyle(ctx, stroke, width);
  for (let i = Math.max(1, from + 1); i <= to; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const pressure = (a[2] + b[2]) / 2;
    ctx.lineWidth = Math.max(0.6, base * (0.55 + pressure * 0.9));
    ctx.beginPath();
    ctx.moveTo(a[0] * width, a[1] * height);
    ctx.lineTo(b[0] * width, b[1] * height);
    ctx.stroke();
  }
  ctx.restore();
}

/** 导出纯笔迹 PNG（草稿板用） */
export function composeStrokes(strokes: Stroke[], width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawAll(ctx, strokes, canvas.width, canvas.height);
  return canvas;
}

/** 导出带背景的 PNG（底图 + 笔迹） */
export function composeWithBackground(
  image: HTMLImageElement,
  strokes: Stroke[],
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const s of strokes) drawStroke(ctx, s, canvas.width, canvas.height);
  return canvas;
}
