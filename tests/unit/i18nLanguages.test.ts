import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SUPPORTED_LANGS,
  LANG_OPTIONS,
  normalizeLang,
  isRtlLang,
  detectBrowserLang,
} from '../../src/app/i18n/languages';

describe('i18n languages helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizeLang allowlists ru and falls back to en', () => {
    expect(SUPPORTED_LANGS).toContain('ru');
    expect(normalizeLang('ru')).toBe('ru');
    expect(normalizeLang('ru-RU')).toBe('ru');
    expect(normalizeLang('uk-UA')).toBe('uk');
    expect(normalizeLang('xx')).toBe('en');
    expect(normalizeLang(undefined)).toBe('en');
  });

  it('isRtlLang for Farsi and Arabic', () => {
    expect(isRtlLang('fa')).toBe(true);
    expect(isRtlLang('fa-IR')).toBe(true);
    expect(isRtlLang('ar')).toBe(true);
    expect(isRtlLang('en')).toBe(false);
    expect(isRtlLang('ru')).toBe(false);
  });

  it('detectBrowserLang picks first supported preference', () => {
    vi.stubGlobal('navigator', {
      language: 'en-GB',
      languages: ['pl-PL', 'en-GB'],
    });
    expect(detectBrowserLang()).toBe('pl');
  });

  it('detectBrowserLang falls back to en when none match', () => {
    vi.stubGlobal('navigator', {
      language: 'de-DE',
      languages: ['de-DE', 'fr-FR'],
    });
    expect(detectBrowserLang()).toBe('en');
  });

  it('LANG_OPTIONS keys match SUPPORTED_LANGS', () => {
    const optionCodes = LANG_OPTIONS.map((o) => o.code).sort();
    expect(optionCodes).toEqual([...SUPPORTED_LANGS].sort());
  });
});
