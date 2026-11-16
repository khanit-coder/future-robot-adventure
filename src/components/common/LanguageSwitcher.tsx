import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@engine';
import { playerApi } from '@/services/api/playerApi';
import { usePlayerStore } from '@/stores/playerStore';
import { cn } from '@/utils/cn';

interface LanguageSwitcherProps {
  className?: string;
  dark?: boolean;
}

/**
 * Switches Thai / English seamlessly in-place without reloading the page
 * or disrupting Blockly workspaces, timers, scores, or Phaser animations.
 */
export function LanguageSwitcher({ className, dark = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const hasPlayer = usePlayerStore((s) => Boolean(s.player));
  const current: Lang = i18n.language?.startsWith('en') ? 'en' : 'th';

  const setLang = (next: Lang) => {
    if (next === current) return;
    void i18n.changeLanguage(next);
    if (hasPlayer) {
      void playerApi.setLanguage(next).catch(() => {});
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border p-1',
        dark ? 'border-slate-700 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-white text-slate-700',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <Languages className={cn('ml-1.5 h-4 w-4', dark ? 'text-slate-400' : 'text-slate-400')} />
      {(['th', 'en'] as const).map((code) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            data-testid={`lang-${code}`}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer',
              active
                ? 'bg-indigo-600 text-white shadow-xs'
                : dark
                  ? 'text-slate-300 hover:bg-slate-700'
                  : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {code === 'th' ? 'ไทย' : 'EN'}
          </button>
        );
      })}
    </div>
  );
}
