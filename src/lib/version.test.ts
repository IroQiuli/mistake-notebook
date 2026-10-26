import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  forceReloadAndClearCache,
  backupExistingWallpapers,
  PERMANENT_MEDIA_CACHE,
  APP_VERSION,
} from './version';

describe('PWA 版本与智能缓存升级 (version)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('应用版本号应为最新初音未来版', () => {
    expect(APP_VERSION).toContain('初音未来版');
    expect(PERMANENT_MEDIA_CACHE).toBe('miku-wallpaper-cache-v1');
  });

  it('backupExistingWallpapers 能够筛选并将壁纸大文件备份至永久媒体缓存', async () => {
    const mockPut = vi.fn();
    const mockMatch = vi.fn().mockResolvedValue(new Response('fake-wallpaper-bytes'));

    const fakeCache = {
      keys: vi.fn().mockResolvedValue([
        new Request('https://example.com/themes/miku/miku-starry-4k.jpg'),
        new Request('https://example.com/assets/index.js'), // 不属于壁纸
      ]),
      match: mockMatch,
      put: mockPut,
    };

    const permanentCache = {
      put: mockPut,
    };

    const mockOpen = vi.fn().mockImplementation((name: string) => {
      if (name === PERMANENT_MEDIA_CACHE) return Promise.resolve(permanentCache);
      return Promise.resolve(fakeCache);
    });

    // 挂载全局 caches mock
    (globalThis as any).caches = {
      open: mockOpen,
      keys: vi.fn().mockResolvedValue(['workbox-precache-old', PERMANENT_MEDIA_CACHE]),
      delete: vi.fn().mockResolvedValue(true),
    };

    await backupExistingWallpapers();

    // 应该只把包含 /themes/ 的壁纸放入永久缓存，而忽略 js 文件
    expect(mockOpen).toHaveBeenCalledWith(PERMANENT_MEDIA_CACHE);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('forceReloadAndClearCache 执行时保护永久壁纸缓存不被删除', async () => {
    const mockDelete = vi.fn().mockResolvedValue(true);

    (globalThis as any).caches = {
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([]),
        put: vi.fn(),
      }),
      keys: vi.fn().mockResolvedValue([
        'workbox-precache-v2',
        PERMANENT_MEDIA_CACHE,
        'miku-wallpaper-cache-v1',
      ]),
      delete: mockDelete,
    };

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    await forceReloadAndClearCache();

    // 验证：workbox-precache-v2 被清理，但包含 miku-wallpaper 的永久媒体缓存被严格跳过保护
    expect(mockDelete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(mockDelete).not.toHaveBeenCalledWith(PERMANENT_MEDIA_CACHE);
    expect(mockDelete).not.toHaveBeenCalledWith('miku-wallpaper-cache-v1');
    expect(reloadMock).toHaveBeenCalled();
  });
});
