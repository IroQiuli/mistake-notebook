import type { InkPoint, Stroke } from '../domain/types';

/** 抽稀：距离与压力变化都太小的点丢掉，保留首尾点 */
export function simplify(
  points: InkPoint[],
  minDist = 0.0015,
  minPressureDelta = 0.08
): InkPoint[] {
  if (points.length <= 2) return points;
  const out: InkPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1];
    const p = points[i];
    const dist = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    if (dist >= minDist || Math.abs(p[2] - prev[2]) >= minPressureDelta) out.push(p);
  }
  out.push(points[points.length - 1]);
  return out;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function strokeBounds(stroke: Stroke): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of stroke.points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy };
}

/**
 * 橡皮命中判定：归一化坐标下用椭圆距离。
 * 因为 x、y 的归一化分母分别是图片宽高，用同一个半径会让竖向和横向手感不一致；
 * 所以分别传入 rx / ry（都由像素半径换算而来）。
 */
export function hitTestStroke(
  stroke: Stroke,
  x: number,
  y: number,
  rx: number,
  ry = rx
): boolean {
  const b = strokeBounds(stroke);
  if (x < b.minX - rx || x > b.maxX + rx) return false;
  if (y < b.minY - ry || y > b.maxY + ry) return false;

  const inside = (cx: number, cy: number) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };

  const pts = stroke.points;
  if (pts.length === 1) return inside(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p = closestPointOnSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (inside(p.x, p.y)) return true;
  }
  return false;
}

/** 橡皮擦：返回被命中笔画的 id（可能同时命中多条） */
export function hitTest(
  strokes: Stroke[],
  x: number,
  y: number,
  rx: number,
  ry: number = rx
): string[] {
  const hits: string[] = [];
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (hitTestStroke(strokes[i], x, y, rx, ry)) hits.push(strokes[i].id);
  }
  return hits;
}

/** 笔宽换算成像素：width 存的是相对画布宽度的比例 */
export function toPxWidth(stroke: Stroke, canvasWidth: number): number {
  return Math.max(0.75, stroke.width * canvasWidth);
}

export function countStrokes(strokes: Stroke[]): number {
  return strokes.length;
}
