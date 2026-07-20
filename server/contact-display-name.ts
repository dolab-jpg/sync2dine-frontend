/** Names that must never be spoken or injected as “contact name” into prompts. */
const PLACEHOLDER_NAME =
  /^(guest|unknown|unknown caller|website visitor|n\/a|null|undefined|caller|customer)$/i;

export function isSpeechSafeContactName(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim();
  if (!n) return false;
  return !PLACEHOLDER_NAME.test(n);
}

/** Empty string when unknown — Sally speaks normally (never “Guest”). */
export function speechContactName(name: string | null | undefined): string {
  return isSpeechSafeContactName(name) ? String(name).trim() : '';
}
