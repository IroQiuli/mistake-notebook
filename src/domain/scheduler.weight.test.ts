
import { describe, it, expect } from 'vitest';
import { applyRating, newCard } from './scheduler';
import { firstReviewDays } from './weight';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

describe('权重影响排期', () => {
  it('权重低的下次复习更早', () => {
    const card = { ...newCard(T0, 'p1'), state: 2 as const, stability: 10, difficulty: 5, lastReview: T0 - 10 * DAY };
    const low = applyRating(card, 3, T0, 0);
    const mid = applyRating(card, 3, T0, 5);
    const high = applyRating(card, 3, T0, 10);
    expect(low.nextDue).toBeLessThan(mid.nextDue);
    expect(mid.nextDue).toBeLessThan(high.nextDue);
  });

  it('不传权重时等于权重 5', () => {
    const card = { ...newCard(T0, 'p2'), state: 2 as const, stability: 10, difficulty: 5, lastReview: T0 - 10 * DAY };
    expect(applyRating(card, 3, T0).nextDue).toBe(applyRating(card, 3, T0, 5).nextDue);
  });

  it('首日间隔至少 1 天', () => {
    expect(firstReviewDays(1, 5)).toBeGreaterThanOrEqual(1);
  });
});
