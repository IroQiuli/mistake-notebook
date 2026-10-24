import { healCards } from '../domain/heal';

export const APP_VERSION = 'v0.8.2 · 初音未来版';
export const APP_BUILD_TIME = '2026-10-25 08:00';

/**
 * 彻底注销所有 Service Worker、清空 CacheStorage，并强制从网络获取最新代码刷新
 */
export async function forceReloadAndClearCache(): Promise<void> {
  try {
    // 先自动修复一次卡片数据库中的异常过去到期排期
    await healCards();

    // 1. 注销所有激活中的 Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }

    // 2. 清除所有 PWA 离线缓存资源
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (err) {
    console.error('Failed to clear PWA cache:', err);
  } finally {
    // 3. 追加防缓存时间戳并强制重新加载
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  }
}
