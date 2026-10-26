import { describe, it, expect } from 'vitest';
import { getPetGreeting, getRandomPokeQuote } from './petQuotes';

describe('桌宠伴学台词库 (petQuotes)', () => {
  it('当今日待复习全部清空且有复习量时，优先触发撒花庆祝与祝贺台词', () => {
    const greeting = getPetGreeting({ dueCount: 0, reviewedToday: 15 });
    expect(greeting.pose).toBe('celebrate');
    expect(greeting.text).toContain('今日复习目标已全部拿下');
  });

  it('当剩余待复习题量大于等于10道时，触发冲刺姿态与备战台词', () => {
    const greeting = getPetGreeting({ dueCount: 18, reviewedToday: 2 });
    expect(greeting.pose).toBe('sprint');
    expect(greeting.text).toContain('18 道错题在排队');
  });

  it('当剩余待复习题目在1-3道时，触发点赞姿态与冲刺完成台词', () => {
    const greeting = getPetGreeting({ dueCount: 2, reviewedToday: 10 });
    expect(greeting.pose).toBe('thumbsup');
    expect(greeting.text).toContain('只剩最后 2 道题啦');
  });

  it('在清晨5点-8点无特定题量时，触发早安问候', () => {
    const morningDate = new Date(2026, 9, 27, 7, 0, 0);
    const greeting = getPetGreeting({ now: morningDate });
    expect(greeting.pose).toBe('leek');
    expect(greeting.text).toMatch(/早|晨|新的一天/);
  });

  it('在深夜23点以后无特定题量时，触发晚安关怀', () => {
    const nightDate = new Date(2026, 9, 27, 23, 30, 0);
    const greeting = getPetGreeting({ now: nightDate });
    expect(greeting.pose).toBe('thinking');
    expect(greeting.text).toMatch(/深|睡|夜/);
  });

  it('戳一戳随机台词每次返回有效台词与动作', () => {
    const poke1 = getRandomPokeQuote();
    expect(poke1.text).toBeTruthy();
    expect(['leek', 'sprint', 'sparkle', 'celebrate', 'thinking', 'thumbsup']).toContain(
      poke1.pose
    );

    const poke2 = getRandomPokeQuote(poke1.text);
    expect(poke2.text).toBeTruthy();
  });
});
