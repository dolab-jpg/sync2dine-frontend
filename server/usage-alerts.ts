/**
 * Account usage counters + threshold alerts (email + outbound call).
 * Thresholds: 80% warn, 100% exceed, 200% AI hard-cap notify.
 * Deduped per org + calendar month + metric + level.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  PLAN_CONFIG,
  listOrganizations,
  getOrganizationById,
  type Organization,
} from './organizations';
import { getUsageOverageSummary } from './usage-overage';
import { sendPlainTextEmail } from './email-service';
import { enqueueOutboundCall, getDataStore } from './data-store';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const ALERTS_FILE = join(DATA_DIR, 'usage-alerts-sent.json');

export type UsageMetric = 'ai_talk' | 'tokens' | 'phone_outbound';
export type UsageAlertLevel = 'warn_80' | 'exceed_100' | 'hard_200';

export type UsageBucket = {
  metric: UsageMetric;
  label: string;
  used: number;
  included: number;
  unit: string;
  pct: number;
  level: UsageAlertLevel | 'ok';
};

export type OrgUsageAllowance = {
  orgId: string;
  plan: string;
  periodMonth: string;
  buckets: UsageBucket[];
  highestLevel: UsageAlertLevel | 'ok';
  warnings: string[];
  aiHardCapped: boolean;
};

type SentAlert = {
  key: string;
  orgId: string;
  metric: UsageMetric;
  level: UsageAlertLevel;
  periodMonth: string;
  emailedAt?: string;
  calledAt?: string;
  createdAt: string;
};

let memorySent: Record<string, SentAlert> = {};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadSent() {
  if (Object.keys(memorySent).length) return;
  try {
    if (existsSync(ALERTS_FILE)) {
      memorySent = JSON.parse(readFileSync(ALERTS_FILE, 'utf-8')) as Record<string, SentAlert>;
    }
  } catch {
    memorySent = {};
  }
}

function persistSent() {
  ensureDir();
  try {
    writeFileSync(ALERTS_FILE, JSON.stringify(memorySent, null, 2));
  } catch {
    /* ignore */
  }
}

function periodMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function alertKey(orgId: string, metric: UsageMetric, level: UsageAlertLevel, month: string): string {
  return `${orgId}|${month}|${metric}|${level}`;
}

function levelForPct(pct: number, hardMultiplier = 2): UsageAlertLevel | 'ok' {
  if (pct >= hardMultiplier * 100) return 'hard_200';
  if (pct >= 100) return 'exceed_100';
  if (pct >= 80) return 'warn_80';
  return 'ok';
}

function rank(level: UsageAlertLevel | 'ok'): number {
  if (level === 'hard_200') return 3;
  if (level === 'exceed_100') return 2;
  if (level === 'warn_80') return 1;
  return 0;
}

function levelsAtOrBelow(level: UsageAlertLevel): UsageAlertLevel[] {
  if (level === 'hard_200') return ['warn_80', 'exceed_100', 'hard_200'];
  if (level === 'exceed_100') return ['warn_80', 'exceed_100'];
  return ['warn_80'];
}

