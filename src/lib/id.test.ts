import { describe, it, expect } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('生成 UUID v4 格式', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('每次都不一样', () => {
    const set = new Set(Array.from({ length: 200 }, () => newId()));
    expect(set.size).toBe(200);
  });

  it('crypto.randomUUID 不可用时（局域网 http）也能工作', () => {
    const original = globalThis.crypto;
    const fake = { getRandomValues: original.getRandomValues.bind(original) };
    Object.defineProperty(globalThis, 'crypto', { value: fake, configurable: true });
    try {
      const id = newId();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });

  it('连 getRandomValues 都没有时退化为 Math.random', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});
