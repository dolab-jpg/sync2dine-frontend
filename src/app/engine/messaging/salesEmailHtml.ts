/** Client-side preview of Sync2Dine sales email HTML (mirrors server shell). */

export function buildSalesEmailHtmlPreview(opts: {
  subject?: string;
  bodyText: string;
  companyName?: string;
}): string {
  const company = opts.companyName || 'Sync2Dine';
  const hero = opts.subject || company;
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  return `<div style="background:#f5f0e8;padding:16px;border-radius:8px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e0d4;border-radius:8px;overflow:hidden;">
    <div style="background:#0f3d3a;padding:20px 24px;">
      <div style="font:700 20px Arial,sans-serif;color:#f8faf9;letter-spacing:0.04em;">${escape(company)}</div>
      <div style="font:13px Arial,sans-serif;color:#a7d4cf;margin-top:4px;">Voice ordering &amp; bookings for restaurants</div>
    </div>
    <div style="background:#134e4a;padding:10px 24px;font:600 13px Arial,sans-serif;color:#ecfdf5;">${escape(hero)}</div>
    <div style="padding:22px 24px 8px;">${paras || '<p style="color:#78716c;">(empty)</p>'}</div>
    <div style="padding:0 24px 22px;">
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
