/**
 * Combined usage overage for Stripe invoice items.
 * Token overage: tracked costUsd × FX × markup → GBP.
 * AI talk minutes: Vapi duration vs plan includedAiMinutes.
 * Outbound phone: existing phone-billing summary.
 */
import {
  PLAN_CONFIG,
  TOKEN_OVERAGE_FX,
  TOKEN_OVERAGE_MARKUP,
  getOrganizationById,
  type OrgPlan,
} from './organizations';
import {
  getProviderQuantityThisMonth,
  getTokenCostUsdThisMonth,
  getTokensUsedThisMonth,
  recordProviderUsage,
  normalizeUsageOrgId,
  currentBillingWeekKey,
} from './usage';
import { getPhoneUsageSummary } from './phone-billing';

function roundGbp(n: number): number {
  return Math.round(n * 100) / 100;
}

function toPence(gbp: number): number {
  return Math.max(0, Math.round(gbp * 100));
}

export type OverageLineType = 'ai_talk' | 'tokens' | 'phone_outbound';

export type UsageOverageLine = {
  type: OverageLineType;
  description: string;
  amountGbp: number;
  amountPence: number;
  detail: Record<string, unknown>;
};

export type UsageOverageSummary = {
  orgId: string;
  plan: OrgPlan;
  periodMonth: string;
  lines: UsageOverageLine[];
  totalOverageGbp: number;
  tokenWarning: string | null;
  aiMinutesUsed: number;
  aiMinutesIncluded: number;
  tokensUsed: number;
  tokenCap: number;
  phone: ReturnType<typeof getPhoneUsageSummary>;
};

export function recordAiCallMinutes(input: {
  orgId: string;
  durationSeconds: number;
  callId?: string;
  direction?: string;
}): void {
  const sec = Math.max(0, Math.floor(Number(input.durationSeconds) || 0));
  if (sec <= 0) return;
  recordProviderUsage({
    orgId: input.orgId,
    provider: 'ai_minutes',
    unit: 'seconds',
    quantity: sec,
    endpoint: 'vapi.ai_talk',
    model: input.direction || 'call',
    metadata: {
      callId: input.callId,
      direction: input.direction,
    },
  });
  // Fire-and-forget threshold check (email + call if newly crossed)
  void import('./usage-alerts')
    .then(({ evaluateAndNotifyOrg }) => evaluateAndNotifyOrg(input.orgId))
    .catch(() => {});
}

export function getAiTalkMinutesThisMonth(orgId: string): number {
  const sec = getProviderQuantityThisMonth(orgId, 'ai_minutes');
  return Math.round((sec / 60) * 100) / 100;
}

export function computeTokenOverageGbp(orgId: string): {
  amountGbp: number;
  tokensUsed: number;
  tokenCap: number;
  overageTokens: number;
  costUsdThisMonth: number;
} {
  const org = getOrganizationById(orgId);
  const tokenCap = org?.monthlyTokenCap ?? PLAN_CONFIG.starter.monthlyTokenCap;
  const tokensUsed = getTokensUsedThisMonth(orgId);
  const overageTokens = Math.max(0, tokensUsed - tokenCap);
  const costUsdThisMonth = getTokenCostUsdThisMonth(orgId);
  if (overageTokens <= 0 || tokensUsed <= 0 || costUsdThisMonth <= 0) {
    return { amountGbp: 0, tokensUsed, tokenCap, overageTokens: 0, costUsdThisMonth };
  }
  const overageShare = overageTokens / tokensUsed;
  const overageUsd = costUsdThisMonth * overageShare;
  const amountGbp = roundGbp(overageUsd * TOKEN_OVERAGE_FX * TOKEN_OVERAGE_MARKUP);
  return { amountGbp, tokensUsed, tokenCap, overageTokens, costUsdThisMonth };
}

export function getUsageOverageSummary(orgId: string): UsageOverageSummary {
  const oid = normalizeUsageOrgId(orgId);
  const org = getOrganizationById(oid);
  const plan: OrgPlan = org?.plan ?? 'starter';
  const cfg = PLAN_CONFIG[plan];
  const periodMonth = currentBillingWeekKey();

  const aiMinutesUsed = getAiTalkMinutesThisMonth(oid);
  const aiMinutesIncluded = cfg.includedAiMinutes;
  const aiOverageMin = Math.max(0, aiMinutesUsed - aiMinutesIncluded);
  const aiAmountGbp = roundGbp(aiOverageMin * cfg.aiOverageGbpPerMinute);

  const tokenOv = computeTokenOverageGbp(oid);
  const phone = getPhoneUsageSummary(oid);

  const lines: UsageOverageLine[] = [];

  if (aiAmountGbp > 0) {
    lines.push({
      type: 'ai_talk',
      description: `AI talk overage (${aiOverageMin.toFixed(1)} min × £${cfg.aiOverageGbpPerMinute}/min)`,
      amountGbp: aiAmountGbp,
      amountPence: toPence(aiAmountGbp),
      detail: {
        aiMinutesUsed,
        aiMinutesIncluded,
        aiOverageMin,
        rate: cfg.aiOverageGbpPerMinute,
      },
    });
  }

  if (tokenOv.amountGbp > 0) {
    lines.push({
      type: 'tokens',
      description: `AI token overage (${tokenOv.overageTokens.toLocaleString()} tokens above allowance)`,
      amountGbp: tokenOv.amountGbp,
      amountPence: toPence(tokenOv.amountGbp),
      detail: { ...tokenOv, fx: TOKEN_OVERAGE_FX, markup: TOKEN_OVERAGE_MARKUP },
    });
  }

  if (phone.estimatedCostGbp > 0) {
    lines.push({
      type: 'phone_outbound',
      description: `Outbound phone overage (${phone.overageMobileMinutes.toFixed(1)} mobile + ${phone.overageLandlineMinutes.toFixed(1)} landline min)`,
      amountGbp: phone.estimatedCostGbp,
      amountPence: toPence(phone.estimatedCostGbp),
      detail: {
        outboundMinutes: phone.outboundMinutes,
        included: phone.phoneMinutesIncluded,
        overageMobileMinutes: phone.overageMobileMinutes,
        overageLandlineMinutes: phone.overageLandlineMinutes,
      },
    });
  }

  let tokenWarning: string | null = null;
  if (tokenOv.tokensUsed >= tokenOv.tokenCap) {
    tokenWarning = `Token allowance exceeded (${tokenOv.tokensUsed.toLocaleString()} / ${tokenOv.tokenCap.toLocaleString()}). Overage will appear on this month's invoice.`;
  } else if (tokenOv.tokensUsed >= tokenOv.tokenCap * 0.8) {
    tokenWarning = `Token allowance at ${Math.round((tokenOv.tokensUsed / tokenOv.tokenCap) * 100)}%.`;
  }

  return {
    orgId: oid,
    plan,
    periodMonth,
    lines,
    totalOverageGbp: roundGbp(lines.reduce((s, l) => s + l.amountGbp, 0)),
    tokenWarning,
    aiMinutesUsed,
    aiMinutesIncluded,
    tokensUsed: tokenOv.tokensUsed,
    tokenCap: tokenOv.tokenCap,
    phone,
  };
}
