/** Supported worker/admin UI languages. Customer docs stay English. */
export const SUPPORTED_LANGS = ['en', 'sq', 'uk', 'ru', 'zh', 'es', 'pl', 'fa'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_OPTIONS: Array<{ code: SupportedLang; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'sq', label: 'Albanian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'es', label: 'Spanish' },
  { code: 'pl', label: 'Polish' },
  { code: 'fa', label: 'Farsi / Persian' },
];

export function normalizeLang(code: string | null | undefined): SupportedLang {
  const c = (code ?? 'en').toLowerCase().split('-')[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(c) ? (c as SupportedLang) : 'en';
}

export function isRtlLang(lang?: string | null): boolean {
  return normalizeLang(lang) === 'fa';
}

export function detectBrowserLang(): SupportedLang {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean);
  for (const raw of candidates) {
    const code = normalizeLang(raw);
    if (code !== 'en' || String(raw).toLowerCase().startsWith('en')) {
      // Prefer exact supported match from browser preference list
      const base = String(raw).toLowerCase().split('-')[0];
      if ((SUPPORTED_LANGS as readonly string[]).includes(base)) {
        return base as SupportedLang;
      }
    }
  }
  return 'en';
}
