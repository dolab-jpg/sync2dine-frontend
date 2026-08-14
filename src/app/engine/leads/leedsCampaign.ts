/** Canonical campaign label for the venue lead list (never “Hindi” / scrape-date tags). */
export const LEEDS_CAMPAIGN_ID = 'Leeds';

export const DEFAULT_SALLY_BRIEF =
  'Sally from Sync2Dine: introduce the takeaway phone platform — AI answers, takes orders, and drives repeat business. If they want to sign up, research their restaurant online and confirm details before creating their account.';

/** Legacy batch/campaign/tags from earlier imports of this list. */
export function looksLikeLeedsLegacyLabel(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (/^leeds$/i.test(s)) return true;
  if (/hindi/i.test(s)) return true;
  if (/sync2dine\s*call\s*leads/i.test(s)) return true;
  if (/^scrape-\d{4}-\d{2}-\d{2}$/i.test(s)) return true;
  if (/^sales-\d{4}-\d{2}-\d{2}$/i.test(s)) return true;
  return false;
}

export function customerMatchesLeedsBatch(c: {
  leadBatchId?: string;
  campaign?: string;
  tags?: string[];
}): boolean {
  const batch = String(c.leadBatchId ?? '').trim();
  const campaign = String(c.campaign ?? '').trim();
  if (batch === LEEDS_CAMPAIGN_ID || campaign === LEEDS_CAMPAIGN_ID) return true;
  if (looksLikeLeedsLegacyLabel(batch) || looksLikeLeedsLegacyLabel(campaign)) return true;
  const tags = Array.isArray(c.tags) ? c.tags.map(String) : [];
  return tags.some((t) => t === LEEDS_CAMPAIGN_ID || looksLikeLeedsLegacyLabel(t));
}

/** Patch fields to rename Hindi / scrape-date labels ? Leeds. Returns null if no change. */
export function leedsRemapPatch(c: {
  leadBatchId?: string;
  campaign?: string;
  tags?: string[];
}): { leadBatchId: string; campaign: string; tags: string[] } | null {
  const tags = Array.isArray(c.tags) ? c.tags.map(String) : [];
  const batchLegacy = looksLikeLeedsLegacyLabel(c.leadBatchId);
  const campaignLegacy = looksLikeLeedsLegacyLabel(c.campaign);
  const tagLegacy = tags.some(looksLikeLeedsLegacyLabel);
  if (!batchLegacy && !campaignLegacy && !tagLegacy) return null;

  return {
    leadBatchId: batchLegacy ? LEEDS_CAMPAIGN_ID : String(c.leadBatchId ?? LEEDS_CAMPAIGN_ID),
    campaign: campaignLegacy ? LEEDS_CAMPAIGN_ID : String(c.campaign ?? LEEDS_CAMPAIGN_ID),
    tags: [...new Set([...tags.filter((t) => !looksLikeLeedsLegacyLabel(t)), LEEDS_CAMPAIGN_ID])],
  };
}
