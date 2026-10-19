import { describe, it, expect } from 'vitest';
import { newCard, applyRating, previewIntervals } from './scheduler';

const T0 = new Date('2026-10-19T20:00:00').getTime();
const DAY = 24 * 3600 * 1000;

describe('FSRS 封装', () => {
  it('新卡立即可用', () => {
    const c = newCard(T0, 'p1');
    expect(c.due).toBe(T0);
    expect(c.reps).toBe(0);
    expect(c.state).toBe(0);
    expect(c.problemId).toBe('p1');
  });

  it('忘记的间隔最短，熟练的间隔最长', () => {
    const c = newCard(T0);
    const again = applyRating(c, 1, T0);
    const hard = applyRating(c, 2, T0);
    const good = applyRating(c, 3, T0);
    const easy = applyRating(c, 4, T0);
    expect(again.nextDue).toBeLessThanOrEqual(hard.nextDue);
    expect(hard.nextDue).toBeLessThanOrEqual(good.nextDue);
    expect(good.nextDue).toBeLessThan(easy.nextDue);
    expect(easy.nextDue).toBeGreaterThan(T0 + DAY);
  });

  it('连续记得后间隔递增', () => {
    let card = newCard(T0);
    let t = T0;
    const dues: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = applyRating(card, 3, t);
      card = r.card;
      t = r.nextDue;
      dues.push(r.nextDue);
    }
    expect(dues[1] - dues[0]).toBeGreaterThan(dues[0] - T0);
    expect(dues[2] - dues[1]).toBeGreaterThan(dues[1] - dues[0]);
  });

  it('复习卡评为忘记会记一次 lapse', () => {
    const base = newCard(T0, 'p1');
    const reviewCard = {
      ...base,
      state: 2 as const,
      reps: 3,
      stability: 5,
      difficulty: 5,
      scheduledDays: 5,
      learningSteps: 0,
      due: T0 + 5 * DAY,
    };
    const r = applyRating(reviewCard, 1, T0 + 5 * DAY);
    expect(r.card.lapses).toBe(1);
  });

  it('四档间隔预览均为正且递增', () => {
    const card = applyRating(newCard(T0), 3, T0).card;
    const p = previewIntervals(card, T0 + 3 * DAY);
    expect(p[1]).toBeLessThan(p[2]);
    expect(p[2]).toBeLessThan(p[3]);
    expect(p[1]).toBeGreaterThan(T0);
  });
});
