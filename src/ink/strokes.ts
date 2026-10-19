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

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 橡皮命中判定：点到任一折线段距离小于半径（坐标均为归一化） */
export function hitTestStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const b = strokeBounds(stroke);
  if (x < b.minX - radius || x > b.maxX + radius) return false;
  if (y < b.minY - radius || y > b.maxY + radius) return false;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= radius;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distanceToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= radius) {
      return true;
    }
  }
  return false;
}

export function hitTest(
  strokes: Stroke[],
  x: number,
  y: number,
  radius: number
): Stroke | undefined {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (hitTestStroke(strokes[i], x, y, radius)) return strokes[i];
  }
  return undefined;
}

/** 笔宽换算成像素：width 存的是相对画布宽度的比例 */
export function toPxWidth(stroke: Stroke, canvasWidth: number): number {
  return Math.max(0.75, stroke.width * canvasWidth);
}

export function countStrokes(strokes: Stroke[]): number {
  return strokes.length;
}
