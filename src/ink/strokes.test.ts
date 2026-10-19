import { describe, it, expect } from 'vitest';
import { hitTest, hitTestStroke, simplify, strokeBounds, toPxWidth } from './strokes';
import type { Stroke } from '../domain/types';

const stroke = (points: [number, number, number][]): Stroke => ({
  id: 's1',
  tool: 'pen',
  color: '#000',
  width: 0.005,
  points,
});

describe('笔迹几何', () => {
  it('抽稀保留首尾点并去掉密集重复点', () => {
    const points: [number, number, number][] = [
      [0, 0, 0.5],
      [0.0001, 0.0001, 0.5],
      [0.0002, 0.0002, 0.5],
      [0.5, 0.5, 0.5],
      [0.5001, 0.5001, 0.5],
    ];
    const out = simplify(points);
    expect(out[0]).toEqual([0, 0, 0.5]);
    expect(out[out.length - 1]).toEqual([0.5001, 0.5001, 0.5]);
    expect(out.length).toBe(3);
  });

  it('包围盒正确', () => {
    const b = strokeBounds(stroke([
      [0.2, 0.3, 0.5],
      [0.6, 0.1, 0.5],
    ]));
    expect(b).toEqual({ minX: 0.2, minY: 0.1, maxX: 0.6, maxY: 0.3 });
  });

  it('橡皮命中线段附近', () => {
    const s = stroke([
      [0.1, 0.1, 0.5],
      [0.9, 0.1, 0.5],
    ]);
    expect(hitTestStroke(s, 0.5, 0.105, 0.02)).toBe(true);
    expect(hitTestStroke(s, 0.5, 0.5, 0.02)).toBe(false);
  });

  it('hitTest 从后往前找最近的笔画', () => {
    const a = stroke([
      [0.1, 0.1, 0.5],
      [0.2, 0.2, 0.5],
    ]);
    const b = { ...stroke([
      [0.1, 0.1, 0.5],
      [0.2, 0.2, 0.5],
    ]), id: 's2' };
    expect(hitTest([a, b], 0.15, 0.15, 0.02)?.id).toBe('s2');
    expect(hitTest([a, b], 0.8, 0.8, 0.02)).toBeUndefined();
  });

  it('线宽按画布宽度换算且有下限', () => {
    expect(toPxWidth(stroke([]), 1000)).toBeCloseTo(5);
    expect(toPxWidth({ ...stroke([]), width: 0.0001 }, 100)).toBeGreaterThanOrEqual(0.75);
  });
});
