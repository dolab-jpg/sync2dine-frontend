import { ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { getCurrentDocuments } from '../../config/buildingControl/registry';
import type { TradeId } from '../../config/types';
import type { BCDocStatus } from '../../config/buildingControl/registry';

interface Props {
  tradeFilter: TradeId | 'all';
  onSelectDoc?: (docId: string) => void;
}

function statusVariant(status: BCDocStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'current') return 'default';
  if (status === 'pending_review') return 'destructive';
  return 'secondary';
}

export function BCDocLibrary({ tradeFilter, onSelectDoc }: Props) {
  const docs = getCurrentDocuments(tradeFilter === 'all' ? undefined : tradeFilter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">Approved Documents</h3>
      </div>
      <div className="grid gap-2 max-h-[420px] overflow-y-auto pr-1">
        {docs.map((doc) => (
          <Card
            key={doc.id}
            className="cursor-pointer hover:border-blue-300 transition-colors"
            onClick={() => onSelectDoc?.(doc.id)}
          >
            <CardHeader className="p-3 pb-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium leading-tight">{doc.shortTitle}</CardTitle>
                <Badge variant={statusVariant(doc.status)} className="text-[10px] shrink-0">
                  {doc.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-1">
              <p className="text-xs text-slate-600 line-clamp-2">{doc.title}</p>
              <p className="text-[10px] text-slate-400">v{doc.versionDate}</p>
              <a
                href={doc.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                gov.uk <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
