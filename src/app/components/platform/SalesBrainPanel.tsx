import { useCallback, useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

type Insight = {
  id: string;
  callId: string;
  outcome?: string;
  objections?: string[];
  whatWorked?: string;
  whatFailed?: string;
  nextStep?: string;
  upsellPotential?: string;
  createdAt: string;
};

type Rec = {
  id: string;
  type: string;
  proposedText: string;
  evidenceSummary?: string;
  sampleSize: number;
  status: string;
};

type Status = {
  queued: number;
  insights: number;
  pendingRecs: number;
  activeSnippets: number;
};

export default function SalesBrainPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, iRes, rRes] = await Promise.all([
        fetch('/api/sales-brain/status'),
        fetch('/api/sales-brain/insights'),
        fetch('/api/sales-brain/recommendations'),
      ]);
      const s = await sRes.json();
      const i = await iRes.json();
      const r = await rRes.json();
      // #region agent log
      fetch('http://127.0.0.1:7610/ingest/e809fe57-584f-4b4e-8cfb-f3dee6b9facf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0f60a'},body:JSON.stringify({sessionId:'d0f60a',runId:'verify-all',hypothesisId:'E',location:'SalesBrainPanel.tsx:load',message:'Sales Brain panel fetch',data:{statusHttp:sRes.status,insightsHttp:iRes.status,recsHttp:rRes.status,ok:Boolean(s?.ok),insights:s?.insights??null,queued:s?.queued??null,pendingRecs:s?.pendingRecs??null,insightRows:Array.isArray(i?.insights)?i.insights.length:0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (s.ok) setStatus(s);
      if (i.ok) setInsights(i.insights || []);
      if (r.ok) setRecs(r.recommendations || []);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7610/ingest/e809fe57-584f-4b4e-8cfb-f3dee6b9facf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0f60a'},body:JSON.stringify({sessionId:'d0f60a',runId:'verify-all',hypothesisId:'E',location:'SalesBrainPanel.tsx:load',message:'Sales Brain panel fetch failed',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error('Failed to load Sales Brain');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/sales-brain/recommendations/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'failed');
      toast.success(decision === 'approve' ? 'Approved ? live snippet' : 'Rejected');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Decide failed');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sales Brain</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scores calls after hang-up (async ù never slows Sally). Approve tips before they inject into the next dial.
        </p>
      </header>

      {loading && !status ? (
        <p className="text-sm text-muted-foreground">Loadingù</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Queued', status?.queued ?? 0],
            ['Insights', status?.insights ?? 0],
            ['Pending', status?.pendingRecs ?? 0],
            ['Active tips', status?.activeSnippets ?? 0],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg border border-border/60 px-3 py-2">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-xl font-medium">{val}</div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Pending recommendations</h2>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        {recs.filter((r) => r.status === 'pending').length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending recs yet ù need more scored calls.</p>
        ) : (
          recs
            .filter((r) => r.status === 'pending')
            .map((r) => (
              <div key={r.id} className="space-y-2 rounded-lg border border-border/60 p-4">
                <div className="text-xs text-muted-foreground">
                  {r.type} ù n={r.sampleSize}
                </div>
                <p className="text-sm">{r.proposedText}</p>
                {r.evidenceSummary ? (
                  <p className="text-xs text-muted-foreground">{r.evidenceSummary}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void decide(r.id, 'approve')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(r.id, 'reject')}>
                    Reject
                  </Button>
                </div>
              </div>
            ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent insights</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insights yet.</p>
        ) : (
          <ul className="space-y-2">
            {insights.slice(0, 20).map((i) => (
              <li key={i.id} className="rounded-lg border border-border/40 px-3 py-2 text-sm">
                <div className="font-medium">
                  {i.callId} ù {i.outcome || 'ù'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(i.objections || []).join(', ') || 'no objections tagged'}
                  {i.upsellPotential ? ` ù upsell ${i.upsellPotential}` : ''}
                </div>
                {i.whatWorked ? <div className="mt-1 text-xs">Worked: {i.whatWorked}</div> : null}
                {i.nextStep ? <div className="text-xs">Next: {i.nextStep}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
