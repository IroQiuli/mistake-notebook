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
import { BarChart3, CalendarDays, Layers, Plus, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from './storage/db';
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
import PaperPage from './features/paper/PaperPage';

const NAV = [
  { to: '/', label: '首页', icon: CalendarDays },
  { to: '/library', label: '错题本', icon: Layers },
  { to: '/capture', label: '录入', icon: Plus },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '我的', icon: Settings },
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
  const wallpaper = useLiveQuery(() => getSetting<string>('wallpaper', ''), [], '');

  return (
    <div
      className="min-h-full bg-zinc-50 md:flex"
      style={
        wallpaper
          ? {
              backgroundImage: `url(${wallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }
          : undefined
      }
    >
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm font-bold text-white">
            错
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-zinc-900">错题簿</div>
            <div className="text-[11px] text-zinc-400">考研 · 间隔复习</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-orange-50 text-orange-600'
                    : 'text-zinc-600 hover:bg-zinc-100'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-3 text-[11px] leading-relaxed text-zinc-400">
          数据保存在本机浏览器
          <br />
          记得定期导出备份
        </div>
      </aside>

      <main className="min-h-screen w-full pb-20 md:pb-0">
        <div className={cn('mx-auto w-full', isImmersive ? '' : 'max-w-3xl px-4 py-4 md:px-8 md:py-8')}>
          <Outlet />
        </div>
      </main>

      {!isImmersive && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur safe-bottom md:hidden">
          <div
            className="mx-auto grid max-w-md"
            style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
          >
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-2 text-[11px]',
                    isActive ? 'text-orange-600' : 'text-zinc-500'
                  )
                }
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
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
