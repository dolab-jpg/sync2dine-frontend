/**
 * Lightweight playbook checks for usage overage math (no Stripe network).
 * Run: npx --yes tsx scripts/usage-overage-playbook.mts
 */
import {
  PLAN_CONFIG,
  TOKEN_OVERAGE_FX,
  TOKEN_OVERAGE_MARKUP,
} from '../server/organizations.ts';
import { computeTokenOverageGbp } from '../server/usage-overage.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(PLAN_CONFIG.starter.monthlyPriceGbp === 199, 'starter price');
assert(PLAN_CONFIG.pro.monthlyPriceGbp === 399, 'pro price');
assert(PLAN_CONFIG.enterprise.monthlyPriceGbp === 699, 'enterprise price');
assert(PLAN_CONFIG.starter.badge === 'Most Popular', 'starter badge');
assert(PLAN_CONFIG.starter.includedAiMinutes === 600, 'starter mins');
assert(PLAN_CONFIG.pro.includedAiMinutes === 1800, 'pro mins');
assert(PLAN_CONFIG.enterprise.includedAiMinutes === 3600, 'enterprise mins');

const under = computeTokenOverageGbp('__playbook_missing_org__');
assert(under.amountGbp === 0, 'no org => 0 token overage');

const aiOverage = Math.max(0, 700 - PLAN_CONFIG.starter.includedAiMinutes) * PLAN_CONFIG.starter.aiOverageGbpPerMinute;
assert(Math.round(aiOverage * 100) / 100 === 35, `expected £35 for 100 overage mins, got ${aiOverage}`);

console.log('usage-overage-playbook: PASS', {
  starter: PLAN_CONFIG.starter.monthlyPriceGbp,
  tokenFx: TOKEN_OVERAGE_FX,
  tokenMarkup: TOKEN_OVERAGE_MARKUP,
  sampleAiOverageGbp: aiOverage,
});
