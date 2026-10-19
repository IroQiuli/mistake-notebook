import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';

type ToastType = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-6 md:bottom-8">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm shadow-lg',
              item.type === 'error' && 'bg-red-600 text-white',
              item.type === 'success' && 'bg-zinc-900 text-white',
              item.type === 'info' && 'bg-zinc-800/95 text-white'
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
