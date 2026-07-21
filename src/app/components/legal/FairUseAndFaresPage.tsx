import LegalPageShell from './LegalPageShell';
import {
  ADDITIONAL_SITE_ANNUAL_GBP,
  ADDITIONAL_SITE_WEEKLY_GBP,
  FARE_SCHEDULE_VERSION,
  OUTBOUND_OVERAGE,
  SAAS_PACKAGE_IDS,
  SAAS_PACKAGES,
  formatFareSummary,
} from '../../engine/saas/saasPackages';

export default function FairUseAndFaresPage() {
  return (
    <LegalPageShell title="Fair use & fares">
      <p>
        This fare schedule ({FARE_SCHEDULE_VERSION}) sets standard and launch prices, included usage, and overage rates.
        Launch pricing is a time-limited commercial offer (typically 40% off standard weekly rates). Annual prepay is
        charged at 50% of the annualized launch weekly rate unless otherwise stated at checkout.
      </p>
      <h2>Included usage</h2>
      <ul>
        <li>Judie AI minutes and outbound minutes reset every Monday 00:00 UK time (or your billing anchor).</li>
        <li>Unused included minutes do not roll over.</li>
        <li>Token allowances apply to AI features; overage may be billed at cost × multiplier stated in your contract.</li>
      </ul>
      <h2>Overage</h2>
      <ul>
        <li>AI talk-time overage: per-package rate shown in the table below.</li>
        <li>
          Outbound overage (where outbound is included): £{OUTBOUND_OVERAGE.mobileGbpPerMin}/min to UK mobile numbers, £
          {OUTBOUND_OVERAGE.landlineGbpPerMin}/min to UK landlines.
        </li>
        <li>
          When limits are reached you may choose to continue billing overage, pause and transfer calls to staff, or require
          approval before additional usage — set at checkout.
        </li>
      </ul>
      <h2>Additional sites</h2>
      <p>
        Each additional venue/site beyond the first is billed at ≥ £{ADDITIONAL_SITE_WEEKLY_GBP}/week on weekly billing or £
        {ADDITIONAL_SITE_ANNUAL_GBP}/year on annual prepay (launch floor).
      </p>
      <h2>Package fares</h2>
      <div className="not-prose overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Package</th>
              <th className="px-3 py-2 font-semibold">Standard /wk</th>
              <th className="px-3 py-2 font-semibold">Launch /wk</th>
              <th className="px-3 py-2 font-semibold">Annual prepay</th>
              <th className="px-3 py-2 font-semibold">AI min /wk</th>
              <th className="px-3 py-2 font-semibold">AI overage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SAAS_PACKAGE_IDS.map((id) => {
              const p = SAAS_PACKAGES[id];
              return (
                <tr key={id} className="bg-white">
                  <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                  <td className="px-3 py-2">£{p.standardWeeklyGbp}</td>
                  <td className="px-3 py-2">£{p.launchWeeklyGbp}</td>
                  <td className="px-3 py-2">£{p.annualPrepayGbp}</td>
                  <td className="px-3 py-2">{p.weeklyAiMinutes || '—'}</td>
                  <td className="px-3 py-2">
                    {p.aiOverageGbpPerMinute > 0 ? `£${p.aiOverageGbpPerMinute.toFixed(2)}/min` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2>Package summaries</h2>
      {SAAS_PACKAGE_IDS.map((id) => (
        <p key={id} className="text-xs text-slate-600">
          {formatFareSummary(SAAS_PACKAGES[id])}
        </p>
      ))}
    </LegalPageShell>
  );
}