export function getOrgUsageAllowance(orgId: string): OrgUsageAllowance {
  const org = getOrganizationById(orgId);
  const summary = getUsageOverageSummary(orgId);
  const plan = summary.plan;
  const cfg = PLAN_CONFIG[plan];
  const month = summary.periodMonth;

  const aiPct = cfg.includedAiMinutes > 0
    ? (summary.aiMinutesUsed / cfg.includedAiMinutes) * 100
    : 0;
  const tokenPct = summary.tokenCap > 0
    ? (summary.tokensUsed / summary.tokenCap) * 100
    : 0;
  const phoneIncluded = summary.phone.phoneMinutesIncluded || cfg.includedOutboundMinutes;
  const phoneUsed = summary.phone.outboundMinutes;
  const phonePct = phoneIncluded > 0 ? (phoneUsed / phoneIncluded) * 100 : 0;

  const buckets: UsageBucket[] = [
    {
      metric: 'ai_talk',
      label: 'AI talk time',
      used: summary.aiMinutesUsed,
      included: cfg.includedAiMinutes,
      unit: 'min',
      pct: Math.round(aiPct),
      level: levelForPct(aiPct, cfg.hardStopMultiplier),
    },
    {
      metric: 'tokens',
      label: 'AI tokens',
      used: summary.tokensUsed,
      included: summary.tokenCap,
      unit: 'tokens',
      pct: Math.round(tokenPct),
      level: levelForPct(tokenPct, 2),
    },
    {
      metric: 'phone_outbound',
      label: 'Outbound phone',
      used: phoneUsed,
      included: phoneIncluded,
      unit: 'min',
      pct: Math.round(phonePct),
      level: levelForPct(phonePct, 2),
    },
  ];

  let highest: UsageAlertLevel | 'ok' = 'ok';
  const warnings: string[] = [];
  for (const b of buckets) {
    if (rank(b.level) > rank(highest)) highest = b.level;
    if (b.level === 'warn_80') {
      warnings.push(`${b.label} at ${b.pct}% of allowance (${b.used}/${b.included} ${b.unit}).`);
    } else if (b.level === 'exceed_100') {
      warnings.push(`${b.label} exceeded — ${b.used}/${b.included} ${b.unit}. Overage will appear on this month's invoice.`);
    } else if (b.level === 'hard_200') {
      warnings.push(`${b.label} over 2× allowance (${b.used}/${b.included} ${b.unit}). Please upgrade or top up.`);
    }
  }

  const aiHardCapped = buckets.find((b) => b.metric === 'ai_talk')?.level === 'hard_200';

  return {
    orgId,
    plan: org?.plan || plan,
    periodMonth: month,
    buckets,
    highestLevel: highest,
    warnings,
    aiHardCapped: Boolean(aiHardCapped),
  };
}

function formatBucketLine(b: UsageBucket): string {
  if (b.unit === 'tokens') {
    return `${b.label}: ${b.used.toLocaleString()} / ${b.included.toLocaleString()} (${b.pct}%)`;
  }
  return `${b.label}: ${b.used.toFixed(1)} / ${b.included} ${b.unit} (${b.pct}%)`;
}

function emailSubject(level: UsageAlertLevel, orgName: string): string {
  if (level === 'hard_200') return `Urgent: ${orgName} Sync2Dine usage over 2× allowance`;
  if (level === 'exceed_100') return `${orgName}: Sync2Dine allowance exceeded — overage applies`;
  return `${orgName}: Sync2Dine usage at 80% of your plan`;
}

function emailBody(org: Organization, allowance: OrgUsageAllowance, level: UsageAlertLevel): string {
  const cfg = PLAN_CONFIG[org.plan] || PLAN_CONFIG.starter;
  const lines = [
    `Hi ${org.contactName || 'there'},`,
    '',
    `This is Sync2Dine about your "${org.name}" account (${cfg.label} plan — £${cfg.monthlyPriceGbp}/mo).`,
    '',
    level === 'warn_80'
      ? 'You are approaching your included monthly allowances:'
      : level === 'exceed_100'
        ? 'You have gone past your included monthly allowances. Extra usage will be billed as overage on this month\'s invoice:'
        : 'Your AI talk usage is over twice the included allowance. Please upgrade your plan or contact us about a top-up:',
    '',
    ...allowance.buckets.map((b) => `• ${formatBucketLine(b)}`),
    '',
    'Overage rates: AI talk per your plan minute rate · outbound £0.12/min mobile / £0.03/min landline · tokens at tracked cost × markup.',
    'Cancel anytime — no lock-in. Reply to this email or ask for a callback if you want to upgrade (Pro £399 / Enterprise £699).',
    '',
    '— Sync2Dine',
  ];
  return lines.join('\n');
}

function callBrief(org: Organization, allowance: OrgUsageAllowance, level: UsageAlertLevel): string {
  const bits = allowance.warnings.join(' ');
  return (
    `Usage alert for ${org.name}. Level ${level}. ${bits} ` +
    `Explain their plan allowances politely, that overage will appear on the invoice, ` +
    `offer to upgrade Starter→Pro→Enterprise, and offer to email a summary. Keep it short.`
  );
}

