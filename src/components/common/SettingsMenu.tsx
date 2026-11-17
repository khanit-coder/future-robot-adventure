import { useEffect, useRef, useState } from 'react';
import { Languages, Settings, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '@engine';
import { sfx } from '@/services/audio/soundEffects';
import { playerApi } from '@/services/api/playerApi';
import { usePlayerStore } from '@/stores/playerStore';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/utils/cn';

interface SettingsMenuProps {
  dark?: boolean;
  className?: string;
}

export function SettingsMenu({ dark = false, className }: SettingsMenuProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => sfx.isMuted());
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasPlayer = usePlayerStore((s) => Boolean(s.player));
  const currentLang: Lang = i18n.language?.startsWith('en') ? 'en' : 'th';
  const isTh = currentLang === 'th';

  useEffect(() => {
    return sfx.subscribe((isMuted) => setMuted(isMuted));
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const toggleSound = () => {
    const next = sfx.toggleMuted();
    if (!next) {
      sfx.playClick();
    }
  };

  const setLang = (next: Lang) => {
    if (next === currentLang) return;
    void i18n.changeLanguage(next);
    if (hasPlayer) {
      void playerApi.setLanguage(next).catch(() => {});
    }
    sfx.playClick();
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        data-testid="settings-menu-btn"
        title={isTh ? 'การตั้งค่า (เสียงและภาษา)' : 'Settings (Audio & Language)'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
          dark
            ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
          open && (dark ? 'ring-2 ring-indigo-400 bg-slate-700' : 'ring-2 ring-indigo-500 bg-slate-100'),
          className,
        )}
      >
        <Settings className={cn('h-4 w-4 transition-transform duration-300', open && 'rotate-90 text-indigo-400')} />
        <span className="hidden sm:inline">{isTh ? 'ตั้งค่า' : 'Settings'}</span>
      </button>

      {/* Dropdown Menu Popover */}
      <div
        role="dialog"
        aria-label={isTh ? 'การตั้งค่าระบบ' : 'System Settings'}
        aria-hidden={!open}
        className={cn(
          'absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border p-4 shadow-2xl transition-all duration-150',
          dark
            ? 'border-slate-700 bg-slate-900 text-white shadow-black/50'
            : 'border-slate-200 bg-white text-slate-900 shadow-slate-300/50',
          !open && 'hidden pointer-events-none',
        )}
      >
        {/* Popover Header */}
        <div
          className={cn(
            'flex items-center justify-between pb-3 border-b',
            dark ? 'border-slate-800' : 'border-slate-200',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 font-bold">
              <Settings className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-sm font-extrabold">{isTh ? 'การตั้งค่า' : 'Settings'}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              'rounded-lg p-1 transition-colors cursor-pointer',
              dark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100',
            )}
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 pt-3">
          {/* 1. Sound Control */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                  muted
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-emerald-500/15 text-emerald-400',
                )}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">
                  {isTh ? 'เสียงประกอบเกม' : 'Sound Effects'}
                </p>
                <p className={cn('text-[11px]', dark ? 'text-slate-400' : 'text-slate-500')}>
                  {muted ? (isTh ? 'ปิดเสียงอยู่' : 'Muted') : (isTh ? 'เปิดเสียงอยู่' : 'Sound On')}
                </p>
              </div>
            </div>
            <Switch
              checked={!muted}
              onCheckedChange={toggleSound}
              data-testid="sound-toggle-btn"
              aria-label={isTh ? 'เปิดปิดเสียง' : 'Toggle sound'}
            />
          </div>

          {/* Divider */}
          <div className={cn('border-t', dark ? 'border-slate-800' : 'border-slate-200')} />

          {/* 2. Language Control */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-indigo-400" />
              <p className="text-xs font-bold leading-tight">
                {isTh ? 'ภาษาที่แสดงผล' : 'Display Language'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLang('th')}
                data-testid="lang-th"
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition-all cursor-pointer',
                  currentLang === 'th'
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : dark
                      ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                )}
              >
                <span>🇹🇭</span>
                <span>ไทย</span>
              </button>

              <button
                type="button"
                onClick={() => setLang('en')}
                data-testid="lang-en"
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold transition-all cursor-pointer',
                  currentLang === 'en'
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : dark
                      ? 'border-slate-800 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                )}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
