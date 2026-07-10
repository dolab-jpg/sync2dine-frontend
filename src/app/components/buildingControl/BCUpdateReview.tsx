import { useState } from 'react';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  approvePendingUpdate,
  checkForRegulationUpdates,
  dismissPendingUpdate,
  loadPendingUpdates,
  type PendingBCUpdate,
} from '../../engine/buildingControl/updateChecker';
import { toast } from 'sonner';

interface Props {
  canReview: boolean;
}

export function BCUpdateReview({ canReview }: Props) {
  const [pending, setPending] = useState<PendingBCUpdate[]>(loadPendingUpdates);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try {
      const { pendingCount } = await checkForRegulationUpdates();
      setPending(loadPendingUpdates());
      toast.success(pendingCount > 0
        ? `${pendingCount} update(s) detected — review required`
        : 'No regulation updates detected');
    } catch {
      toast.error('Update check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleApprove = async (docId: string) => {
    try {
      await fetch('/api/building-control/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, action: 'approve' }),
      });
      approvePendingUpdate(docId);
      setPending(loadPendingUpdates());
      toast.success('Document approved for AI use');
    } catch {
      approvePendingUpdate(docId);
      setPending(loadPendingUpdates());
      toast.success('Marked as reviewed locally');
    }
  };

  const handleDismiss = (docId: string) => {
    dismissPendingUpdate(docId);
    setPending(loadPendingUpdates());
  };

  if (!canReview && pending.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Regulation updates
          </CardTitle>
          {canReview && (
            <Button size="sm" variant="outline" onClick={runCheck} disabled={checking}>
              <RefreshCw className={`w-3 h-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
              Check gov.uk
            </Button>
          )}
        </div>
      </CardHeader>
      {pending.length > 0 && (
        <CardContent className="space-y-2">
          {pending.map((item) => (
            <div key={item.docId} className="flex items-start justify-between gap-2 text-sm bg-white rounded-lg p-2 border">
              <div>
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">{item.message}</p>
              </div>
              {canReview && (
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleApprove(item.docId)}>
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDismiss(item.docId)}>
                    <X className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
