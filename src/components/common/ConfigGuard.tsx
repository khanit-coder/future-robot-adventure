import * as React from 'react';
import { Wrench, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { currentLang } from '@/i18n/config';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { pickLocalized } from '@/utils/localize';
import { RobotIllustration } from './RobotIllustration';
import { LanguageSwitcher } from './LanguageSwitcher';

export function ConfigGuard({
  children,
  bypassMaintenance = false,
}: {
  children: React.ReactNode;
  bypassMaintenance?: boolean;
}) {
  const { t } = useTranslation('common');
  const settings = useAppStore((s) => s.settings);
  const loaded = useAppStore((s) => s.loaded);
  const lang = currentLang();

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
            <Database className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{t('app.configMissingTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{t('app.configMissingDesc')}</p>
          <pre className="mt-5 rounded-xl bg-slate-950 p-4 text-left text-xs text-sky-300 overflow-x-auto">
            {`VITE_SUPABASE_URL=https://<project>.supabase.co\nVITE_SUPABASE_ANON_KEY=<anon-key>`}
          </pre>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <RobotIllustration state="idle" size={96} />
        <p className="text-sm font-semibold text-slate-500">{t('app.loading')}</p>
      </div>
    );
  }

  if (!bypassMaintenance && settings?.maintenance_mode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher dark />
        </div>
        <div className="max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <RobotIllustration state="wave" size={96} className="mx-auto" />
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
            <Wrench className="h-3.5 w-3.5" />
            {t('app.maintenanceTitle')}
          </div>
          <p className="mt-4 text-base text-slate-200">
            {pickLocalized(settings.maintenance_message, lang, settings.default_language)}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
