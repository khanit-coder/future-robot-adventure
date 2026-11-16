import { Bot, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  dark?: boolean;
  className?: string;
  showRobot?: boolean;
}

const SIZE_MAP = {
  sm: { ring: 'h-6 w-6 border-2', icon: 'h-3.5 w-3.5', text: 'text-xs' },
  md: { ring: 'h-10 w-10 border-3', icon: 'h-5 w-5', text: 'text-sm' },
  lg: { ring: 'h-16 w-16 border-4', icon: 'h-8 w-8', text: 'text-base' },
  xl: { ring: 'h-24 w-24 border-4', icon: 'h-12 w-12', text: 'text-lg' },
};

export function LoadingSpinner({
  size = 'md',
  message,
  dark = false,
  className,
  showRobot = true,
}: LoadingSpinnerProps) {
  const s = SIZE_MAP[size];

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer glowing orbital spinning ring */}
        <div
          className={cn(
            'rounded-full animate-spin border-t-indigo-500 border-r-transparent border-b-sky-400 border-l-transparent',
            dark ? 'border-slate-800' : 'border-indigo-100',
            s.ring,
          )}
          style={{ animationDuration: '0.9s' }}
        />

        {/* Counter-rotating inner ring for lg and xl */}
        {(size === 'lg' || size === 'xl') && (
          <div
            className={cn(
              'absolute rounded-full animate-spin border-t-transparent border-r-pink-500 border-b-transparent border-l-amber-400',
              size === 'xl' ? 'h-16 w-16 border-3' : 'h-11 w-11 border-2',
            )}
            style={{ animationDirection: 'reverse', animationDuration: '1.4s' }}
          />
        )}

        {/* Center robot icon */}
        {showRobot ? (
          <div
            className={cn(
              'absolute flex items-center justify-center text-indigo-500',
              dark ? 'text-sky-300' : 'text-indigo-600',
            )}
          >
            <Bot className={cn(s.icon, 'animate-pulse')} />
          </div>
        ) : (
          <Loader2 className={cn('absolute animate-spin text-indigo-500', s.icon)} />
        )}
      </div>

      {message && (
        <p
          className={cn(
            'font-bold tracking-wide animate-pulse text-center select-none',
            dark ? 'text-slate-300' : 'text-slate-600',
            s.text,
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/** Full-screen splash loading overlay/page */
export function FullPageLoading({
  message,
  dark = false,
}: {
  message?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center transition-all',
        dark
          ? 'bg-slate-950/95 text-white backdrop-blur-md'
          : 'bg-slate-50/95 text-slate-900 backdrop-blur-md',
      )}
    >
      <div className="flex flex-col items-center p-8 text-center max-w-sm">
        <LoadingSpinner size="xl" message={message || 'กำลังโหลดระบบ...'} dark={dark} />
      </div>
    </div>
  );
}
