import { Maximize2, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFullscreen } from '@/hooks/useFullscreen';
import { cn } from '@/utils/cn';

export function FullscreenButton({
  dark = false,
  className,
}: {
  dark?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const label = isFullscreen ? t('app.exitFullscreen') : t('app.fullscreen');

  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      title={label}
      aria-label={label}
      data-testid="fullscreen-toggle-btn"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer select-none',
        dark
          ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
        className,
      )}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4 text-sky-400" />
      ) : (
        <Maximize2 className="h-4 w-4 text-indigo-500" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
