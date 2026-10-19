import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// jsdom 只实现了 crypto.getRandomValues，没有 SubtleCrypto；用 Node 的实现补上，
// 这样加密备份的逻辑可以在单元测试里跑真实算法。
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
