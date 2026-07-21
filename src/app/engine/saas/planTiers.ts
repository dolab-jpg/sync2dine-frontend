/** Client mirror of server PLAN_CONFIG — Judie weekly allowances. */

import { SAAS_PACKAGES, monthlyEquivalentFromWeekly } from './saasPackages';

export type OrgPlan = 'starter' | 'pro' | 'enterprise';

export type PlanConfig = {
  label: string;
  badge?: string;
  /** Monthly equivalent of launch weekly (comparison / legacy UI). */
  monthlyPriceGbp: number;
  weeklyPriceGbp: number;
  standardWeeklyGbp: number;
  annualPrepayGbp: number;
  /** Weekly included Judie AI minutes. */
  includedAiMinutes: number;
  aiOverageGbpPerMinute: number;
  /** Weekly token cap. */
  monthlyTokenCap: number;
  includedOutboundMinutes: number;
  hardStopMultiplier: number;
  packageId: 'judie_starter' | 'judie_pro' | 'judie_enterprise';
};

const starter = SAAS_PACKAGES.judie_starter;
const pro = SAAS_PACKAGES.judie_pro;
const enterprise = SAAS_PACKAGES.judie_enterprise;

export const PLAN_TIERS: Record<OrgPlan, PlanConfig> = {
  starter: {
    label: 'Judie Starter',
    badge: 'Most Popular',
    monthlyPriceGbp: monthlyEquivalentFromWeekly(starter.launchWeeklyGbp),
    weeklyPriceGbp: starter.launchWeeklyGbp,
    standardWeeklyGbp: starter.standardWeeklyGbp,
    annualPrepayGbp: starter.annualPrepayGbp,
    includedAiMinutes: starter.weeklyAiMinutes,
    aiOverageGbpPerMinute: starter.aiOverageGbpPerMinute,
    monthlyTokenCap: starter.weeklyTokenCap,
    includedOutboundMinutes: starter.weeklyOutboundMinutes,
    hardStopMultiplier: 2,
    packageId: 'judie_starter',
  },
  pro: {
    label: 'Judie Pro',
    monthlyPriceGbp: monthlyEquivalentFromWeekly(pro.launchWeeklyGbp),
    weeklyPriceGbp: pro.launchWeeklyGbp,
    standardWeeklyGbp: pro.standardWeeklyGbp,
    annualPrepayGbp: pro.annualPrepayGbp,
    includedAiMinutes: pro.weeklyAiMinutes,
    aiOverageGbpPerMinute: pro.aiOverageGbpPerMinute,
    monthlyTokenCap: pro.weeklyTokenCap,
    includedOutboundMinutes: pro.weeklyOutboundMinutes,
    hardStopMultiplier: 2,
    packageId: 'judie_pro',
  },
  enterprise: {
    label: 'Judie Enterprise',
    monthlyPriceGbp: monthlyEquivalentFromWeekly(enterprise.launchWeeklyGbp),
    weeklyPriceGbp: enterprise.launchWeeklyGbp,
    standardWeeklyGbp: enterprise.standardWeeklyGbp,
    annualPrepayGbp: enterprise.annualPrepayGbp,
    includedAiMinutes: enterprise.weeklyAiMinutes,
    aiOverageGbpPerMinute: enterprise.aiOverageGbpPerMinute,
    monthlyTokenCap: enterprise.weeklyTokenCap,
    includedOutboundMinutes: enterprise.weeklyOutboundMinutes,
    hardStopMultiplier: 2,
    packageId: 'judie_enterprise',
  },
};

export const ORG_PLAN_IDS: OrgPlan[] = ['starter', 'pro', 'enterprise'];

export function formatAiHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} hours` : `${h.toFixed(1)} hours`;
}

export function planMonthlyFor(plan: OrgPlan): number {
  return PLAN_TIERS[plan]?.monthlyPriceGbp ?? PLAN_TIERS.starter.monthlyPriceGbp;
}

export function planWeeklyFor(plan: OrgPlan): number {
  return PLAN_TIERS[plan]?.weeklyPriceGbp ?? PLAN_TIERS.starter.weeklyPriceGbp;
}
