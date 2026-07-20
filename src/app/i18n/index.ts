import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { setPreferredLanguage as setNativePreferredLanguage } from '../bridge/nativeBridge';
import {
  detectBrowserLang,
  isRtlLang,
  normalizeLang,
  type SupportedLang,
} from './languages';

import enCommon from './locales/en/common.json';
import enShell from './locales/en/shell.json';
import enAuth from './locales/en/auth.json';
import enAi from './locales/en/ai.json';

import sqCommon from './locales/sq/common.json';
import sqShell from './locales/sq/shell.json';
import sqAuth from './locales/sq/auth.json';
import sqAi from './locales/sq/ai.json';

import ukCommon from './locales/uk/common.json';
import ukShell from './locales/uk/shell.json';
import ukAuth from './locales/uk/auth.json';
import ukAi from './locales/uk/ai.json';

import ruCommon from './locales/ru/common.json';
import ruShell from './locales/ru/shell.json';
import ruAuth from './locales/ru/auth.json';
import ruAi from './locales/ru/ai.json';

import zhCommon from './locales/zh/common.json';
import zhShell from './locales/zh/shell.json';
import zhAuth from './locales/zh/auth.json';
import zhAi from './locales/zh/ai.json';

import esCommon from './locales/es/common.json';
import esShell from './locales/es/shell.json';
import esAuth from './locales/es/auth.json';
import esAi from './locales/es/ai.json';

import plCommon from './locales/pl/common.json';
import plShell from './locales/pl/shell.json';
import plAuth from './locales/pl/auth.json';
import plAi from './locales/pl/ai.json';

import faCommon from './locales/fa/common.json';
import faShell from './locales/fa/shell.json';
import faAuth from './locales/fa/auth.json';
import faAi from './locales/fa/ai.json';

const resources = {
  en: { common: enCommon, shell: enShell, auth: enAuth, ai: enAi },
  sq: { common: sqCommon, shell: sqShell, auth: sqAuth, ai: sqAi },
  uk: { common: ukCommon, shell: ukShell, auth: ukAuth, ai: ukAi },
  ru: { common: ruCommon, shell: ruShell, auth: ruAuth, ai: ruAi },
  zh: { common: zhCommon, shell: zhShell, auth: zhAuth, ai: zhAi },
  es: { common: esCommon, shell: esShell, auth: esAuth, ai: esAi },
  pl: { common: plCommon, shell: plShell, auth: plAuth, ai: plAi },
  fa: { common: faCommon, shell: faShell, auth: faAuth, ai: faAi },
} as const;

function readStoredLang(): SupportedLang | null {
  try {
    const stored = localStorage.getItem('tradepro.preferredLanguage');
    if (stored) return normalizeLang(stored);
  } catch {
    /* ignore */
  }
  return null;
}

export function applyDocumentLanguage(_lang: string): void {
  // Preferred language drives AI chat / phone speech only.
  // App chrome stays English LTR — flipping dir=rtl (ar/fa) makes phone fields type backwards.
  if (typeof document === 'undefined') return;
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
}

export async function changeAppLanguage(lang: string): Promise<void> {
  const code = normalizeLang(lang);
  await i18n.changeLanguage(code);
  applyDocumentLanguage(code);
  try {
    localStorage.setItem('tradepro.preferredLanguage', code);
  } catch {
    /* ignore */
  }
  // Keep Flutter native chrome (offline/loading/AppBar) in sync when running in the APK.
  void setNativePreferredLanguage(code);
}

const initial = readStoredLang() ?? detectBrowserLang();

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: initial,
      fallbackLng: 'en',
      supportedLngs: ['en', 'es', 'pl', 'ru', 'uk', 'zh', 'hi', 'tr', 'ar', 'ro', 'pt', 'it', 'sq', 'fa'],
      defaultNS: 'common',
      ns: ['common', 'shell', 'auth', 'ai'],
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'tradepro.preferredLanguage',
        caches: ['localStorage'],
      },
    })
    .then(() => {
      const code = normalizeLang(i18n.language);
      applyDocumentLanguage(code);
      void setNativePreferredLanguage(code);
    });
}

export default i18n;
export { normalizeLang, isRtlLang, type SupportedLang };
