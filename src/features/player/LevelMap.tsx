import { CheckCircle2, Lock, Play, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isLevelUnlocked } from '@engine';
import type { PlayerLevelProgressRow, PublishedConfig } from '@engine';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { currentLang } from '@/i18n/config';
import { pickLocalized } from '@/utils/localize';
import { cn } from '@/utils/cn';

interface LevelMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: PublishedConfig;
  progress: PlayerLevelProgressRow[];
  totalScore: number;
  selectedLevelId: string | null;
  fallbackLang?: 'th' | 'en';
  onSelectLevel: (levelId: string) => void;
}

export function LevelMap({
  open,
  onOpenChange,
  config,
  progress,
  totalScore,
  selectedLevelId,
  fallbackLang = 'en',
  onSelectLevel,
}: LevelMapProps) {
  const { t } = useTranslation(['game', 'player']);
  const lang = currentLang();
  const completedIds = new Set(progress.filter((p) => p.status === 'COMPLETED').map((p) => p.level_id));
  const scoreByLevel = new Map(progress.map((p) => [p.level_id, p]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('player:workspace.levelMapBtn')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {config.worlds.map((world, wi) => {
            const worldLevels = config.levels.filter((l) => l.world_id === world.id);
            if (worldLevels.length === 0) return null;
            return (
              <div key={world.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold text-white"
                    style={{ backgroundColor: world.color }}
                  >
                    {wi + 1}
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {pickLocalized(world.name, lang, fallbackLang)}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {pickLocalized(world.description, lang, fallbackLang)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {worldLevels.map((lvl) => {
                    const unlocked = isLevelUnlocked(lvl, config.levels, {
                      completedLevelIds: completedIds,
                      totalScore,
                    });
                    const prog = scoreByLevel.get(lvl.id);
                    const done = prog?.status === 'COMPLETED';
                    const active = lvl.id === selectedLevelId;

                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          onSelectLevel(lvl.id);
                          onOpenChange(false);
                        }}
                        className={cn(
                          'flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition-all',
                          unlocked
                            ? 'cursor-pointer hover:shadow-md'
                            : 'cursor-not-allowed bg-slate-50 opacity-65',
                          active
                            ? 'border-indigo-600 bg-indigo-50/50'
                            : done
                              ? 'border-emerald-200 bg-emerald-50/40'
                              : 'border-slate-200 bg-white',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {t('game:level', { n: lvl.position })}
                            </span>
                            <p className="mt-0.5 font-bold text-slate-900">
                              {pickLocalized(lvl.title, lang, fallbackLang, lvl.code)}
                            </p>
                          </div>
                          {done ? (
                            <Badge variant="success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {prog.score}
                            </Badge>
                          ) : unlocked ? (
                            <Badge variant="default">
                              <Play className="h-3 w-3" />
                              {t('game:status.unlocked')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Lock className="h-3 w-3" />
                              {t('game:status.locked')}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${s < lvl.difficulty ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
