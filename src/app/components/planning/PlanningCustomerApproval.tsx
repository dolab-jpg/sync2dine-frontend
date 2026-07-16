import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollText, FileText, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  addPlanningComment,
  getPlanningApplicationByApprovalToken,
  updatePlanningApplication,
} from '../../engine/planning/planningStore';
import type { PlanningApplication } from '../../engine/planning/types';

export default function PlanningCustomerApproval() {
  const { token } = useParams<{ token: string }>();
  const [app, setApp] = useState<PlanningApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [changesNote, setChangesNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) { setLoading(false); return; }
    const found = getPlanningApplicationByApprovalToken(token) ?? null;
    setApp(found);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const decided = app?.customerApproval.status === 'approved' || app?.customerApproval.status === 'changes';

  const approve = () => {
    if (!app) return;
    setSubmitting(true);
    updatePlanningApplication(app.id, {
      customerApproval: { ...app.customerApproval, status: 'approved', decisionAt: new Date().toISOString() },
    });
    addPlanningComment(app.id, `${app.customerName} approved the drawings.`, 'customer', app.customerName);
    setSubmitting(false);
    load();
  };

  const requestChanges = () => {
    if (!app || !changesNote.trim()) return;
    setSubmitting(true);
    updatePlanningApplication(app.id, {
      customerApproval: { ...app.customerApproval, status: 'changes', decisionAt: new Date().toISOString(), note: changesNote.trim() },
      stage: 'drawings',
    });
    addPlanningComment(app.id, `${app.customerName} requested changes to the drawings: "${changesNote.trim()}"`, 'customer', app.customerName);
    setSubmitting(false);
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Link not found</h1>
            <p className="text-gray-600">This drawings review link is invalid or has expired. Please contact us for a new one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (decided) {
    const approved = app.customerApproval.status === 'approved';
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-gray-50 p-6">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className={`w-14 h-14 mx-auto mb-4 ${approved ? 'text-green-600' : 'text-amber-500'}`} />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {approved ? 'Thank you — drawings approved' : 'Thanks — we\u2019ll make those changes'}
              </h1>
              <p className="text-gray-600">
                {approved
                  ? `Thank you, ${app.customerName}. We'll now prepare your application for submission to the council.`
                  : `Thank you, ${app.customerName}. We've received your requested changes and will be in touch with updated drawings.`}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <ScrollText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review your planning drawings</h1>
            <p className="text-gray-600">{app.title}{app.address ? ` — ${app.address}` : ''}</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Drawings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {app.drawings.length === 0 && <p className="text-sm text-gray-500">No drawings have been attached yet.</p>}
            {app.drawings.map((d) => (
              <div key={d.id} className="flex items-center justify-between border rounded-lg p-3">
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span className="truncate text-sm">{d.filename}</span>
                  <Badge variant="outline" className="shrink-0">v{d.version}</Badge>
                </span>
                {d.dataUrl && (
                  <a href={d.dataUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm flex items-center gap-1">
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Your decision</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" size="lg" disabled={submitting} onClick={approve}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve these drawings
            </Button>
            <div>
              <p className="text-sm text-gray-600 mb-2">Or request changes:</p>
              <Textarea
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                rows={3}
                placeholder="Let us know what you'd like changed…"
              />
              <Button
                variant="outline"
                className="w-full mt-2"
                disabled={submitting || !changesNote.trim()}
                onClick={requestChanges}
              >
                Request changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
