import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { CalendarDays, Layers, PenLine, Plus, Settings } from 'lucide-react';
import { useEffect } from 'react';
import { ToastProvider } from './ui/Toast';
import { cn } from './ui/cn';
import { ensureSeeded } from './storage/seed';
import TodayPage from './features/today/TodayPage';
import LibraryPage from './features/library/LibraryPage';
import ProblemPage from './features/problem/ProblemPage';
import CapturePage from './features/capture/CapturePage';
import ReviewPage from './features/review/ReviewPage';
import ScratchPage from './features/scratch/ScratchPage';
import SettingsPage from './features/settings/SettingsPage';

const NAV = [
  { to: '/', label: '今日', icon: CalendarDays },
  { to: '/library', label: '错题本', icon: Layers },
  { to: '/scratch', label: '草稿', icon: PenLine },
  { to: '/capture', label: '录入', icon: Plus },
  { to: '/settings', label: '我的', icon: Settings },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function Shell() {
  const location = useLocation();
  const isImmersive = location.pathname.startsWith('/review');

  return (
    <div className="min-h-full bg-zinc-50 md:flex">
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
        <ScrollToTop />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/problem/:id" element={<ProblemPage />} />
            <Route path="/capture" element={<CapturePage />} />
            <Route path="/scratch" element={<ScratchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/review" element={<ReviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
