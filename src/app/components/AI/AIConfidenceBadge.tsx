import { Badge } from '../ui/badge';

export function AIConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const variant = confidence >= 0.8 ? 'default' : confidence >= 0.5 ? 'secondary' : 'destructive';
  const label = confidence >= 0.8 ? 'High' : confidence >= 0.5 ? 'Medium' : 'Low';
  return (
    <Badge variant={variant} className="text-xs">
      {label} {pct}%
    </Badge>
  );
}
