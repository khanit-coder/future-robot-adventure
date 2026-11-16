import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { sfx } from '@/services/audio/soundEffects';
import { cn } from '@/utils/cn';

export function SoundToggle({
  dark = false,
  className,
}: {
  dark?: boolean;
  className?: string;
}) {
  const { t } = useTranslation('common');
  const [muted, setMuted] = useState<boolean>(() => sfx.isMuted());

  useEffect(() => {
    return sfx.subscribe((isMuted) => setMuted(isMuted));
  }, []);

  const toggle = () => {
    const next = sfx.toggleMuted();
    if (!next) {
      sfx.playClick();
    }
  };

  const label = muted ? t('app.soundOff', 'เปิดเสียง') : t('app.soundOn', 'ปิดเสียง');

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      data-testid="sound-toggle-btn"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer select-none',
        dark
          ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
        className,
      )}
    >
      {muted ? (
        <VolumeX className="h-4 w-4 text-rose-400" />
      ) : (
        <Volume2 className="h-4 w-4 text-emerald-500" />
      )}
      <span className="hidden sm:inline">{muted ? 'Muted' : 'Sound'}</span>
    </button>
  );
}
