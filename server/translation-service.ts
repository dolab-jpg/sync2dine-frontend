/**
 * Channel language helpers backed by saved language packs.
 * No live OpenAI detect/translate — replies use packs + preferredLanguage.
 */
import {
  getPack,
  getPhrase,
  getSystemInstruction,
  normalizeLang,
  type SupportedLang,
} from './language-packs';

export { getPack, getPhrase, getSystemInstruction, normalizeLang };
export type { SupportedLang };

const SCRIPT_HINTS: Array<{ lang: SupportedLang; test: (t: string) => boolean }> = [
  { lang: 'zh', test: (t) => /[\u4e00-\u9fff]/.test(t) },
  { lang: 'fa', test: (t) => /[\u0600-\u06ff]/.test(t) },
  { lang: 'uk', test: (t) => /[їєґІЇЄҐ]/.test(t) || /[а-яА-ЯіІїЇєЄґҐ]{4,}/.test(t) },
];

/** Cheap script heuristic only — never calls OpenAI. */
export async function detectLanguage(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return 'en';
  for (const hint of SCRIPT_HINTS) {
    if (hint.test(trimmed)) return hint.lang;
  }
  return 'en';
}

/** Pass-through: packs replace live translation. */
export async function translateToEnglish(text: string, _fromLang?: string): Promise<string> {
  return text.trim();
}

/** Prefer saved phrase keys; otherwise return text unchanged (orchestrator already localized). */
export async function translateFromEnglish(text: string, toLang: string): Promise<string> {
  const lang = normalizeLang(toLang);
  const trimmed = text.trim();
  if (!trimmed || lang === 'en') return trimmed;
  // Map a few known English stock lines to pack phrases
  const lower = trimmed.toLowerCase();
  if (lower === 'done.' || lower === 'done') return getPhrase(lang, 'done');
  if (lower.includes('reply yes to confirm')) return getPhrase(lang, 'confirm_yes_no');
  return trimmed;
}

/**
 * Inbound: use preferredLanguage when set; otherwise heuristic only.
 * Text is passed through unchanged (no OpenAI translate).
 */
export async function normalizeInboundText(
  text: string,
  preferredLanguage?: string | null
): Promise<{ english: string; detectedLanguage: string; original: string }> {
  const detected = preferredLanguage
    ? normalizeLang(preferredLanguage)
    : await detectLanguage(text);
  return { english: text, detectedLanguage: detected, original: text };
}

/**
 * Outbound: no OpenAI localize. Orchestrator already replied in target language.
 * Stock English confirm/done lines are swapped for pack phrases when language ≠ en.
 */
export async function localizeOutboundText(
  englishText: string,
  targetLanguage?: string | null
): Promise<string> {
  const lang = normalizeLang(targetLanguage);
  if (lang === 'en') return englishText;
  return translateFromEnglish(englishText, lang);
}