async function sendAlertEmail(org: Organization, allowance: OrgUsageAllowance, level: UsageAlertLevel): Promise<boolean> {
  if (!org.contactEmail?.trim()) return false;
  const result = await sendPlainTextEmail({
    to: org.contactEmail.trim(),
    subject: emailSubject(level, org.name),
    text: emailBody(org, allowance, level),
  });
  if (!result.ok) {
    console.warn(`[usage-alerts] email failed for ${org.id}: ${result.error}`);
    return false;
  }
  return true;
}

function enqueueAlertCall(org: Organization, allowance: OrgUsageAllowance, level: UsageAlertLevel): boolean {
  const phone = org.contactPhone?.trim();
  if (!phone) return false;
  // Avoid stacking identical queued jobs
  try {
    const existing = (getDataStore().outboundQueue || []).find((j) => {
      if (String(j.status) !== 'queued' && String(j.status) !== 'dialling') return false;
      const ctx = (j.context && typeof j.context === 'object') ? j.context as Record<string, unknown> : {};
      return String(ctx.aim) === 'usage_alert' && String(ctx.orgId) === org.id;
    });
    if (existing) return false;
  } catch {
    /* continue */
  }

  enqueueOutboundCall({
    to: phone,
    template: 'lead_callback',
    status: 'queued',
    context: {
      orgId: org.id,
      aim: 'usage_alert',
      reason: 'usage_alert',
      brief: callBrief(org, allowance, level),
      agentPersona: 'sally',
      source: 'usage_alerts',
      usageLevel: level,
    },
  });
  return true;
}

/**
 * Evaluate one org and fire email + call for any new threshold crossings this month.
 */
export async function evaluateAndNotifyOrg(orgId: string): Promise<{
  allowance: OrgUsageAllowance;
  notified: Array<{ metric: UsageMetric; level: UsageAlertLevel; email: boolean; call: boolean }>;
}> {
  loadSent();
  const org = getOrganizationById(orgId);
  const allowance = getOrgUsageAllowance(orgId);
  const notified: Array<{ metric: UsageMetric; level: UsageAlertLevel; email: boolean; call: boolean }> = [];

  if (!org || org.status === 'cancelled' || org.status === 'suspended') {
    return { allowance, notified };
  }

  for (const bucket of allowance.buckets) {
    if (bucket.level === 'ok') continue;
    for (const level of levelsAtOrBelow(bucket.level)) {
      // Only fire this level if the bucket actually reached it
      if (rank(bucket.level) < rank(level)) continue;
      const key = alertKey(org.id, bucket.metric, level, allowance.periodMonth);
      if (memorySent[key]) continue;

      const emailed = await sendAlertEmail(org, allowance, level);
      const called = enqueueAlertCall(org, allowance, level);
      memorySent[key] = {
        key,
        orgId: org.id,
        metric: bucket.metric,
        level,
        periodMonth: allowance.periodMonth,
        emailedAt: emailed ? new Date().toISOString() : undefined,
        calledAt: called ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString(),
      };
      persistSent();
      notified.push({ metric: bucket.metric, level, email: emailed, call: called });
      // One call per evaluation is enough — don't spam multiple metrics
      if (called) break;
    }
  }

  return { allowance, notified };
}

export async function scanAllOrgsForUsageAlerts(): Promise<{
  orgsScanned: number;
  notifications: number;
}> {
  const orgs = listOrganizations().filter(
    (o) => o.status === 'active' || o.status === 'trial' || o.status === 'past_due',
  );
  let notifications = 0;
  for (const org of orgs) {
    try {
      const result = await evaluateAndNotifyOrg(org.id);
      notifications += result.notified.length;
    } catch (err) {
      console.warn(
        `[usage-alerts] scan failed for ${org.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { orgsScanned: orgs.length, notifications };
}

/** True when AI answering should be paused (2× AI minutes). */
export function isAiTalkHardCapped(orgId: string): boolean {
  return getOrgUsageAllowance(orgId).aiHardCapped;
}
