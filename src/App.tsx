import {
  HashRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { BarChart3, CalendarDays, History, Layers, Plus, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, getSettingSync } from './storage/db';
import { ToastProvider, useToast } from './ui/Toast';
import { cn } from './ui/cn';
import { ensureSeeded } from './storage/seed';
import TodayPage from './features/today/TodayPage';
import LibraryPage from './features/library/LibraryPage';
import SearchPage from './features/library/SearchPage';
import ChapterPage from './features/library/ChapterPage';
import ProblemPage from './features/problem/ProblemPage';
import CapturePage from './features/capture/CapturePage';
import ReviewPage from './features/review/ReviewPage';
import SettingsPage from './features/settings/SettingsPage';
import StatsPage from './features/stats/StatsPage';
import HistoryPage from './features/history/HistoryPage';
import PaperPage from './features/paper/PaperPage';

import {
  MikuCaptureIcon,
  MikuHomeIcon,
  MikuLibraryIcon,
  MikuSettingsIcon,
  MikuStatsIcon,
} from './ui/MikuIcons';
import { MikuChibiLeek } from './ui/MikuChibi';
import { resolveThemeUrl } from './lib/themeUrl';

const NAV = [
  { to: '/', label: '首页', defaultIcon: CalendarDays, mikuIcon: MikuHomeIcon },
  { to: '/library', label: '错题本', defaultIcon: Layers, mikuIcon: MikuLibraryIcon },
  { to: '/capture', label: '录入', defaultIcon: Plus, mikuIcon: MikuCaptureIcon },
  { to: '/stats', label: '统计', defaultIcon: BarChart3, mikuIcon: MikuStatsIcon },
  { to: '/settings', label: '我的', defaultIcon: Settings, mikuIcon: MikuSettingsIcon },
];

/**
 * 滚动位置记忆：前进/切换页面回顶部，后退（POP）回到离开时的位置。
 * 异步列表渲染慢时多试几次，避免内容还没撑开就恢复。
 */
function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const wantScroll = Boolean((location.state as { scroll?: boolean } | null)?.scroll);

  useEffect(() => {
    const key = `scroll:${location.pathname}${location.search}`;
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(key) ?? 0);
    } catch {
      saved = 0;
    }

    // 边滚边存：真正的离开时刻页面已经被换掉，那时读 scrollY 已经是 0
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(key, String(window.scrollY));
        } catch {
          /* 隐私模式忽略 */
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    let raf = 0;
    if ((navigationType === 'POP' || wantScroll) && saved > 0) {
      let tries = 0;
      const restore = () => {
        window.scrollTo({ top: saved });
        if (Math.abs(window.scrollY - saved) > 4 && tries < 4) {
          tries++;
          window.setTimeout(restore, 120);
        }
      };
      raf = requestAnimationFrame(restore);
    } else {
      window.scrollTo({ top: 0 });
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [location.key, location.pathname, location.search, navigationType, wantScroll]);

  return null;
}

/**
 * 独立窗口（装到主屏）冷启动时，历史栈只有一条，
 * 按系统返回会直接把 App 关掉。这里吞掉第一次返回并提示。
 */
