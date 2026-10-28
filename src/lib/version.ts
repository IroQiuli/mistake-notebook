import { healCards } from '../domain/heal';

export const APP_VERSION = 'v0.8.7 · 初音未来版 (纯净透明与动态悬吊)';
export const APP_BUILD_TIME = '2026-10-28 23:25';
export const PERMANENT_MEDIA_CACHE = 'miku-wallpaper-cache-v1';

/**
 * 备份现有缓存中的全部壁纸大图至永久媒体缓存，防止被清理
 */
export async function backupExistingWallpapers(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const targetCache = await caches.open(PERMANENT_MEDIA_CACHE);
    const keys = await caches.keys();
    for (const key of keys) {
      if (key === PERMANENT_MEDIA_CACHE) continue;
      const c = await caches.open(key);
      const requests = await c.keys();
      for (const req of requests) {
        const url = req.url.toLowerCase();
        // 匹配 4K 壁纸、初音立绘、图片与字体
        if (
          url.includes('/themes/') ||
          url.includes('miku-') ||
          url.endsWith('.jpg') ||
          url.endsWith('.jpeg') ||
          url.endsWith('.webp') ||
          url.endsWith('.png') ||
          url.endsWith('.woff2')
        ) {
          const res = await c.match(req);
          if (res && res.ok) {
            await targetCache.put(req, res.clone());
          }
        }
      }
    }
  } catch (err) {
    console.warn('Backup wallpapers error:', err);
  }
}

/**
 * 智能刷新升级：
 * 1. 自动执行卡片排期自愈
 * 2. 备份并锁定所有 4K 壁纸与图片媒体资产至永久缓存 (miku-wallpaper-cache-v1)
 * 3. 检查并请求 Service Worker 最新版本
 * 4. 仅安全清理旧版本 JS / CSS / HTML 缓存，绝对保留壁纸大文件
 * 5. 平滑重载应用，实现“秒级更新代码，0秒加载壁纸”
 */
export async function forceReloadAndClearCache(): Promise<void> {
  try {
    // 1. 自动修复卡片排期
    await healCards();

    // 2. 保护并锁定所有 4K 壁纸与图片媒体资产
    await backupExistingWallpapers();

    // 3. 触发 Service Worker 检查更新与激活
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    }

    // 4. 清理旧代码缓存（如旧版中的 js/css/html），绝对保留 PERMANENT_MEDIA_CACHE
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        // 关键防护：绝不删除壁纸媒体缓存！
        if (key.includes('miku-wallpaper') || key.includes('media') || key === PERMANENT_MEDIA_CACHE) {
          continue;
        }
        await caches.delete(key).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Failed to update PWA:', err);
  } finally {
    // 5. 平滑重载（不加时间戳参数，避免污染 URL 并允许复用壁纸缓存）
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }
}
