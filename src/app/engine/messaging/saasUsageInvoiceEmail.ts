import type { SaasUsageInvoiceContent } from './saasUsageInvoiceContent';

export type SaasUsageInvoiceEmail = {
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Builds the customer-facing usage invoice email (sell lines only). */
export function buildSaasUsageInvoiceEmail(content: SaasUsageInvoiceContent): SaasUsageInvoiceEmail {
  const { contact } = content.brand;
  const venue = content.customer.venueName || content.customer.name;
  const subject = `Usage invoice — ${content.invoice.periodLabel} | Sync2Dine`;
  const statusLabel = content.invoice.status === 'paid' ? 'PAID' : 'AMOUNT DUE';
  const telHref = `tel:${contact.phoneTel}`;
  const cta = content.invoice.status !== 'paid' && content.invoice.hostedInvoiceUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;"><tr><td bgcolor="#e8c26a" style="border-radius:6px;"><a href="${escapeHtml(content.invoice.hostedInvoiceUrl)}" style="display:inline-block;padding:15px 25px;color:#102f30;text-decoration:none;font:700 14px Arial,sans-serif;letter-spacing:.04em;">Pay invoice securely</a></td></tr></table>
       <p style="margin:8px 0 0;color:#667775;font:12px/1.45 Arial,sans-serif;">Secure checkout · Your payment details are handled by Stripe.</p>`
    : '';

  const lineRows = content.lines.length
    ? content.lines.map((line) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eadcb9;color:#263b3a;font:13px/1.45 Arial,sans-serif;">${escapeHtml(line.description)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eadcb9;color:#0f3d3e;font:700 13px Arial,sans-serif;white-space:nowrap;">${money(line.amountGbp)}</td>
      </tr>`).join('')
    : `<tr><td colspan="2" style="padding:10px 0;color:#536563;font:13px Arial,sans-serif;">No overage charges this week.</td></tr>`;

  const usageRows = content.usageSummary.map((row) => `
    <tr>
      <td style="padding:6px 0;color:#536563;font:13px Arial,sans-serif;">${escapeHtml(row.label)}</td>
      <td align="right" style="padding:6px 0;color:#0f3d3e;font:13px Arial,sans-serif;">${row.used} / ${row.included} ${escapeHtml(row.unit)}</td>
    </tr>`).join('');

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
            <td align="right" style="color:#f3dda4;font:11px Arial,sans-serif;">INVOICE ${escapeHtml(content.invoice.reference)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 30px 20px;">
          <p style="margin:0 0 10px;color:#16494a;font:700 11px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">Bill to ${escapeHtml(venue)}</p>
          <h1 style="margin:0;color:#0f3d3e;font:700 28px/1.15 Arial,sans-serif;">Weekly usage invoice</h1>
          <p style="margin:12px 0 0;color:#536563;font:15px/1.55 Arial,sans-serif;">${escapeHtml(content.plan.packageName)} · ${escapeHtml(content.invoice.periodLabel)}</p>
        </td></tr>
        <tr><td style="padding:0 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f3d3e;">
            <tr>
              <td style="padding:22px 24px;">
                <div style="color:#f3dda4;font:700 10px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">${statusLabel}</div>
                <div style="margin-top:7px;color:#ffffff;font:700 32px Arial,sans-serif;">${money(content.amountGbp)}</div>
              </td>
              <td align="right" valign="middle" style="padding:22px 24px;color:#f6efe0;font:13px/1.5 Arial,sans-serif;">Issued<br><strong style="color:#e8c26a;">${escapeHtml(content.invoice.issuedDate)}</strong></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:28px 30px 8px;">
          <h2 style="margin:0 0 12px;color:#102f30;font:700 16px Arial,sans-serif;">Usage this week</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${usageRows}</table>
        </td></tr>
        <tr><td style="padding:16px 30px 8px;">
          <h2 style="margin:0 0 12px;color:#102f30;font:700 16px Arial,sans-serif;">Charges</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lineRows}</table>
          <p style="margin:18px 0 0;color:#536563;font:13px/1.55 Arial,sans-serif;">${escapeHtml(content.paymentNote)}</p>
          ${cta}
        </td></tr>
        <tr><td style="padding:22px 30px;background:#fff8df;border-top:1px solid #eadcb9;">
          <p style="margin:0;color:#0f3d3e;font:700 14px Arial,sans-serif;">Sync2Dine billing</p>
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
    'Sync2Dine — Weekly usage invoice',
    `Bill to: ${venue}`,
    `Reference: ${content.invoice.reference}`,
    `Period: ${content.invoice.periodLabel}`,
    `Plan: ${content.plan.packageName}`,
    '',
    `Amount ${content.invoice.status === 'paid' ? 'paid' : 'due'}: ${money(content.amountGbp)}`,
    '',
    'Usage this week:',
    ...content.usageSummary.map((r) => `- ${r.label}: ${r.used} / ${r.included} ${r.unit}`),
    '',
    'Charges:',
    ...(content.lines.length
      ? content.lines.map((l) => `- ${l.description}: ${money(l.amountGbp)}`)
      : ['- No overage charges this week.']),
    '',
    content.paymentNote,
    ...(content.invoice.hostedInvoiceUrl && content.invoice.status !== 'paid'
      ? ['', `Pay securely: ${content.invoice.hostedInvoiceUrl}`]
      : []),
    '',
    `Sync2Dine · ${contact.website} · ${contact.phone} · ${contact.email}`,
  ].join('\n');

  return { subject, html, text };
}
