import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-orange-500 text-white shadow-sm active:bg-orange-600 disabled:bg-orange-300',
  secondary:
    'bg-white text-zinc-800 border border-zinc-200 shadow-sm active:bg-zinc-50 disabled:text-zinc-400',
  ghost: 'text-zinc-600 active:bg-zinc-100 disabled:text-zinc-300',
  danger: 'bg-red-500 text-white shadow-sm active:bg-red-600 disabled:bg-red-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
  xl: 'h-14 px-6 text-lg rounded-2xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
