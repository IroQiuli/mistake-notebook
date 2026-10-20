
import { describe, it, expect } from 'vitest';
import {
  adjustWeight,
  clampWeight,
  firstReviewDays,
  intervalFactor,
  weightFromMastery,
} from './weight';

describe('权重', () => {
  it('掌握程度映射到初始权重', () => {
    expect([1, 2, 3, 4].map((m) => weightFromMastery(m as 1 | 2 | 3 | 4))).toEqual([2, 4, 6, 8]);
    expect(weightFromMastery(undefined)).toBe(5);
  });

  it('评分增减并截断在 0~10', () => {
    expect(adjustWeight(5, 1)).toBe(3);
    expect(adjustWeight(5, 4)).toBe(7);
    expect(adjustWeight(1, 1)).toBe(0);
    expect(adjustWeight(9, 4)).toBe(10);
    expect(clampWeight(99)).toBe(10);
  });

  it('权重越高排期倍数越大', () => {
    expect(intervalFactor(0)).toBeLessThan(intervalFactor(5));
    expect(intervalFactor(5)).toBeLessThan(intervalFactor(10));
  });

  it('新题间隔按掌握程度 + 难度', () => {
    expect(firstReviewDays(1, 3)).toBe(1);
    expect(firstReviewDays(2, 3)).toBe(3);
    expect(firstReviewDays(3, 3)).toBe(7);
    expect(firstReviewDays(4, 3)).toBe(14);
    // 难度大 → 更早
    expect(firstReviewDays(3, 5)).toBe(6);
    // 难度小 → 更晚
    expect(firstReviewDays(3, 1)).toBe(9);
    // 未分级
    expect(firstReviewDays(undefined, 3)).toBe(3);
  });
});
