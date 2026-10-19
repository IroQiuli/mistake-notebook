import { describe, it, expect } from 'vitest';
import { learningDayStart, learningDayEnd, dayKey, formatDue } from './time';

const at = (s: string) => new Date(s).getTime();

describe('学习日边界（04:00）', () => {
  it('凌晨 2 点属于前一天', () => {
    expect(dayKey(at('2026-10-20T02:00:00'))).toBe('2026-10-19');
  });

  it('早上 5 点属于当天', () => {
    expect(dayKey(at('2026-10-20T05:00:00'))).toBe('2026-10-20');
  });

  it('学习日结束时间等于开始 + 24h', () => {
    const t = at('2026-10-19T14:00:00');
    expect(learningDayEnd(t) - learningDayStart(t)).toBe(24 * 3600 * 1000);
  });

  it('learningDayEnd 覆盖当天 23:59', () => {
    const t = at('2026-10-19T14:00:00');
    expect(at('2026-10-19T23:59:00')).toBeLessThan(learningDayEnd(t));
  });
});

describe('formatDue', () => {
  it('今天到期显示「今天」', () => {
    expect(formatDue(at('2026-10-19T10:00:00'), at('2026-10-19T14:00:00'))).toBe('今天');
  });

  it('逾期 3 天显示「逾期 3 天」', () => {
    expect(formatDue(at('2026-10-16T10:00:00'), at('2026-10-19T14:00:00'))).toBe('逾期 3 天');
  });

  it('3 天后显示「3 天后」', () => {
    expect(formatDue(at('2026-10-22T10:00:00'), at('2026-10-19T14:00:00'))).toBe('3 天后');
  });
});
