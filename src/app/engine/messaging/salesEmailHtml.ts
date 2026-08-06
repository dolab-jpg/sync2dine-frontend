/** Client-side preview of Sync2Dine sales email HTML (mirrors server marketing shell). */

const DEFAULT_HERO_IMAGE =
  'https://app.sync2dine.io/quote-assets/sync2dine-phone-agent.jpg';
const DEFAULT_CTA_URL = 'https://sync2dine.io';

type PreviewPackage = {
  name: string;
  description: string;
  launchWeeklyGbp: number;
  badge?: string;
};

const DEFAULT_PACKAGES: PreviewPackage[] = [
  {
    name: 'Atmosphere',
    description: 'Venue audio, promotional messaging, and staff training',
    launchWeeklyGbp: 139,
  },
  {
    name: 'Judie Starter',
    description: 'Judie AI receptionist for orders, bookings, and transfers',
    launchWeeklyGbp: 139,
    badge: 'Most Popular',
  },
  {
    name: 'Judie Pay-as-you-go',
    description: 'Inbound-only Judie receptionist — orders and bookings',
    launchWeeklyGbp: 46,
  },
  {
    name: 'Complete',
    description: 'Atmosphere + Judie Starter — phone and venue growth',
    launchWeeklyGbp: 208,
    badge: 'Best value',
  },
];

export function buildSalesEmailHtmlPreview(opts: {
  subject?: string;
  bodyText: string;
  companyName?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  showPackages?: boolean;
}): string {
  const company = opts.companyName || 'Sync2Dine';
  const hero = opts.subject || company;
  const ctaUrl = opts.ctaUrl || DEFAULT_CTA_URL;
  const ctaLabel = opts.ctaLabel || 'See Sync2Dine';
  const showPackages = opts.showPackages !== false;
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const paras = opts.bodyText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(
      (b) =>
        `<p style="margin:0 0 14px;color:#1c1917;font-size:15px;line-height:1.55;font-family:Georgia,serif;">${escape(b).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');

  const packageCards = DEFAULT_PACKAGES.map((pkg) => {
    const badge = pkg.badge
      ? `<div style="display:inline-block;background:#ecfdf5;color:#0f766e;font:700 10px Arial,sans-serif;letter-spacing:0.04em;text-transform:uppercase;padding:3px 7px;border-radius:999px;margin-bottom:6px;">${escape(pkg.badge)}</div>`
      : '';
    return `<div style="flex:1 1 45%;min-width:140px;background:#faf8f4;border:1px solid #e7e0d4;border-radius:8px;padding:12px;">
      ${badge}
      <div style="font:700 14px Arial,sans-serif;color:#0f3d3a;margin-bottom:4px;">${escape(pkg.name)}</div>
      <div style="font:12px Arial,sans-serif;color:#78716c;line-height:1.35;margin-bottom:8px;">${escape(pkg.description)}</div>
      <div style="font:700 18px Arial,sans-serif;color:#0f766e;">£${pkg.launchWeeklyGbp}<span style="font:600 12px Arial,sans-serif;color:#57534e;">/wk launch</span></div>
    </div>`;
  }).join('');

  const packagesBlock = showPackages
    ? `<div style="padding:4px 24px 8px;">
        <div style="font:700 12px Arial,sans-serif;letter-spacing:0.06em;text-transform:uppercase;color:#0f766e;margin-bottom:8px;">Launch packages</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${packageCards}</div>
        <div style="font:12px Arial,sans-serif;color:#78716c;margin-top:8px;line-height:1.4;">
          All weekly rolling — cancel anytime after the first month with 30 days notice.
        </div>
      </div>`
    : '';

  return `<div style="background:#f5f0e8;padding:16px;border-radius:8px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e0d4;border-radius:10px;overflow:hidden;">
    <div style="background:#0f3d3a;padding:20px 24px;">
      <div style="font:700 22px Georgia,serif;color:#f8faf9;letter-spacing:0.02em;">${escape(company)}</div>
      <div style="font:13px Arial,sans-serif;color:#a7d4cf;margin-top:6px;">Voice ordering &amp; bookings for restaurants</div>
    </div>
    <div style="line-height:0;">
      <img src="${DEFAULT_HERO_IMAGE}" alt="Sync2Dine AI phone ordering" style="display:block;width:100%;height:auto;border:0;" />
    </div>
    <div style="background:#134e4a;padding:12px 24px;font:700 14px Arial,sans-serif;color:#ecfdf5;">${escape(hero)}</div>
    <div style="padding:22px 24px 8px;">${paras || '<p style="color:#78716c;">(empty)</p>'}</div>
    ${packagesBlock}
    <div style="padding:12px 24px 8px;text-align:center;">
      <a href="${escape(ctaUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font:700 14px Arial,sans-serif;padding:12px 22px;border-radius:6px;">${escape(ctaLabel)}</a>
      <div style="font:12px Arial,sans-serif;color:#a8a29e;margin-top:8px;">Or visit sync2dine.io</div>
    </div>
    <div style="padding:12px 24px 22px;">
      <div style="height:1px;background:#e7e0d4;margin:8px 0 16px;"></div>
      <div style="font:13px Arial,sans-serif;color:#57534e;line-height:1.5;">
        <strong style="color:#0f3d3a;">${escape(company)}</strong><br/>
        020 3745 3233 · info@sync2dine.io<br/>
        sync2dine.io
      </div>
      <div style="font:12px Arial,sans-serif;color:#78716c;margin-top:12px;">Sally · Sync2Dine — helping restaurants answer every call.</div>
    </div>
  </div>
</div>`;
}
