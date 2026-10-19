import { describe, it, expect } from 'vitest';
import { clampRect, fitWithin, rectToPixels } from './pipeline';

describe('几何工具', () => {
  it('fitWithin 保持比例并限制长边', () => {
    expect(fitWithin(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });

  it('clampRect 把越界矩形收回边界内', () => {
    expect(clampRect({ x: -0.1, y: -0.1, w: 2, h: 2 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('rectToPixels 用缩放系数换算并取整', () => {
    expect(rectToPixels({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, 1000, 800)).toEqual({
      sx: 100,
      sy: 160,
      sw: 500,
      sh: 200,
    });
  });

  it('矩形过小时返回 null', () => {
    expect(rectToPixels({ x: 0.1, y: 0.1, w: 0.01, h: 0.01 }, 100, 100)).toBeNull();
  });
});
