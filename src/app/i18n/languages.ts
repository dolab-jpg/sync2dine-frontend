/** Supported AI chat / phone spoken languages. App UI stays English; customer docs stay English. */
export const SUPPORTED_LANGS = [
  'en',
  'es',
  'pl',
  'ru',
  'uk',
  'zh',
  'hi',
  'tr',
  'ar',
  'ro',
  'pt',
  'it',
  'sq',
  'fa',
] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** Country flag emoji for language pickers / website parity. */
export const LANG_FLAGS: Record<SupportedLang, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
  pl: '🇵🇱',
  ru: '🇷🇺',
  uk: '🇺🇦',
  zh: '🇨🇳',
  hi: '🇮🇳',
  tr: '🇹🇷',
  ar: '🇸🇦',
  ro: '🇷🇴',
  pt: '🇵🇹',
  it: '🇮🇹',
  sq: '🇦🇱',
  fa: '🇮🇷',
};

/** Spoken persona when Judie switches language mid-call. */
export const LANG_PERSONAS: Record<SupportedLang, string> = {
  en: 'Judie',
  es: 'Lucía',
  pl: 'Ania',
  ru: 'Nastya',
  uk: 'Oksana',
  zh: 'Xiao Mei',
  hi: 'Priya',
  tr: 'Elif',
  ar: 'Layla',
  ro: 'Andreea',
  pt: 'Sofia',
  it: 'Giulia',
  sq: 'Elira',
  fa: 'Elham',
};

export const LANG_OPTIONS: Array<{
  code: SupportedLang;
  label: string;
  flag: string;
  persona: string;
}> = [
  { code: 'en', label: 'English', flag: LANG_FLAGS.en, persona: LANG_PERSONAS.en },
  { code: 'es', label: 'Spanish', flag: LANG_FLAGS.es, persona: LANG_PERSONAS.es },
  { code: 'pl', label: 'Polish', flag: LANG_FLAGS.pl, persona: LANG_PERSONAS.pl },
  { code: 'ru', label: 'Russian', flag: LANG_FLAGS.ru, persona: LANG_PERSONAS.ru },
  { code: 'uk', label: 'Ukrainian', flag: LANG_FLAGS.uk, persona: LANG_PERSONAS.uk },
  { code: 'zh', label: 'Chinese', flag: LANG_FLAGS.zh, persona: LANG_PERSONAS.zh },
  { code: 'hi', label: 'Hindi', flag: LANG_FLAGS.hi, persona: LANG_PERSONAS.hi },
  { code: 'tr', label: 'Turkish', flag: LANG_FLAGS.tr, persona: LANG_PERSONAS.tr },
  { code: 'ar', label: 'Arabic', flag: LANG_FLAGS.ar, persona: LANG_PERSONAS.ar },
  { code: 'ro', label: 'Romanian', flag: LANG_FLAGS.ro, persona: LANG_PERSONAS.ro },
  { code: 'pt', label: 'Portuguese', flag: LANG_FLAGS.pt, persona: LANG_PERSONAS.pt },
  { code: 'it', label: 'Italian', flag: LANG_FLAGS.it, persona: LANG_PERSONAS.it },
  { code: 'sq', label: 'Albanian', flag: LANG_FLAGS.sq, persona: LANG_PERSONAS.sq },
  { code: 'fa', label: 'Farsi / Persian', flag: LANG_FLAGS.fa, persona: LANG_PERSONAS.fa },
];

export function normalizeLang(code: string | null | undefined): SupportedLang {
  const c = (code ?? 'en').toLowerCase().split('-')[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(c) ? (c as SupportedLang) : 'en';
}

export function isRtlLang(lang?: string | null): boolean {
  const n = normalizeLang(lang);
  return n === 'fa' || n === 'ar';
}

export function detectBrowserLang(): SupportedLang {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean);
  for (const raw of candidates) {
    const base = String(raw).toLowerCase().split('-')[0];
    if ((SUPPORTED_LANGS as readonly string[]).includes(base)) {
      return base as SupportedLang;
    }
  }
  return 'en';
}

export function langOptionLabel(code: SupportedLang | string): string {
  const normalized = normalizeLang(code);
  const opt = LANG_OPTIONS.find((o) => o.code === normalized);
  if (!opt) return normalized;
  return `${opt.flag} ${opt.label}`;
}
