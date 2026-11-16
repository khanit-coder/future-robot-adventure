import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enPlayer from './locales/en/player.json';
import enGame from './locales/en/game.json';
import enDashboard from './locales/en/dashboard.json';
import enAdmin from './locales/en/admin.json';

import thCommon from './locales/th/common.json';
import thPlayer from './locales/th/player.json';
import thGame from './locales/th/game.json';
import thDashboard from './locales/th/dashboard.json';
import thAdmin from './locales/th/admin.json';

import type { I18nOverrideRow, Lang } from '@engine';

export const STATIC_RESOURCES = {
  en: {
    common: enCommon,
    player: enPlayer,
    game: enGame,
    dashboard: enDashboard,
    admin: enAdmin,
  },
  th: {
    common: thCommon,
    player: thPlayer,
    game: thGame,
    dashboard: thDashboard,
    admin: thAdmin,
  },
} as const;

export const I18N_NAMESPACES = ['common', 'player', 'game', 'dashboard', 'admin'] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: structuredClone(STATIC_RESOURCES.en),
      th: structuredClone(STATIC_RESOURCES.th),
    },
    fallbackLng: 'en',
    supportedLngs: ['th', 'en'],
    defaultNS: 'common',
    ns: [...I18N_NAMESPACES],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'fra_lang',
    },
  });

/** Apply live Admin translation overrides on top of static bundles without resetting UI state. */
export function applyI18nOverrides(rows: I18nOverrideRow[]) {
  for (const lang of ['en', 'th'] as const) {
    for (const ns of I18N_NAMESPACES) {
      i18n.addResourceBundle(lang, ns, structuredClone(STATIC_RESOURCES[lang][ns]), false, true);
    }
  }
  for (const row of rows) {
    if (!row.value.trim()) continue;
    i18n.addResource(row.lang, row.namespace, row.key, row.value);
  }
}

export function currentLang(): Lang {
  return i18n.language?.startsWith('en') ? 'en' : 'th';
}

export default i18n;