function StandaloneBackGuard() {
  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
    if (!standalone) return;

    let armed = false;
    const onPop = () => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) return;
      if (armed) return;
      armed = true;
      window.setTimeout(() => {
        armed = false;
      }, 2000);
      window.history.pushState(window.history.state, '', window.location.href);
      window.dispatchEvent(new CustomEvent('app:exit-hint'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return null;
}

/** 独立窗口里按系统返回时给个提示 */
function ExitHint() {
  const toast = useToast();
  useEffect(() => {
    const onHint = () => toast.show('再按一次退出应用', 'info');
    window.addEventListener('app:exit-hint', onHint);
    return () => window.removeEventListener('app:exit-hint', onHint);
  }, [toast]);
  return null;
}

function Shell() {
  const location = useLocation();
  const isImmersive =
    location.pathname.startsWith('/review') || location.pathname.startsWith('/chapter');
  const theme = useLiveQuery(() => getSetting<string>('theme', 'miku'), [], getSettingSync('theme', 'miku'));
  const wallpaperSetting = useLiveQuery(
    () => getSetting<string>('wallpaper', ''),
    [],
    getSettingSync('wallpaper', '')
  );
  const wallpaperBlur = useLiveQuery(
    () => getSetting<number>('wallpaperBlur', 0),
    [],
    getSettingSync('wallpaperBlur', 0)
  );
  const wallpaperMask = useLiveQuery(
    () => getSetting<number>('wallpaperMask', 0.08),
    [],
    getSettingSync('wallpaperMask', 0.08)
  );

  const isMiku = theme === 'miku';
  // Miku 主题下若未设置壁纸，默认使用精选 4K 星空壁纸
  const activeWallpaper = isMiku
    ? (wallpaperSetting || 'themes/miku/miku-starry-4k.jpg')
    : wallpaperSetting;
  const resolvedWallpaper = resolveThemeUrl(activeWallpaper);

  useEffect(() => {
    if (isMiku) {
      document.documentElement.setAttribute('data-theme', 'miku');
      document.title = '初音未来 · 考研伴学错题簿';
      const iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (iconLink) iconLink.href = resolveThemeUrl('themes/miku/miku-icon.svg');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.title = '错题簿';
      const iconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (iconLink) iconLink.href = resolveThemeUrl('icon-192.png');
    }

    if (activeWallpaper) {
      document.documentElement.classList.add('has-wallpaper');
    } else {
      document.documentElement.classList.remove('has-wallpaper');
    }
  }, [isMiku, activeWallpaper]);

  return (
    <div className={cn('min-h-full md:flex relative transition-colors', activeWallpaper ? 'bg-transparent' : 'bg-zinc-50')}>
      {/* 4K 壁纸层与遮罩 */}
      {resolvedWallpaper && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-300"
            style={{
              backgroundImage: `url(${resolvedWallpaper})`,
              filter: wallpaperBlur > 0 ? `blur(${wallpaperBlur}px)` : undefined,
              transform: wallpaperBlur > 0 ? 'scale(1.04) translateZ(0)' : 'translateZ(0)',
              WebkitTransform: wallpaperBlur > 0 ? 'scale(1.04) translateZ(0)' : 'translateZ(0)',
            }}
          />
          {wallpaperMask > 0 && (
            <div
              className="absolute inset-0 bg-black transition-opacity duration-300"
              style={{ opacity: wallpaperMask }}
            />
          )}
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-5 md:flex relative z-10 transition-colors">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          {isMiku ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl miku-neon-badge text-xs font-black text-white tracking-tight shadow-sm shrink-0">
              01
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white shrink-0">
              错
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold leading-tight text-zinc-900 truncate">
                {isMiku ? '初音未来 · 错题簿' : '错题簿'}
              </span>
              {isMiku && (
                <span className="rounded-full bg-pink-100 px-1.5 py-0.2 text-[9px] font-black text-[#ff5e97] ring-1 ring-[#ff5e97]/30 shrink-0">
                  39
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {isMiku ? 'Hatsune Miku 考研伴学' : '考研 · 间隔复习'}
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = isMiku ? item.mikuIcon : item.defaultIcon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? isMiku
                        ? 'bg-teal-50 text-teal-600 font-semibold shadow-xs ring-1 ring-teal-200/40'
                        : 'bg-orange-50 text-orange-600'
                      : 'text-zinc-600 hover:bg-zinc-100/70'
                  )
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? isMiku
                    ? 'bg-teal-50 text-teal-600 font-semibold shadow-xs ring-1 ring-teal-200/40'
                    : 'bg-orange-50 text-orange-600'
                  : 'text-zinc-600 hover:bg-zinc-100/70'
              )
            }
          >
            <History size={18} className={isMiku ? 'text-teal-500' : 'text-orange-500'} />
            做题足迹
          </NavLink>
        </nav>
        <div className="mt-auto px-3 text-[11px] leading-relaxed text-zinc-400">
          {isMiku ? (
            <div className="flex items-center gap-2">
              <MikuChibiLeek size={28} className="shrink-0" />
              <div>
                <span className="text-teal-600/90 font-medium">🎵 与 Miku 一起备战</span>
                <br />
                数据保存在本机浏览器
              </div>
            </div>
          ) : (
            <>
              数据保存在本机浏览器
              <br />
              记得定期导出备份
            </>
          )}
        </div>
      </aside>

      <main className="min-h-screen w-full pb-20 md:pb-0 relative z-10">
        <div className={cn('mx-auto w-full', isImmersive ? '' : 'max-w-3xl px-4 py-4 md:px-8 md:py-8')}>
          <Outlet />
        </div>
      </main>

      {!isImmersive && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur safe-bottom md:hidden transition-colors">
          <div
            className="mx-auto grid max-w-md"
            style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
          >
            {NAV.map((item) => {
              const Icon = isMiku ? item.mikuIcon : item.defaultIcon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-0.5 py-2 text-[11px]',
                      isActive ? (isMiku ? 'text-teal-600 font-semibold' : 'text-orange-600') : 'text-zinc-500'
                    )
                  }
                >
                  <Icon size={20} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function Boot() {
  useEffect(() => {
    ensureSeeded().catch((err) => console.error('初始化分类失败', err));
  }, []);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <Boot />
      <HashRouter>
        <ScrollRestoration />
        <StandaloneBackGuard />
        <ExitHint />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/chapter/:id" element={<ChapterPage />} />
            <Route path="/problem/:id" element={<ProblemPage />} />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/paper" element={<PaperPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/review" element={<ReviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
