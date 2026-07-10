import { Button } from '../ui/button';
import { formatDisclaimer } from '../../engine/ai/indicativeEstimate';

interface EstimateConsentCardProps {
  low: number;
  high: number;
  onProceed: () => void;
  onMoreInfo: () => void;
}

export function EstimateConsentCard({ low, high, onProceed, onMoreInfo }: EstimateConsentCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-sm">
      <p className="font-semibold text-slate-800">
        Ballpark £{low.toLocaleString('en-GB')}–£{high.toLocaleString('en-GB')}
      </p>
      <p className="text-slate-600 text-xs leading-relaxed">{formatDisclaimer(low, high)}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onProceed}>
          Yes, that&apos;s fine to proceed
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onMoreInfo}>
          I&apos;ve got more to add
        </Button>
      </div>
    </div>
  );
}
