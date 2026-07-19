import type { SaasQuoteContent } from './saasQuoteContent';

export type SaasQuoteEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value: number): string {
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function bulletList(items: string[]): string {
  return items
    .map(
      (item) =>
        `<tr><td valign="top" style="padding:0 10px 10px 0;color:#e8c26a;font-size:16px;">&#8226;</td><td style="padding:0 0 10px;color:#263b3a;font:14px/1.5 Arial,sans-serif;">${escapeHtml(item)}</td></tr>`,
    )
    .join('');
}

/** Builds the customer-facing email from the same content used by the PDF. */
export function buildSaasQuoteEmail(content: SaasQuoteContent): SaasQuoteEmail {
  const venue = content.customer.venueName || content.customer.name;
  const subject = `${content.plan.name} proposal for ${venue} | Sync2Dine`;
  const checkoutUrl = content.quote.checkoutUrl;
  const { contact } = content.brand;
  const telHref = `tel:${contact.phoneTel}`;
  const ctaHtml = checkoutUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;"><tr><td bgcolor="#e8c26a" style="border-radius:6px;"><a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;padding:15px 25px;color:#102f30;text-decoration:none;font:700 14px Arial,sans-serif;letter-spacing:.04em;">Pay securely with Stripe</a></td></tr></table>
       <p style="margin:8px 0 0;color:#667775;font:12px/1.45 Arial,sans-serif;">Secure checkout · Your payment details are handled by Stripe.</p>`
    : `<p style="margin:22px 0 0;color:#263b3a;font:700 14px/1.5 Arial,sans-serif;">To accept, reply to this email or call <a href="${escapeHtml(telHref)}" style="color:#0f3d3e;text-decoration:none;">${escapeHtml(contact.phone)}</a>.</p>`;

  const sellerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;background:#0f3d3e;">
            <tr><td style="padding:22px 24px;">
              <div style="color:#f3dda4;font:700 10px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">Your Sync2Dine contact</div>
              <div style="margin-top:8px;color:#ffffff;font:700 20px Arial,sans-serif;">${escapeHtml(contact.sellerName)}</div>
              <div style="margin-top:4px;color:#f6efe0;font:13px/1.45 Arial,sans-serif;">${escapeHtml(contact.sellerTitle)} · happy to talk through this proposal</div>
              <div style="margin-top:14px;">
                <a href="${escapeHtml(telHref)}" style="color:#e8c26a;text-decoration:none;font:700 26px/1.2 Arial,sans-serif;letter-spacing:.02em;">${escapeHtml(contact.phone)}</a>
              </div>
              <div style="margin-top:4px;color:#c9b896;font:11px Arial,sans-serif;">UK landline · tap to call</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0;"><tr>
                <td bgcolor="#e8c26a" style="border-radius:6px;">
                  <a href="${escapeHtml(telHref)}" style="display:inline-block;padding:14px 22px;color:#102f30;text-decoration:none;font:700 14px Arial,sans-serif;letter-spacing:.04em;">Call ${escapeHtml(contact.sellerName)} now</a>
                </td>
              </tr></table>
            </td></tr>
          </table>`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6efe0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6efe0;">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #eadcb9;">
        <tr><td style="padding:24px 30px;background:#102f30;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="color:#fff8df;font:700 22px Arial,sans-serif;">Sync<span style="color:#e8c26a;">2</span>Dine</td>
            <td align="right" style="color:#f3dda4;font:11px Arial,sans-serif;">PROPOSAL ${escapeHtml(content.quote.reference)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 30px 28px;">
          <p style="margin:0 0 10px;color:#16494a;font:700 11px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">Prepared for ${escapeHtml(venue)}</p>
          <h1 style="margin:0;color:#0f3d3e;font:700 29px/1.15 Arial,sans-serif;">${escapeHtml(content.plan.name)}</h1>
          <p style="margin:14px 0 0;color:#536563;font:15px/1.6 Arial,sans-serif;">${escapeHtml(content.introduction)}</p>
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f3d3e;">
            <tr>
              <td style="padding:22px 24px;">
                <div style="color:#f3dda4;font:700 10px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(content.plan.billingLabel)}</div>
                <div style="margin-top:7px;color:#ffffff;font:700 32px Arial,sans-serif;">${money(content.plan.amountGbp)}</div>
                <div style="margin-top:5px;color:#f6efe0;font:12px Arial,sans-serif;">${content.plan.billingInterval === 'annual' ? 'one annual payment' : 'billed weekly'}</div>
              </td>
              <td align="right" valign="middle" style="padding:22px 24px;color:#f6efe0;font:13px/1.5 Arial,sans-serif;">Valid until<br><strong style="color:#e8c26a;">${escapeHtml(content.quote.expiryDate)}</strong></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:30px;">
          <h2 style="margin:0 0 16px;color:#102f30;font:700 18px Arial,sans-serif;">Included in your plan</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${bulletList(content.inclusions)}</table>
          ${ctaHtml}
          ${sellerBlock}
        </td></tr>
        <tr><td style="padding:22px 30px;background:#fff8df;border-top:1px solid #eadcb9;">
          <p style="margin:0;color:#0f3d3e;font:700 14px Arial,sans-serif;">${escapeHtml(contact.sellerName)} · Sync2Dine</p>
          <p style="margin:7px 0 0;color:#667775;font:12px/1.6 Arial,sans-serif;">
            <a href="https://${escapeHtml(contact.website)}" style="color:#16494a;text-decoration:none;">${escapeHtml(contact.website)}</a> ·
            <a href="${escapeHtml(telHref)}" style="color:#16494a;text-decoration:none;">${escapeHtml(contact.phone)}</a> ·
            <a href="mailto:${escapeHtml(contact.email)}" style="color:#16494a;text-decoration:none;">${escapeHtml(contact.email)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Sync2Dine — ${content.plan.name} proposal`,
    `Prepared for: ${venue}`,
    `Reference: ${content.quote.reference}`,
    '',
    content.introduction,
    '',
    `${content.plan.billingLabel}: ${money(content.plan.amountGbp)} (${content.plan.billingInterval === 'annual' ? 'annual payment' : 'billed weekly'})`,
    `Valid until: ${content.quote.expiryDate}`,
    '',
    'Included in your plan:',
    ...content.inclusions.map((item) => `- ${item}`),
    '',
    ...(checkoutUrl
      ? ['Pay securely with Stripe:', checkoutUrl]
      : [`To accept, reply to this email or call ${contact.phone}.`]),
    '',
    `Your Sync2Dine contact: ${contact.sellerName} (${contact.sellerTitle})`,
    `Call ${contact.sellerName}: ${contact.phone} (${telHref})`,
    '',
    'Sync2Dine',
    `${contact.website} | ${contact.phone} | ${contact.email}`,
  ].join('\n');

  return { subject, html, text };
}
